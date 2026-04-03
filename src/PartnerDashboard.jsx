import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, Users, Target, TrendingUp, Download, CheckCircle, 
  XCircle, FileText, Activity, BookOpen, AlertCircle, UploadCloud, X, Lock, Crown, ArrowRight, Briefcase, AlertTriangle, Sparkles, Search 
} from 'lucide-react';
import { auth, db } from './firebase';
import { collection, query, where, onSnapshot, writeBatch, doc, getDoc } from 'firebase/firestore'; 
import { useAuth } from './AuthContext';

// --- CUSTOM SVG LOGO COMPONENT ---
const SkillNovaLogo = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M50 5L60.5 39.5L95 50L60.5 60.5L50 95L39.5 60.5L5 50L39.5 39.5L50 5Z" fill="url(#nova-gradient)"/>
    <circle cx="50" cy="50" r="18" fill="#04060d"/>
    <circle cx="50" cy="50" r="8" fill="url(#nova-gradient)"/>
    <defs>
      <linearGradient id="nova-gradient" x1="5" y1="5" x2="95" y2="95" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366f1" /> 
        <stop offset="1" stopColor="#ec4899" /> 
      </linearGradient>
    </defs>
  </svg>
);

export default function PartnerDashboard() {
  const { tenantId, currentUser } = useAuth();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null); 

  // --- QA BYPASS STATE ---
  const [isTester, setIsTester] = useState(false);

  // --- MONETIZATION TIER ---
  const [partnerTier, setPartnerTier] = useState('free'); // 'free' or 'premium'
  
  // Calculate final premium status (Real Tier + QA Bypass)
  const isPremium = partnerTier === 'premium' || isTester;

  // --- MODAL STATES ---
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState({ text: '', type: '' });
  
  // --- TABLE FILTERS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pass' | 'fail'

  const [stats, setStats] = useState({
    totalScans: 0,
    uniqueStudents: 0,
    avgMatchScore: 0,
    passRate: 0,
    topGaps: [],
    atRiskCount: 0,
    topRoles: []
  });

  // --- ANIMATION REFS ---
  const gridRef = useRef(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const timeOffset = useRef({ x: 0, y: 0 });

  // --- 60FPS CONTINUOUS + PARALLAX GRID LOGIC ---
  useEffect(() => {
    let animationFrameId;

    const handleMouseMove = (e) => {
      mousePos.current.x = e.clientX - window.innerWidth / 2;
      mousePos.current.y = e.clientY - window.innerHeight / 2;
    };

    const animate = () => {
      if (gridRef.current) {
        timeOffset.current.x += 0.4;
        timeOffset.current.y -= 0.4;

        const bgX = timeOffset.current.x - (mousePos.current.x * 0.08);
        const bgY = timeOffset.current.y - (mousePos.current.y * 0.08);

        // Apply to both layers of the dual grid
        gridRef.current.style.backgroundPosition = `${bgX}px ${bgY}px, ${bgX}px ${bgY}px, ${bgX}px ${bgY}px, ${bgX}px ${bgY}px`;
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove);
    animate(); 

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    if (!tenantId || !currentUser?.email) {
      if(!tenantId) setErrorMsg("Admin configuration error: No Partner Code assigned to this account.");
      setLoading(false);
      return;
    }

    // 1. Fetch QA Status & Partner Tier
    const checkAccessLevels = async () => {
      try {
        // Check QA Bypass first
        if (currentUser.email) {
          const qaRef = doc(db, 'qa_accounts', currentUser.email.toLowerCase());
          const qaSnap = await getDoc(qaRef);
          if (qaSnap.exists() && qaSnap.data().active === true) {
            setIsTester(true);
          }
        }

        // Check actual Partner Tier
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.email.toLowerCase()));
        if (adminDoc.exists()) {
          setPartnerTier(adminDoc.data().tier || 'free'); 
        }
      } catch (err) {
        console.error("Access check error:", err);
      }
    };
    checkAccessLevels();

    // 2. Fetch the ATS Data
    const q = query(collection(db, 'ats_scans'), where('tenantId', '==', tenantId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scanData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        const timeA = a.timestamp?.toMillis() || 0;
        const timeB = b.timestamp?.toMillis() || 0;
        return timeB - timeA;
      });

      setScans(scanData);

      if (scanData.length > 0) {
        const total = scanData.length;
        const uniqueEmails = new Set(scanData.map(s => s.userEmail));
        const totalScore = scanData.reduce((acc, curr) => acc + (curr.roleMatchScore || curr.score || 0), 0);
        const passedCount = scanData.filter(s => (s.roleMatchScore || s.score || 0) >= 60).length;
        
        const gapCounts = {};
        scanData.forEach(scan => {
          if (scan.missingKeywords) {
            scan.missingKeywords.forEach(skill => {
              gapCounts[skill] = (gapCounts[skill] || 0) + 1;
            });
          }
        });

        const topGaps = Object.entries(gapCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([name, count]) => ({ name, percentage: Math.round((count / total) * 100) }));

        const atRiskCount = scanData.filter(s => (s.roleMatchScore || s.score || 0) < 35).length;

        const roleCounts = {};
        scanData.forEach(scan => {
          if (scan.targetRole) {
            roleCounts[scan.targetRole] = (roleCounts[scan.targetRole] || 0) + 1;
          }
        });
        const topRoles = Object.entries(roleCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, count]) => ({ name, count }));

        setStats({
          totalScans: total,
          uniqueStudents: uniqueEmails.size,
          avgMatchScore: Math.round(totalScore / total),
          passRate: Math.round((passedCount / total) * 100),
          topGaps,
          atRiskCount,
          topRoles
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setErrorMsg("Database connection blocked: " + error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId, currentUser]);

  // --- CSV UPLOAD LOGIC ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "text/csv") {
      setCsvFile(file);
      setUploadMessage({ text: '', type: '' });
    } else {
      setCsvFile(null);
      setUploadMessage({ text: 'Please upload a valid .csv file.', type: 'error' });
    }
  };

  const processBulkUpload = async () => {
    if (!csvFile) return;
    setIsUploading(true);
    setUploadMessage({ text: 'Parsing CSV...', type: 'info' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const rawLines = text.split('\n');
      const emailsToUpload = rawLines.map(line => line.split(',')[0].trim().toLowerCase()).filter(email => email.includes('@'));

      if (emailsToUpload.length === 0) {
        setUploadMessage({ text: 'No valid emails found in the CSV.', type: 'error' });
        setIsUploading(false); return;
      }

      try {
        setUploadMessage({ text: `Provisioning ${emailsToUpload.length} students...`, type: 'info' });
        const batch = writeBatch(db);

        emailsToUpload.slice(0, 500).forEach((email) => {
          const studentRef = doc(db, 'allowed_students', email);
          batch.set(studentRef, { tenantId: tenantId }); 
        });

        await batch.commit();
        setUploadMessage({ text: `Success! ${emailsToUpload.slice(0, 500).length} students onboarded.`, type: 'success' });
        setCsvFile(null);
        setTimeout(() => setShowUploadModal(false), 2000);
      } catch (error) {
        setUploadMessage({ text: 'Database error. Check console.', type: 'error' });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(csvFile);
  };

  const handleExportCurriculumReport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert(`Curriculum Alignment Report generated for Cohort: ${tenantId.toUpperCase()}`);
    }, 1500);
  };

  const getScoreColor = (score) => {
    if (score >= 75) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-rose-400'; 
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#04060d] flex items-center justify-center">
        <Activity className="text-indigo-500 animate-spin w-12 h-12" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#04060d] flex flex-col items-center justify-center p-4">
        <AlertCircle className="text-rose-500 w-16 h-16 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Dashboard Error</h2>
        <p className="text-slate-400 text-center max-w-md mb-6">{errorMsg}</p>
        <button onClick={() => auth.signOut()} className="px-6 py-2 bg-indigo-600 text-white rounded-lg">Sign Out</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04060d] text-slate-200 font-sans selection:bg-indigo-500/30 overflow-x-hidden flex flex-col relative">
      <style>
        {`
          @keyframes splashFade {
            0%, 60% { opacity: 1; z-index: 100; }
            100% { opacity: 0; z-index: -1; visibility: hidden; }
          }
          @keyframes starEntrance {
            0% { transform: scale(0) rotate(-135deg); opacity: 0; }
            20% { transform: scale(3.5) rotate(0deg); opacity: 1; }
            60% { transform: scale(3.5) rotate(0deg); opacity: 1; }
            100% { transform: translate(-40vw, -45vh) scale(0.5); opacity: 0; }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); filter: blur(4px); }
            to { opacity: 1; transform: translateY(0); filter: blur(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .animate-splash { animation: splashFade 1.6s cubic-bezier(0.65, 0, 0.35, 1) forwards; }
          .animate-star-entrance { animation: starEntrance 1.6s cubic-bezier(0.65, 0, 0.35, 1) forwards; }
          .animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
          .animate-fade-in { animation: fadeIn 1s ease-out forwards; opacity: 0; }
          .delay-100 { animation-delay: 1500ms; }
          .delay-200 { animation-delay: 1600ms; }
          
          /* UPGRADED DUAL-LAYERED GRID - TUNED FOR SLATE */
          .bg-grid-pattern-slate {
            background-image: 
              linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px);
            background-size: 100px 100px, 100px 100px, 20px 20px, 20px 20px;
            transition: background-position 0.1s ease-out;
          }
        `}
      </style>

      {/* --- CINEMATIC SPLASH SCREEN --- */}
      <div className="fixed inset-0 bg-[#04060d] flex items-center justify-center animate-splash pointer-events-none z-[100]">
        <SkillNovaLogo className="w-24 h-24 animate-star-entrance" />
      </div>

      <div className="relative z-10 flex-grow p-8 animate-fade-in-up delay-100">
        <div ref={gridRef} className="fixed inset-0 bg-grid-pattern-slate [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)] pointer-events-none z-0"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[600px] bg-gradient-to-b from-indigo-500/10 to-transparent blur-[120px] rounded-full pointer-events-none z-0 transition-colors duration-1000"></div>
      <div className="max-w-7xl mx-auto">
        
        {/* TOP NAVIGATION & BRANDING */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 border-b border-slate-800 pb-6 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <SkillNovaLogo className="w-8 h-8 drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]" />
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                Enterprise Partner Portal
              </div>
              {isPremium ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                  <Crown size={14} className="text-indigo-400"/> {isTester ? 'QA Bypass Active' : 'Premium Active'}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold uppercase tracking-wider">
                  Free Tier
                </div>
              )}
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter flex items-center gap-3">
              Cohort Intelligence <span className="text-slate-600 font-light">/</span> <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 via-purple-400 to-pink-400 uppercase">{tenantId || 'Unknown'}</span>
            </h1>
            <p className="text-slate-400 mt-2 text-sm">Real-time curriculum alignment and placement probability for your students.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* ADD STUDENTS BUTTON (GATED) */}
            <button 
              onClick={() => isPremium ? setShowUploadModal(true) : setShowUpgradeModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] flex items-center gap-2 hover:scale-105 active:scale-95"
            >
              {!isPremium ? <Lock size={16} className="opacity-70" /> : <UploadCloud size={18} />}
              Add Students
            </button>

            {/* EXPORT BUTTON (GATED) */}
            <button 
              onClick={() => isPremium ? handleExportCurriculumReport() : setShowUpgradeModal(true)}
              disabled={isExporting}
              className="px-5 py-2.5 bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 hover:border-white/20 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 hover:bg-white/5 active:scale-95 shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
            >
              {isExporting ? <Activity size={18} className="animate-spin" /> : (!isPremium ? <Lock size={16} className="opacity-70"/> : <Download size={18} />)}
              {isExporting ? 'Compiling Data...' : 'Export Report'}
            </button>
            <button onClick={() => auth.signOut()} className="px-4 py-2.5 bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 rounded-xl text-sm font-medium transition-all active:scale-95 shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
              Sign Out
            </button>
          </div>
        </div>
        
        {/* PREMIUM UPGRADE BANNER (Free Tier Only) */}
        {!isPremium && (
          <div className="mb-12 p-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8 hover:scale-[1.01] shadow-[0_0_50px_rgba(99,102,241,0.2)] border border-white/20 transition-all duration-500 animate-fade-in relative overflow-hidden group">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAzNHYtNGgtdjRoLTh2NGgtdjRoLTh2NGgtdjRoLTh2NGgtdjRoOHY0aDR2NGg4djRoNHY0aDh2NGg0di00aDR2LTRoNHYtNGg0di00aDR2LTRoNHYtNGgtNHYtNGgtNHYtNGgtNHYtNGgtOHptLTggMTR2LTRoLTh2NGg4em0tMTYtOHYtNGgtOHY0aDh6IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz48L2c+PC9zdmc+')] opacity-30"></div>
            <div className="flex items-center gap-6 relative z-10">
              <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner border border-white/20 group-hover:rotate-12 transition-transform duration-500">
                <Sparkles className="text-white" size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white tracking-tighter">Scale your cohort with Premium</h3>
                <p className="text-indigo-100 font-medium opacity-80">Unlock bulk onboarding, deep analytics, and advanced placement tracking.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowUpgradeModal(true)}
              className="relative z-10 px-8 py-4 bg-white text-indigo-600 font-black rounded-2xl hover:bg-slate-100 transition-all shadow-xl whitespace-nowrap hover:scale-105 active:scale-95 uppercase tracking-widest text-sm"
            >
              Explore Enterprise
            </button>
          </div>
        )}

        {/* METRICS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#0a0f1c]/60 backdrop-blur-2xl border border-white/10 p-6 rounded-3xl flex justify-between items-center transition-all duration-500 group hover:scale-105 hover:border-indigo-500/50 hover:shadow-[0_0_40px_rgba(99,102,241,0.1)]">
            <div><p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Active Students</p><h4 className="text-4xl font-black text-white tracking-tighter">{stats.uniqueStudents}</h4></div>
            <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20 transition-all duration-500 group-hover:bg-indigo-500/20 group-hover:-translate-y-1 shadow-inner"><Users className="text-indigo-400" size={24} /></div>
          </div>

          <div className="bg-[#0a0f1c]/60 backdrop-blur-2xl border border-white/10 p-6 rounded-3xl flex justify-between items-center transition-all duration-500 group hover:scale-105 hover:border-purple-500/50 hover:shadow-[0_0_40px_rgba(168,85,247,0.1)]">
            <div><p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Resume Scans</p><h4 className="text-4xl font-black text-white tracking-tighter">{stats.totalScans}</h4></div>
            <div className="bg-purple-500/10 p-4 rounded-2xl border border-purple-500/20 transition-all duration-500 group-hover:bg-purple-500/20 group-hover:-translate-y-1 shadow-inner"><FileText className="text-purple-400" size={24} /></div>
          </div>

          {/* GATED METRIC: READINESS */}
          <div className={`bg-[#0a0f1c]/60 backdrop-blur-2xl border border-white/10 p-6 rounded-3xl flex justify-between items-center relative overflow-hidden group cursor-pointer transition-all duration-500 ${isPremium ? 'hover:scale-105 hover:border-emerald-500/50 hover:shadow-[0_0_40px_rgba(16,185,129,0.1)]' : 'hover:scale-[1.02] hover:border-white/5'}`} onClick={() => !isPremium && setShowUpgradeModal(true)}>
            <div className={`transition-all duration-500 ${!isPremium ? 'blur-md opacity-20' : ''}`}>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Avg. Readiness</p>
              <h4 className={`text-4xl font-black tracking-tighter ${getScoreColor(stats.avgMatchScore)}`}>{stats.avgMatchScore}%</h4>
            </div>
            <div className={`p-4 rounded-2xl border transition-all duration-500 shadow-inner ${!isPremium ? 'bg-white/5 border-white/10' : 'bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-500/20 group-hover:-translate-y-1'}`}>
              <Target className={!isPremium ? 'text-slate-500' : 'text-emerald-400'} size={24} />
            </div>
            {!isPremium && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><Lock className="text-indigo-400 group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" size={32}/></div>}
          </div>

          {/* GATED METRIC: PLACEMENT */}
          <div className={`bg-[#0a0f1c]/60 backdrop-blur-2xl border border-white/10 p-6 rounded-3xl flex justify-between items-center relative overflow-hidden group cursor-pointer transition-all duration-500 ${isPremium ? 'hover:scale-105 hover:border-blue-500/50 hover:shadow-[0_0_40px_rgba(59,130,246,0.1)]' : 'hover:scale-[1.02] hover:border-white/5'}`} onClick={() => !isPremium && setShowUpgradeModal(true)}>
            <div className={`transition-all duration-500 ${!isPremium ? 'blur-md opacity-20' : ''}`}>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Placement Prob.</p>
              <h4 className="text-4xl font-black text-white tracking-tighter">{stats.passRate}%</h4>
            </div>
            <div className={`p-4 rounded-2xl border transition-all duration-500 shadow-inner ${!isPremium ? 'bg-white/5 border-white/10' : 'bg-blue-500/10 border-blue-500/20 group-hover:bg-blue-500/20 group-hover:-translate-y-1'}`}>
              <TrendingUp className={!isPremium ? 'text-slate-500' : 'text-blue-400'} size={24} />
            </div>
            {!isPremium && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><Lock className="text-indigo-400 group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" size={32}/></div>}
          </div>
        </div>

        {/* EXTRA INSIGHTS CARDS (Top Roles & At-Risk) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <div className={`bg-[#0a0f1c]/60 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl relative overflow-hidden group cursor-pointer transition-all duration-500 ${isPremium ? 'hover:scale-[1.02] hover:border-indigo-500/50 hover:shadow-[0_0_40px_rgba(99,102,241,0.1)]' : 'hover:scale-[1.01] hover:border-white/5'}`} onClick={() => !isPremium && setShowUpgradeModal(true)}>
            <div className={`transition-all duration-500 ${!isPremium ? 'blur-md opacity-20' : ''}`}>
              <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3 tracking-tighter uppercase"><Briefcase className="text-indigo-400" size={24} /> Top Targeted Roles</h3>
              <div className="grid grid-cols-1 gap-4">
                {stats.topRoles.length > 0 ? stats.topRoles.map((role, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all duration-300">
                    <span className="text-sm font-bold text-slate-200 truncate max-w-[70%] tracking-tight">{role.name}</span>
                    <span className="text-xs font-black text-indigo-400 bg-indigo-400/10 px-3 py-1 rounded-full">{role.count} <span className="hidden sm:inline">Students</span></span>
                  </div>
                )) : (
                  <div className="text-slate-500 text-sm py-4 italic">No role data available yet.</div>
                )}
              </div>
            </div>
            {!isPremium && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10">
                <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                  <Lock className="text-indigo-400 w-8 h-8" />
                </div>
                <span className="text-xs font-black text-indigo-300 uppercase tracking-widest bg-indigo-400/10 px-4 py-1.5 rounded-full backdrop-blur-md">Premium Insights Locked</span>
              </div>
            )}
          </div>

          <div className={`bg-[#0a0f1c]/60 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl relative overflow-hidden group cursor-pointer transition-all duration-500 ${isPremium ? 'hover:scale-[1.02] hover:border-rose-500/50 hover:shadow-[0_0_40px_rgba(244,63,94,0.1)]' : 'hover:scale-[1.01] hover:border-white/5'}`} onClick={() => !isPremium && setShowUpgradeModal(true)}>
            <div className={`transition-all duration-500 ${!isPremium ? 'blur-md opacity-20' : ''}`}>
              <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3 tracking-tighter uppercase"><AlertTriangle className="text-rose-400 group-hover:animate-pulse" size={24} /> At-Risk Students</h3>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="text-6xl font-black text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.3)]">{stats.atRiskCount}</div>
                <div className="text-sm text-slate-400 leading-relaxed font-medium">Students scored below <span className="text-rose-400 font-bold">35%</span> and need immediate curriculum intervention.</div>
              </div>
              <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Target threshold: 35%</span>
                {isPremium && (
                  <button 
                    onClick={() => setStatusFilter('fail')}
                    className="text-xs font-black text-indigo-400 hover:text-white uppercase tracking-widest flex items-center gap-2 group/btn"
                  >
                    View Roster <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform"/>
                  </button>
                )}
              </div>
            </div>
            {!isPremium && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10">
                <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
                  <Lock className="text-rose-400 w-8 h-8" />
                </div>
                <span className="text-xs font-black text-rose-300 uppercase tracking-widest bg-rose-400/10 px-4 py-1.5 rounded-full backdrop-blur-md">Premium Gating Active</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* LEFT SIDEBAR: CURRICULUM INSIGHTS (GATED) */}
          <div className="xl:col-span-1 space-y-8">
            <div className="bg-[#0a0f1c]/60 backdrop-blur-3xl border border-white/10 p-8 rounded-3xl flex flex-col relative overflow-hidden h-full min-h-[450px] shadow-2xl">
              
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none z-0"><BookOpen size={120} /></div>
              
              <h3 className="text-xl font-black text-white mb-2 flex items-center gap-3 tracking-tighter uppercase relative z-10"><AlertCircle className="text-rose-400" size={24} /> Curriculum Gaps</h3>
              <p className="text-sm font-medium text-slate-400 mb-10 relative z-10">Technologies your students are consistently missing based on current market demands.</p>
              
              {/* THE PAYWALL BLUR */}
              <div className={`space-y-8 relative z-10 flex-grow transition-all duration-700 ${!isPremium ? 'blur-[8px] opacity-20 select-none pointer-events-none' : ''}`}>
                {stats.topGaps.length > 0 ? stats.topGaps.map((gap, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-3"><span className="font-bold text-rose-300 tracking-tight">{gap.name}</span><span className="text-slate-400 font-bold">{gap.percentage}% of students miss this</span></div>
                    <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden border border-white/5 shadow-inner"><div className="bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 h-full rounded-full transition-all duration-1000" style={{ width: `${gap.percentage}%` }}></div></div>
                  </div>
                )) : (
                  <div className="text-slate-500 text-center py-12 text-sm italic">No gap data collected yet.</div>
                )}
                
                {/* Dummy data for the blur effect if empty */}
                {!isPremium && stats.topGaps.length === 0 && (
                   <>
                     <div><div className="flex justify-between text-sm mb-3"><span className="font-bold text-rose-300">React.js</span></div><div className="w-full bg-white/5 rounded-full h-2.5"><div className="bg-rose-500 h-2.5 rounded-full w-[80%]"></div></div></div>
                     <div><div className="flex justify-between text-sm mb-3"><span className="font-bold text-rose-300">Docker</span></div><div className="w-full bg-white/5 rounded-full h-2.5"><div className="bg-orange-500 h-2.5 rounded-full w-[60%]"></div></div></div>
                     <div><div className="flex justify-between text-sm mb-3"><span className="font-bold text-rose-300">AWS</span></div><div className="w-full bg-white/5 rounded-full h-2.5"><div className="bg-amber-500 h-2.5 rounded-full w-[40%]"></div></div></div>
                   </>
                )}
              </div>

              {/* PAYWALL OVERLAY */}
              {!isPremium && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[4px] border border-white/10 p-8 text-center group cursor-pointer hover:bg-black/40 transition-all duration-500" onClick={() => setShowUpgradeModal(true)}>
                  <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(99,102,241,0.3)] group-hover:scale-110 transition-transform border border-indigo-500/30">
                    <Lock className="text-indigo-400 w-10 h-10" />
                  </div>
                  <h4 className="text-2xl font-black text-white mb-3 tracking-tighter uppercase">Enterprise Only</h4>
                  <p className="text-sm font-medium text-slate-300 mb-8 leading-relaxed max-w-[240px]">Upgrade your cohort to SkillNova Enterprise to reveal deep curriculum gaps and precise hiring analytics.</p>
                  <button className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black rounded-2xl text-sm shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-all w-full group-hover:shadow-indigo-500/60 uppercase tracking-widest">
                    Unlock Premium
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: STUDENT ROSTER */}
          <div className="xl:col-span-2 bg-[#0a0f1c]/60 backdrop-blur-3xl border border-white/10 p-8 rounded-3xl flex flex-col transition-all duration-500 hover:border-white/20 shadow-2xl">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
              <h3 className="text-2xl font-black text-white flex items-center gap-3 tracking-tighter uppercase"><Users className="text-blue-400" /> Cohort Feed</h3>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                <div className="relative flex-grow lg:w-80 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search students or roles..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-500 font-medium"
                  />
                </div>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-slate-300 outline-none focus:border-indigo-500/50 transition-all font-bold cursor-pointer w-full sm:w-auto"
                >
                  <option value="all">All Status</option>
                  <option value="pass">Pass Only</option>
                  <option value="fail">Fail Only</option>
                </select>
              </div>
            </div>
            
            <div className="overflow-x-auto overflow-y-auto max-h-[650px] pr-2 custom-scrollbar">
              <table className="w-full text-left table-fixed border-separate border-spacing-0 relative">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-[#04060d]/95 backdrop-blur-xl text-slate-400 text-[11px] uppercase tracking-[0.2em] font-black shadow-xl">
                    <th className="py-5 pl-6 w-[35%] rounded-tl-2xl border-b border-white/5">Student Entity</th>
                    <th className="py-5 pr-2 w-[25%] border-b border-white/5">Specialization</th>
                    {isPremium && (
                      <>
                        <th className="py-5 pr-2 w-[12%] border-b border-white/5">Match</th>
                        <th className="py-5 pr-2 w-[12%] border-b border-white/5">ATS</th>
                      </>
                    )}
                    <th className="py-5 pr-6 w-[16%] rounded-tr-2xl border-b border-white/5">Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {scans
                    .filter(scan => {
                      const matchesSearch = scan.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                            scan.targetRole?.toLowerCase().includes(searchTerm.toLowerCase());
                      const score = scan.roleMatchScore || scan.score || 0;
                      const matchesStatus = statusFilter === 'all' || 
                                            (statusFilter === 'pass' && score >= 60) || 
                                            (statusFilter === 'fail' && score < 60);
                      return matchesSearch && matchesStatus;
                    })
                    .map((scan) => {
                      const score = scan.roleMatchScore || scan.score || 0;
                      return (
                        <tr key={scan.id} className="hover:bg-white/5 transition-all cursor-pointer group">
                          <td className="py-5 pl-6 pr-2 border-b border-white/5">
                            <div className="font-bold text-slate-200 truncate group-hover:text-indigo-400 transition-colors tracking-tight text-sm">{scan.userEmail}</div>
                            <div className="text-[10px] font-black text-slate-500 mt-1 uppercase tracking-widest">{scan.timestamp ? new Date(scan.timestamp.toDate()).toLocaleDateString() : 'Just now'}</div>
                          </td>
                          <td className="py-5 pr-2 border-b border-white/5">
                            <span className="text-xs font-black text-indigo-300 border border-indigo-500/20 bg-indigo-500/5 px-2.5 py-1 rounded-lg uppercase tracking-tight truncate block w-fit">{scan.targetRole || "Unknown Role"}</span>
                          </td>
                          {isPremium && (
                            <>
                              <td className={`py-5 pr-2 border-b border-white/5 text-sm font-black ${getScoreColor(score)}`}>
                                {score}%
                              </td>
                              <td className={`py-5 pr-2 border-b border-white/5 text-sm font-black ${getScoreColor(scan.atsFormatScore || 0)}`}>
                                {scan.atsFormatScore || 0}%
                              </td>
                            </>
                          )}
                          <td className="py-5 pr-6 border-b border-white/5">
                            {score >= 60 ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-500/20 uppercase tracking-widest"><CheckCircle size={14} /> Pass</span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-500/20 uppercase tracking-widest"><AlertCircle size={14} /> Fail</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  {scans.length === 0 && (
                    <tr><td colSpan={isPremium ? 5 : 3} className="py-16 text-center text-slate-500 font-medium italic">No students in this cohort have synchronized data yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* --- UPGRADE TO PREMIUM MODAL --- */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0a0f1c] border border-white/10 rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col relative animate-fade-in-up">
            
            <button onClick={() => setShowUpgradeModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors z-10 bg-white/5 p-2 rounded-full"><X size={20} /></button>
            
            <div className="p-10 text-center">
              <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(99,102,241,0.4)] group-hover:rotate-12 transition-transform duration-500 border border-white/20">
                <Crown className="text-white w-12 h-12" />
              </div>
              <h2 className="text-3xl font-black text-white mb-4 tracking-tighter uppercase">Unlock Enterprise</h2>
              <p className="text-slate-400 font-medium mb-8 leading-relaxed">Your institution is currently on the basic Free Tier. Upgrade to Enterprise Premium to unlock powerful talent identification tools.</p>
              
              <ul className="text-left text-sm text-slate-200 space-y-4 mb-10 bg-white/5 p-6 rounded-3xl border border-white/10">
                <li className="flex items-center gap-3 font-bold"><CheckCircle className="text-emerald-400" size={20}/> CSV Bulk Student Upload</li>
                <li className="flex items-center gap-3 font-bold"><CheckCircle className="text-emerald-400" size={20}/> Deep Curriculum Gap Analytics</li>
                <li className="flex items-center gap-3 font-bold"><CheckCircle className="text-emerald-400" size={20}/> Placement Probability Metrics</li>
                <li className="flex items-center gap-3 font-bold"><CheckCircle className="text-emerald-400" size={20}/> Downloadable Pivot Reports</li>
              </ul>

              <button onClick={() => {setShowUpgradeModal(false); alert("Enterprise sales team notified!");}} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black py-4 px-6 rounded-2xl shadow-xl transition-all flex justify-center items-center gap-3 uppercase tracking-widest text-sm hover:scale-105 active:scale-95">
                Contact Sales Hub <ArrowRight size={20}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CSV UPLOAD MODAL --- */}
      {showUploadModal && isPremium && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
           <div className="bg-[#0a0f1c] border border-white/10 rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">
             <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/5 backdrop-blur-md">
               <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tighter uppercase"><UploadCloud className="text-indigo-400" /> Roster Provisioning</h3>
               <button onClick={() => setShowUploadModal(false)} className="text-slate-500 hover:text-rose-400 transition-colors bg-white/5 p-2 rounded-full"><X size={20} /></button>
             </div>
             
             <div className="p-10">
               <p className="text-sm font-medium text-slate-400 mb-8 leading-relaxed">Securely upload a CSV containing student emails. They will instantly receive premium access tied to <strong className="text-indigo-400 font-black uppercase tracking-widest">{tenantId}</strong>.</p>
               
               <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-12 cursor-pointer transition-all duration-500 ${csvFile ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:border-indigo-500/30'}`}>
                 <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                 {csvFile ? (
                   <div className="text-center"><CheckCircle className="text-emerald-500 w-16 h-16 mx-auto mb-4 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]"/><p className="text-emerald-400 text-lg font-black tracking-tight">{csvFile.name}</p></div>
                 ) : (
                   <div className="text-center"><UploadCloud className="text-slate-500 w-16 h-16 mx-auto mb-4"/><p className="text-slate-200 text-lg font-black tracking-tight mb-1">Select Student Roster</p><p className="text-xs text-slate-500 font-bold uppercase tracking-widest">CSV format required</p></div>
                 )}
               </label>

               {uploadMessage.text && (
                 <div className={`mt-8 text-xs font-black p-4 rounded-2xl animate-fade-in-up ${uploadMessage.type === 'error' ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20' : uploadMessage.type === 'success' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20'}`}>
                   {uploadMessage.text}
                 </div>
               )}
             </div>

             <div className="px-8 py-6 border-t border-white/5 bg-white/5 backdrop-blur-md flex justify-end gap-4">
               <button onClick={() => setShowUploadModal(false)} className="px-6 py-3 text-sm font-black text-slate-400 hover:text-white transition-all uppercase tracking-widest">Cancel</button>
               <button onClick={processBulkUpload} disabled={isUploading || !csvFile} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-8 py-3 rounded-2xl text-sm font-black transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-3 shadow-xl shadow-indigo-500/20 uppercase tracking-widest hover:scale-105 active:scale-95">
                 {isUploading ? <Activity size={18} className="animate-spin" /> : 'Confirm Upload'}
               </button>
             </div>
           </div>
         </div>
      )}

    </div>
  </div>
);
}