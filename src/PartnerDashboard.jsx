import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, Users, Target, TrendingUp, Download, CheckCircle, 
  XCircle, FileText, Activity, BookOpen, AlertCircle, UploadCloud, X, Lock, Crown, ArrowRight, Briefcase, AlertTriangle, Sparkles, Search, Terminal, Circle 
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


// --- RADIAL PROGRESS COMPONENT ---
const RadialProgress = ({ percentage, colorClass, size = 140, strokeWidth = 14, label, subLabel }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="flex flex-col items-center justify-center group pointer-events-auto">
      <div className="relative inline-flex items-center justify-center group-hover:scale-105 transition-transform duration-500 delay-75" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]" width={size} height={size}>
          <circle cx={size/2} cy={size/2} r={radius} stroke="rgba(255,255,255,0.03)" strokeWidth={strokeWidth} fill="none" />
          <circle cx={size/2} cy={size/2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="none" strokeDasharray={circumference} strokeDashoffset={offset} className={`transition-all duration-1500 ease-out ${colorClass}`} strokeLinecap="round" />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-white tracking-tighter" style={{ textShadow: '0 0 20px currentColor' }}>{percentage}%</span>
        </div>
      </div>
      {(label || subLabel) && (
        <div className="mt-4 text-center">
          {label && <p className="text-sm font-black text-white tracking-widest uppercase">{label}</p>}
          {subLabel && <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{subLabel}</p>}
        </div>
      )}
    </div>
  );
};

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
        <button onClick={() => auth.signOut()} className="px-6 py-2 bg-amber-600 text-white rounded-lg">Sign Out</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04060d] text-slate-200 font-sans selection:bg-amber-500/30 overflow-x-hidden flex flex-col relative">
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
            from { opacity: 0; transform: translateY(40px) scale(0.95); filter: blur(10px); }
            to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes floatAnimation {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(5%, 5%) scale(1.05); }
            66% { transform: translate(-2%, 8%) scale(0.95); }
          }
          @keyframes neonPulse {
            0%, 100% { border-color: rgba(245,158,11,0.2); box-shadow: 0 0 20px rgba(245,158,11,0.0); }
            50% { border-color: rgba(245,158,11,0.6); box-shadow: 0 0 40px rgba(245,158,11,0.2); }
          }

          .animate-splash { animation: splashFade 1.6s cubic-bezier(0.65, 0, 0.35, 1) forwards; }
          .animate-star-entrance { animation: starEntrance 1.6s cubic-bezier(0.65, 0, 0.35, 1) forwards; }
          .animate-fade-in-up { animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
          .animate-fade-in { animation: fadeIn 1s ease-out forwards; opacity: 0; }
          .animate-pulse-slow { animation: floatAnimation 25s ease-in-out infinite; }
          .animate-neon { animation: neonPulse 3s infinite; }
          
          .delay-100 { animation-delay: 1500ms; }
          .delay-200 { animation-delay: 1600ms; }
          .delay-300 { animation-delay: 1700ms; }
          
          /* ULTRA DUAL-LAYERED GRID */
          .bg-grid-pattern-slate {
            background-image: 
              linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(to right, rgba(255,255,255,0.01) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.01) 1px, transparent 1px);
            background-size: 120px 120px, 120px 120px, 30px 30px, 30px 30px;
            transition: background-position 0.1s ease-out;
          }

          /* 3D PERSPECTIVE CLASSES */
          .perspective-1000 { perspective: 1000px; }
          .card-3d { transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
          .perspective-1000:hover .card-3d { transform: rotateX(2deg) rotateY(-2deg) scale(1.02); }
        `}
      </style>

      {/* --- CINEMATIC SPLASH SCREEN --- */}
      <div className="fixed inset-0 bg-[#04060d] flex items-center justify-center animate-splash pointer-events-none z-[100]">
        <SkillNovaLogo className="w-24 h-24 animate-star-entrance drop-shadow-[0_0_30px_rgba(245,158,11,0.8)]" />
      </div>

      {/* --- ATMOSPHERIC BACKGROUND --- */}
      <div ref={gridRef} className="fixed inset-0 bg-grid-pattern-slate [mask-image:radial-gradient(ellipse_at_top,black,transparent_80%)] pointer-events-none z-0"></div>
      
      {/* Drifting Orbs */}
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-amber-600/10 blur-[150px] animate-pulse-slow pointer-events-none z-0"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-orange-600/10 blur-[150px] animate-pulse-slow delay-1000 pointer-events-none z-0"></div>
      
      {/* Torch Cursor Effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[800px] bg-gradient-to-b from-amber-500/15 via-orange-500/5 to-transparent blur-[150px] rounded-full pointer-events-none z-0 transition-colors duration-1000 mix-blend-screen opacity-70"></div>

      {/* --- FLOATING PILL NAVIGATION --- */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl z-50 animate-fade-in-up delay-100">
        <div className="bg-[#0a0f1c]/70 backdrop-blur-3xl border border-white/10 p-3 pl-6 pr-4 rounded-full flex flex-col md:flex-row justify-between items-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all hover:border-amber-500/30 group">
          <div className="flex items-center gap-4">
            <SkillNovaLogo className="w-8 h-8 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)] group-hover:scale-110 transition-transform" />
            <div className="h-6 w-px bg-white/10 hidden md:block"></div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter flex items-center gap-2">
              Cohort Intelligence <span className="text-amber-500/50">/</span> <span className="text-transparent bg-clip-text bg-gradient-to-br from-amber-300 to-orange-500 uppercase">{tenantId || 'Unknown'}</span>
            </h1>
            <div className="hidden lg:flex items-center gap-2 ml-4">
               {isPremium ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                  <Crown size={12} className="text-amber-400"/> {isTester ? 'QA Bypass' : 'Premium'}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  Free Tier
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <button 
              onClick={() => isPremium ? setShowUploadModal(true) : setShowUpgradeModal(true)}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-full text-xs font-black transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] flex items-center gap-2 hover:scale-105 active:scale-95 uppercase tracking-widest"
            >
              {!isPremium ? <Lock size={14} className="opacity-70" /> : <UploadCloud size={16} />}
              Onboard
            </button>
            <button 
              onClick={() => isPremium ? handleExportCurriculumReport() : setShowUpgradeModal(true)}
              disabled={isExporting}
              className="w-10 h-10 flex flex-col justify-center items-center bg-white/5 backdrop-blur-xl border border-white/10 hover:border-white/20 text-white rounded-full transition-all hover:bg-white/10 active:scale-95 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              title="Export Report"
            >
              {isExporting ? <Activity size={16} className="animate-spin" /> : (!isPremium ? <Lock size={14} className="opacity-70 text-slate-400"/> : <Download size={16} className="text-slate-300" />)}
            </button>
            <div className="h-6 w-px bg-white/10 hidden md:block mx-1"></div>
            <button onClick={() => auth.signOut()} className="w-10 h-10 bg-white/5 backdrop-blur-xl border border-white/10 hover:border-rose-500/30 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 flex flex-col items-center justify-center rounded-full transition-all active:scale-95">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT START --- */}
      <div className="relative z-10 flex-grow px-4 md:px-8 pt-40 pb-20 max-w-[1400px] mx-auto w-full animate-fade-in-up delay-200">
        
        {/* PREMIUM UPGRADE BANNER (Free Tier Only) */}
        {!isPremium && (
          <div className="mb-10 p-1 bg-gradient-to-r from-amber-500/50 via-orange-500/50 to-rose-500/50 rounded-[2.5rem] relative group perspective-1000">
            <div className="card-3d p-8 bg-[#0a0f1c]/90 backdrop-blur-3xl rounded-[2.4rem] flex flex-col md:flex-row items-center justify-between gap-8 border border-white/10 transition-all overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent pointer-events-none"></div>
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.4)] group-hover:rotate-12 transition-transform duration-500 text-white border border-white/20">
                  <Sparkles size={32} />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white tracking-tighter uppercase mb-1">Unlock Enterprise Scale</h3>
                  <p className="text-amber-200/80 font-medium text-sm">Activate deep analytics, placement probabilities, and bulk cohort onboarding.</p>
                </div>
              </div>
              <button onClick={() => setShowUpgradeModal(true)} className="relative z-10 px-8 py-4 bg-white text-orange-600 font-black rounded-2xl hover:bg-slate-100 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] whitespace-nowrap hover:scale-105 active:scale-95 uppercase tracking-widest text-xs">
                Explore Premium
              </button>
            </div>
          </div>
        )}

        {/* --- HIGH-IMPACT BENTO BOX METRICS --- */}
        <div className="grid grid-cols-1 md:grid-cols-12 md:grid-rows-2 gap-6 mb-10">
          
          {/* CENTERPIECE: AVERAGE READINESS (Row Span 2, Col Span 6) */}
          <div className="md:col-span-6 md:row-span-2 relative perspective-1000 group cursor-pointer" onClick={() => !isPremium && setShowUpgradeModal(true)}>
            <div className="card-3d bg-[#0a0f1c]/40 backdrop-blur-2xl border border-white/10 hover:border-emerald-500/30 rounded-[2.5rem] p-10 h-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col justify-between overflow-hidden relative group-hover:shadow-[0_20px_60px_rgba(16,185,129,0.15)] transition-all">
              
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] group-hover:bg-emerald-500/20 transition-all pointer-events-none"></div>
              
              <div className={`relative z-10 transition-all duration-700 ${!isPremium ? 'blur-md opacity-20' : ''}`}>
                <div className="flex justify-between items-start mb-8">
                  <div>
                     <p className="text-emerald-400 text-xs font-black uppercase tracking-[0.3em] mb-3 flex items-center gap-2"><Target size={16}/> Readiness Core</p>
                     <h3 className="text-4xl font-black text-white tracking-tighter">Cohort Average</h3>
                  </div>
                </div>
                
                <div className="flex justify-center my-6">
                  <RadialProgress percentage={stats.avgMatchScore} colorClass={getScoreColor(stats.avgMatchScore)} size={220} strokeWidth={18} label="Alignment Match" subLabel="vs Real Market Jobs" />
                </div>
              </div>

              {!isPremium && <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-20"><div className="bg-black/60 p-6 rounded-full border border-white/10 group-hover:scale-110 transition-transform"><Lock className="text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.8)]" size={40}/></div></div>}
            </div>
          </div>

          {/* AT RISK (Row Span 2, Col Span 3) */}
          <div className="md:col-span-3 md:row-span-2 relative perspective-1000 group cursor-pointer" onClick={() => !isPremium && setShowUpgradeModal(true)}>
            <div className="card-3d bg-[#0a0f1c]/40 backdrop-blur-2xl border border-white/10 hover:border-rose-500/40 rounded-[2rem] p-8 h-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col justify-between overflow-hidden relative group-hover:shadow-[0_0_40px_rgba(244,63,94,0.15)] transition-all animate-neon">
              
              <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-rose-500/10 to-transparent pointer-events-none"></div>
              
              <div className={`relative z-10 flex flex-col h-full transition-all duration-700 ${!isPremium ? 'blur-md opacity-20' : ''}`}>
                <div>
                   <p className="text-rose-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><AlertTriangle size={14}/> Intervention Needed</p>
                   <h3 className="text-lg font-black text-white tracking-tighter uppercase line-clamp-2">At-Risk Students</h3>
                </div>
                <div className="flex-grow flex flex-col items-center justify-center mt-4">
                   <div className="text-[5rem] leading-none font-black text-rose-500 drop-shadow-[0_0_25px_rgba(244,63,94,0.4)] group-hover:scale-110 transition-transform">{stats.atRiskCount}</div>
                   <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4 text-center">Score &lt; 35% Threshold</div>
                </div>
              </div>

              {!isPremium && <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-20"><div className="bg-black/60 p-4 rounded-full border border-white/10"><Lock className="text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]" size={24}/></div></div>}
            </div>
          </div>

          {/* ACTIVE STUDENTS (Row Span 1, Col Span 3) */}
          <div className="md:col-span-3 md:row-span-1 relative perspective-1000 group">
            <div className="card-3d bg-[#0a0f1c]/50 backdrop-blur-xl border border-white/10 hover:border-blue-500/30 rounded-[2rem] p-6 h-full shadow-xl flex justify-between items-center overflow-hidden transition-all group-hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]">
               <div>
                 <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Headcount</p>
                 <h4 className="text-4xl font-black text-white tracking-tighter">{stats.uniqueStudents}</h4>
               </div>
               <div className="bg-blue-500/10 p-4 rounded-full border border-blue-500/20 shadow-inner group-hover:rotate-12 transition-transform"><Users className="text-blue-400" size={24} /></div>
            </div>
          </div>

          {/* RESUME SCANS (Row Span 1, Col Span 3) */}
          <div className="md:col-span-3 md:row-span-1 relative perspective-1000 group">
             <div className="card-3d bg-[#0a0f1c]/50 backdrop-blur-xl border border-white/10 hover:border-purple-500/30 rounded-[2rem] p-6 h-full shadow-xl flex justify-between items-center overflow-hidden transition-all group-hover:shadow-[0_0_30px_rgba(168,85,247,0.1)]">
               <div>
                 <p className="text-purple-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Data Points</p>
                 <h4 className="text-4xl font-black text-white tracking-tighter">{stats.totalScans}</h4>
               </div>
               <div className="bg-purple-500/10 p-4 rounded-full border border-purple-500/20 shadow-inner group-hover:-rotate-12 transition-transform"><FileText className="text-purple-400" size={24} /></div>
            </div>
          </div>
        </div>

        {/* --- ISLANDS GRID: ROSTER & INSIGHTS --- */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* HOLOGRAPHIC ROSTER TABLE (Span 2) */}
          <div className="xl:col-span-2 relative perspective-1000 group">
            <div className="card-3d bg-[#0a0f1c]/40 backdrop-blur-3xl border border-white/10 p-8 rounded-[2.5rem] flex flex-col h-full shadow-[0_30px_60px_rgba(0,0,0,0.6)] transition-all hover:border-white/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-full h-[150px] bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none"></div>

              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6 relative z-10">
                <h3 className="text-2xl font-black text-white flex items-center gap-3 tracking-tighter uppercase"><TrendingUp className="text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.6)]" size={28}/> Holographic Roster</h3>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                  <div className="relative flex-grow lg:w-80 w-full group/search">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/search:text-amber-400 transition-colors" size={16} />
                    <input 
                      type="text" 
                      placeholder="Search entities..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-amber-500/50 focus:bg-white/10 transition-all placeholder:text-slate-500 uppercase tracking-widest shadow-inner"
                    />
                  </div>
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-full py-2.5 px-6 text-xs text-slate-300 outline-none focus:border-amber-500/50 transition-all font-black uppercase tracking-widest cursor-pointer w-full sm:w-auto appearance-none text-center"
                  >
                    <option className="bg-[#0a0f1c] text-white" value="all">Global View</option>
                    <option className="bg-[#0a0f1c] text-white" value="pass">Passed Tier</option>
                    <option className="bg-[#0a0f1c] text-white" value="fail">Failed Tier</option>
                  </select>
                </div>
              </div>
              
              <div className="overflow-x-auto overflow-y-auto max-h-[500px] pr-2 custom-scrollbar relative z-10">
                <table className="w-full text-left table-fixed border-collapse">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-[#04060d]/95 backdrop-blur-2xl text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black border-b border-white/10 shadow-xl">
                      <th className="py-5 pl-6 w-[35%] rounded-tl-3xl border-none">Entity Identity</th>
                      <th className="py-5 pr-2 w-[25%] border-none">Operational Role</th>
                      {isPremium && (
                        <>
                          <th className="py-5 pr-2 w-[12%] border-none">Sync</th>
                          <th className="py-5 pr-2 w-[12%] border-none">Format</th>
                        </>
                      )}
                      <th className="py-5 pr-6 w-[16%] rounded-tr-3xl border-none text-right">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="space-y-2 relative">
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
                          <tr key={scan.id} className="group hover:bg-white/5 transition-all outline-none rounded-2xl relative block w-full table-row">
                            <td className="py-4 pl-6 pr-2 border-b border-white/5 group-hover:border-transparent rounded-l-2xl">
                              <div className="font-bold text-slate-200 truncate group-hover:text-amber-400 group-hover:translate-x-2 transition-all tracking-tight text-sm drop-shadow-md">{scan.userEmail}</div>
                              <div className="text-[9px] font-black text-slate-600 mt-1 uppercase tracking-widest group-hover:translate-x-2 transition-all flex items-center gap-1"><Activity size={10}/> {scan.timestamp ? new Date(scan.timestamp.toDate()).toLocaleDateString() : 'Active'}</div>
                            </td>
                            <td className="py-4 pr-2 border-b border-white/5 group-hover:border-transparent">
                              <span className="text-[10px] font-black text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-full uppercase tracking-widest truncate block w-fit border border-amber-500/20 shadow-inner group-hover:shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-shadow">{scan.targetRole || "Unknown"}</span>
                            </td>
                            {isPremium && (
                              <>
                                <td className={`py-4 pr-2 border-b border-white/5 group-hover:border-transparent text-sm font-black ${getScoreColor(score)}`}>
                                  <span className="drop-shadow-[0_0_8px_currentColor]">{score}%</span>
                                </td>
                                <td className={`py-4 pr-2 border-b border-white/5 group-hover:border-transparent text-sm font-black ${getScoreColor(scan.atsFormatScore || 0)}`}>
                                   <span className="drop-shadow-[0_0_8px_currentColor]">{scan.atsFormatScore || 0}%</span>
                                </td>
                              </>
                            )}
                            <td className="py-4 pr-6 border-b border-white/5 group-hover:border-transparent rounded-r-2xl text-right">
                              {score >= 60 ? (
                                <span className="inline-flex flex-col items-end text-[10px] font-black text-emerald-400 tracking-widest uppercase"><CheckCircle size={14} className="mb-1 text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]"/> Authorized</span>
                              ) : (
                                <span className="inline-flex flex-col items-end text-[10px] font-black text-rose-400 tracking-widest uppercase"><XCircle size={14} className="mb-1 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]"/> Denied</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    {scans.length === 0 && (
                      <tr><td colSpan={isPremium ? 5 : 3} className="py-20 text-center text-slate-500 font-bold uppercase tracking-widest text-xs italic opacity-50 block w-full table-cell">Telemetry Stream Empty</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* CURRICULUM GAPS NODE (Span 1) */}
          <div className="xl:col-span-1 relative perspective-1000 group">
             <div className="card-3d bg-[#0a0f1c]/40 backdrop-blur-3xl border border-white/10 p-8 rounded-[2.5rem] flex flex-col h-full shadow-[0_30px_60px_rgba(0,0,0,0.6)] relative overflow-hidden transition-all hover:border-rose-500/30 group-hover:shadow-[0_0_50px_rgba(244,63,94,0.1)]">
               
               <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000 group-hover:rotate-12"><BookOpen size={200} /></div>
               
               <h3 className="text-xl font-black text-white mb-2 flex items-center gap-3 tracking-tighter uppercase relative z-10"><Terminal className="text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.6)]" size={24}/> Network Gaps</h3>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-10 relative z-10">Critical Misses in Cohort</p>

               <div className={`flex flex-col gap-6 relative z-10 flex-grow transition-all duration-700 ${!isPremium ? 'blur-[10px] opacity-20 pointer-events-none' : ''}`}>
                 {stats.topGaps.length > 0 ? stats.topGaps.map((gap, index) => (
                   <div key={index} className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all group/gap">
                     <div className="flex justify-between items-center text-sm mb-3">
                       <span className="font-black text-white tracking-tight uppercase group-hover/gap:text-rose-400 transition-colors flex items-center gap-2"><Circle size={8} className="text-rose-500 fill-rose-500 animate-pulse"/>{gap.name}</span>
                       <span className="text-slate-400 font-bold bg-black/50 px-2 py-1 rounded-lg text-[10px]">{gap.percentage}% Impact</span>
                     </div>
                     <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden shadow-inner"><div className="bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 h-full rounded-full" style={{ width: `${gap.percentage}%` }}></div></div>
                   </div>
                 )) : (
                   <div className="text-slate-500 text-center py-12 text-xs font-bold uppercase tracking-widest italic opacity-50">Node Empty</div>
                 )}

                 {/* Dummy data for the blur effect */}
                 {!isPremium && stats.topGaps.length === 0 && (
                    <>
                      <div className="bg-white/5 p-4 rounded-2xl"><div className="flex justify-between mb-3"><span className="font-black text-rose-300">TensorFlow</span></div><div className="h-1.5 bg-rose-500 w-4/5 rounded-full"></div></div>
                      <div className="bg-white/5 p-4 rounded-2xl"><div className="flex justify-between mb-3"><span className="font-black text-orange-300">Docker</span></div><div className="h-1.5 bg-orange-500 w-3/5 rounded-full"></div></div>
                      <div className="bg-white/5 p-4 rounded-2xl"><div className="flex justify-between mb-3"><span className="font-black text-amber-300">AWS</span></div><div className="h-1.5 bg-amber-500 w-1/3 rounded-full"></div></div>
                    </>
                 )}
               </div>

               {/* PAYWALL OVERLAY */}
               {!isPremium && (
                 <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md border border-white/5 p-8 text-center cursor-pointer group/lock" onClick={() => setShowUpgradeModal(true)}>
                   <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(245,158,11,0.2)] group-hover/lock:scale-110 transition-transform border border-amber-500/20 backdrop-blur-sm relative overflow-hidden">
                     <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 to-transparent"></div>
                     <Lock className="text-amber-400 w-8 h-8 relative z-10 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                   </div>
                   <h4 className="text-xl font-black text-white mb-2 tracking-tighter uppercase drop-shadow-lg">Enterprise Key Required</h4>
                   <p className="text-[10px] font-bold text-slate-400 mb-8 uppercase tracking-widest">Unlock Node Protocol</p>
                   <button className="px-6 py-3 w-full bg-white text-orange-600 font-black rounded-xl text-xs shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all group-hover/lock:shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 uppercase tracking-widest">
                     Activate
                   </button>
                 </div>
               )}
             </div>
          </div>
        </div>

      </div>

      {/* --- UPGRADE TO PREMIUM MODAL --- */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in perspective-1000">
          <div className="bg-[#0a0f1c]/90 backdrop-blur-3xl border border-white/10 rounded-[3rem] w-full max-w-md shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative animate-fade-in-up card-3d">
            
            <button onClick={() => setShowUpgradeModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors z-10 bg-white/5 hover:bg-white/10 p-3 rounded-full hover:rotate-90 active:scale-90"><X size={16} /></button>
            <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500"></div>

            <div className="p-12 text-center relative z-10">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-amber-500/10 blur-[100px] rounded-full pointer-events-none -z-10"></div>
              
              <div className="w-24 h-24 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(245,158,11,0.5)] border border-white/20 animate-neon">
                <Crown className="text-white w-12 h-12" />
              </div>
              <h2 className="text-3xl font-black text-white mb-2 tracking-tighter uppercase drop-shadow-md">Nexus Enterprise</h2>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-8">Access Level: Denied</p>
              
              <ul className="text-left text-xs font-black text-slate-300 space-y-4 mb-10 bg-black/40 backdrop-blur-md p-6 rounded-3xl border border-white/5 shadow-inner uppercase tracking-widest">
                <li className="flex items-center gap-3"><CheckCircle className="text-amber-400" size={16}/> Bulk Holographic Sync</li>
                <li className="flex items-center gap-3"><CheckCircle className="text-amber-400" size={16}/> Node Gap Analytics</li>
                <li className="flex items-center gap-3"><CheckCircle className="text-amber-400" size={16}/> Probability Matrices</li>
              </ul>

              <button onClick={() => {setShowUpgradeModal(false); alert("Enterprise Request Sent.");}} className="w-full bg-white hover:bg-slate-100 text-orange-600 font-black py-4 px-6 rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all flex justify-center items-center gap-3 uppercase tracking-widest text-xs hover:scale-105 active:scale-95">
                Request Protocol <ArrowRight size={16}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CSV UPLOAD MODAL --- */}
      {showUploadModal && isPremium && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in perspective-1000">
           <div className="bg-[#0a0f1c] border border-white/10 rounded-[3rem] w-full max-w-lg shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-fade-in-up card-3d">
             
             <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>

             <div className="px-10 py-8 border-b border-white/5 flex justify-between items-center bg-black/20">
               <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tighter uppercase"><UploadCloud className="text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" /> Entity Uplink</h3>
               <button onClick={() => setShowUploadModal(false)} className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2.5 rounded-full hover:rotate-90"><X size={16} /></button>
             </div>
             
             <div className="p-10 relative z-10">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none -z-10"></div>
               <p className="text-xs font-bold text-slate-400 mb-8 uppercase tracking-widest leading-relaxed text-center">Encrypt payload via CSV formatting. Destination Node: <strong className="text-amber-400">{tenantId}</strong>.</p>
               
               <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-[2.5rem] p-12 cursor-pointer transition-all duration-500 shadow-inner ${csvFile ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-white/10 bg-black/40 hover:border-amber-500/50 hover:bg-white/5'}`}>
                 <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                 {csvFile ? (
                   <div className="text-center animate-fade-in-up"><CheckCircle className="text-emerald-400 w-16 h-16 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]"/><p className="text-white text-sm font-black tracking-widest uppercase">{csvFile.name}</p></div>
                 ) : (
                   <div className="text-center"><UploadCloud className="text-slate-500 w-16 h-16 mx-auto mb-4 transition-transform group-hover:scale-110"/><p className="text-white text-sm font-black tracking-widest uppercase mb-1">Select Payload</p><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">CSV strictly</p></div>
                 )}
               </label>

               {uploadMessage.text && (
                 <div className={`mt-8 text-[10px] font-black p-4 rounded-xl text-center uppercase tracking-widest animate-fade-in-up ${uploadMessage.type === 'error' ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20' : uploadMessage.type === 'success' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'}`}>
                   {uploadMessage.text}
                 </div>
               )}
             </div>

             <div className="px-10 py-6 border-t border-white/5 bg-black/20 flex flex-col sm:flex-row justify-end gap-4">
               <button onClick={() => setShowUploadModal(false)} className="px-6 py-4 text-xs font-black text-slate-400 hover:text-white transition-all uppercase tracking-widest rounded-xl hover:bg-white/5 w-full sm:w-auto text-center">Abort</button>
               <button onClick={processBulkUpload} disabled={isUploading || !csvFile} className="bg-white text-slate-900 px-8 py-4 rounded-xl text-xs font-black transition-all disabled:opacity-50 disabled:grayscale flex justify-center items-center gap-3 hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] uppercase tracking-widest hover:scale-105 active:scale-95 w-full sm:w-auto">
                 {isUploading ? <Activity size={16} className="animate-spin" /> : 'Execute Sync'}
               </button>
             </div>
           </div>
         </div>
      )}

    </div>
  );
}
