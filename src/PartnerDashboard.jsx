import React, { useState, useEffect, useRef } from 'react';
import {
  Building2, Users, Target, TrendingUp, Download, CheckCircle,
  XCircle, FileText, Activity, BookOpen, AlertCircle, UploadCloud, X, Lock, Crown, ArrowRight, Briefcase, AlertTriangle, Sparkles, Search, Terminal, LogOut
} from 'lucide-react';
import { auth, db } from './firebase';
import { collection, query, where, onSnapshot, writeBatch, doc, getDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

// --- CUSTOM SVG LOGO COMPONENT ---
const SkillNovaLogo = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M50 5L60.5 39.5L95 50L60.5 60.5L50 95L39.5 60.5L5 50L39.5 39.5L50 5Z" fill="url(#nova-amber)" />
    <circle cx="50" cy="50" r="18" fill="#09090b" />
    <circle cx="50" cy="50" r="8" fill="url(#nova-amber)" />
    <defs>
      <linearGradient id="nova-amber" x1="5" y1="5" x2="95" y2="95" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f59e0b" />
        <stop offset="1" stopColor="#ea580c" />
      </linearGradient>
    </defs>
  </svg>
);

// --- CLEAN RADIAL PROGRESS COMPONENT ---
const RadialProgress = ({ percentage, colorClass, size = 120, strokeWidth = 8, label, subLabel }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} fill="none" />
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="none" strokeDasharray={circumference} strokeDashoffset={offset} className={`transition-all duration-1000 ease-out ${colorClass}`} strokeLinecap="round" />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold text-white tracking-tight">{percentage}%</span>
        </div>
      </div>
      {(label || subLabel) && (
        <div className="mt-4 text-center">
          {label && <p className="text-sm font-medium text-slate-200">{label}</p>}
          {subLabel && <p className="text-xs font-normal text-slate-500 mt-0.5">{subLabel}</p>}
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
  const [partnerTier, setPartnerTier] = useState('free');

  // Calculate final premium status
  const isPremium = partnerTier === 'premium' || isTester;

  // --- MODAL STATES ---
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState({ text: '', type: '' });

  // --- TABLE FILTERS ---
  const [searchTerm, setSearchTerm] = useState('');

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
      if (!tenantId) setErrorMsg("Admin configuration error: No Partner Code assigned to this account.");
      setLoading(false);
      return;
    }

    const checkAccessLevels = async () => {
      try {
        if (currentUser.email) {
          const qaRef = doc(db, 'qa_accounts', currentUser.email.toLowerCase());
          const qaSnap = await getDoc(qaRef);
          if (qaSnap.exists() && qaSnap.data().active === true) {
            setIsTester(true);
          }
        }
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.email.toLowerCase()));
        if (adminDoc.exists()) {
          setPartnerTier(adminDoc.data().tier || 'free');
        }
      } catch (err) {
        console.error("Access check error:", err);
      }
    };
    checkAccessLevels();

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

  // --- DYNAMIC ALIGNMENT TEXT LOGIC ---
  let alignmentStatus = 'LAGGING';
  let alignmentGradient = 'from-rose-100 via-rose-400 to-rose-700';
  let statusBadgeClass = 'text-rose-500 bg-rose-500/10 border-rose-500/20';

  if (stats.avgMatchScore >= 75) {
    alignmentStatus = 'ALIGNED';
    alignmentGradient = 'from-slate-100 via-slate-300 to-slate-500';
    statusBadgeClass = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
  } else if (stats.avgMatchScore >= 40) {
    alignmentStatus = 'TRACKING';
    alignmentGradient = 'from-amber-100 via-amber-400 to-amber-700';
    statusBadgeClass = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Activity className="text-amber-500 animate-spin w-8 h-8" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
        <AlertCircle className="text-rose-500 w-10 h-10 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">System Error</h2>
        <p className="text-slate-400 text-sm text-center max-w-md mb-6">{errorMsg}</p>
        <button onClick={() => auth.signOut()} className="px-5 py-2 bg-white text-black font-medium rounded-lg hover:bg-slate-200 transition-colors">Sign Out</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-200 font-sans selection:bg-amber-500/30 overflow-x-hidden flex flex-col relative font-inter">
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes radar {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
          .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
          .animate-radar { animation: radar 3s linear infinite; }
          .radar-sweep { background: conic-gradient(from 0deg, transparent 70%, rgba(245, 158, 11, 0.4) 100%); }
          
          /* LIQUID GLARE EFFECT FOR BUTTONS */
          .glare-effect {
            position: relative;
            overflow: hidden;
          }
          .glare-effect::after {
            content: '';
            position: absolute;
            top: -50%;
            left: -100%;
            width: 50%;
            height: 200%;
            background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%);
            transform: rotate(45deg);
            transition: all 0.6s ease;
            z-index: 10;
          }
          .glare-effect:hover::after {
            left: 150%;
          }

          .bg-grid-pattern {
            background-image: 
              linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px),
              linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
            background-size: 100px 100px, 100px 100px, 20px 20px, 20px 20px;
            transition: background-position 0.1s ease-out;
          }
        `}
      </style>

      {/* --- DYNAMIC BACKGROUND GLOWS AND PARALLAX GRID --- */}
      <div ref={gridRef} className="fixed inset-0 bg-grid-pattern [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)] pointer-events-none z-0"></div>
      <div className={`fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-amber-500/20 to-orange-600/10 blur-[150px] rounded-full pointer-events-none transition-colors duration-1000 z-0`}></div>

      {/* --- EQUI-SPACED, PERFECTLY CENTERED NAVBAR (EXPANDED TO MATCH NEW WIDTH) --- */}
      <div className="fixed top-4 md:top-6 w-full z-50 px-4 md:px-8 lg:px-12 flex justify-center animate-fade-in transition-all pointer-events-none">
        <nav className="w-full max-w-[1800px] 2xl:max-w-[95%] bg-[#0a0f1c]/80 backdrop-blur-2xl border border-white/10 rounded-full px-6 py-3 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.5)] pointer-events-auto transition-all hover:bg-[#0a0f1c]/95">

          {/* 1. Left - Logo */}
          <div className="flex items-center gap-3 w-1/4 min-w-0">
            <SkillNovaLogo className="w-8 h-8 drop-shadow-[0_0_12px_rgba(245,158,11,0.5)] flex-shrink-0" />
            <span className="text-xl font-black text-white tracking-tight hidden sm:block truncate">SkillNova</span>
          </div>

          {/* 2. Center - Navigation Links */}
          <div className="flex-1 flex justify-center items-center">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest uppercase text-amber-500 bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.3)] whitespace-nowrap">University Partner Portal</span>
              {isPremium && <span className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-500 border border-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.5)] text-[10px] font-black uppercase tracking-widest whitespace-nowrap"><Crown size={12} /> Premium Level</span>}
            </div>
          </div>

          {/* 3. Right - Action Icons */}
          <div className="flex justify-end w-1/4 gap-2">
            <button onClick={() => auth.signOut()} className="group flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-rose-500/20 border border-white/10 transition-all shadow-[0_0_15px_rgba(0,0,0,0.4)]">
              <LogOut size={16} className="text-slate-300 group-hover:text-rose-400 transition-colors" />
            </button>
          </div>
        </nav>
      </div>

      {/* --- MAIN CONTENT START (MASSIVELY EXPANDED WIDTH FOR ULTRAWIDE MONITORS) --- */}
      <div className="relative z-10 flex-grow px-4 md:px-8 lg:px-12 pt-40 pb-20 max-w-[1800px] 2xl:max-w-[95%] mx-auto w-full animate-fade-in-up delay-200">

        {/* PREMIUM UPGRADE BANNER (Free Tier Only) */}
        {!isPremium && (
          <div className="mb-10 p-1 bg-gradient-to-r from-amber-500/50 via-orange-500/50 to-rose-500/50 rounded-[2.5rem] relative group perspective-1000">
            <div className="card-3d p-8 bg-[#0a0f1c]/90 backdrop-blur-3xl rounded-[2.4rem] flex flex-col md:flex-row items-center justify-between gap-8 border border-white/10 transition-all relative overflow-hidden">
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

        {/* --- COMMAND CONSOLE --- */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 bg-[#121216]/50 backdrop-blur-3xl border-t border-l border-amber-500/30 border-r border-b border-black rounded-[2rem] mb-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-amber-500/10 to-transparent blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
           
           <div className="flex items-center gap-5 relative z-10 w-full md:w-auto">
             <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl flex items-center justify-center text-[#04060d] shadow-[0_0_20px_rgba(245,158,11,0.5)] shadow-inner"><Terminal size={26}/></div>
             <div>
                <h2 className="text-2xl font-black text-white tracking-tighter uppercase flex items-center gap-3 drop-shadow-md whitespace-nowrap">Command Console <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(245,158,11,1)]"></span></h2>
                <p className="text-[10px] text-amber-500 font-bold tracking-widest uppercase">System Core / Active</p>
             </div>
           </div>

           <div className="flex flex-col sm:flex-row items-center gap-3 relative z-10 w-full md:w-auto flex-shrink-0">
             <button onClick={() => isPremium ? setShowUploadModal(true) : setShowUpgradeModal(true)} className="glare-effect w-full sm:w-auto px-8 py-4 bg-amber-500 hover:bg-amber-400 text-[#04060d] font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95 border-b-2 border-amber-600 whitespace-nowrap">
               {!isPremium ? <Lock size={16} className="opacity-70" /> : <UploadCloud size={16} />}
               Bulk Onboard
             </button>
             <button onClick={() => isPremium ? handleExportCurriculumReport() : setShowUpgradeModal(true)} disabled={isExporting} className="glare-effect w-full sm:w-auto px-8 py-4 bg-black/60 hover:bg-black/80 border border-white/10 text-amber-500 font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all hover:border-amber-400 shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 whitespace-nowrap relative">
               {isExporting ? <Activity size={16} className="animate-spin" /> : <Download size={16} />}
               Export Intel
             </button>
           </div>
        </div>

        {/* --- DYNAMIC METRICS BOXES --- */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-16 perspective-1000">

          {/* HOLOGRAPHIC CENTERPIECE: ALIGNMENT */}
          <div className="xl:col-span-7 relative group" onClick={() => !isPremium && setShowUpgradeModal(true)}>
             <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-orange-500/5 blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-[3rem]"></div>
             
             <div className="h-full bg-black/40 backdrop-blur-3xl border-t border-l border-white/10 border-r border-b border-black rounded-[3rem] p-8 md:p-12 relative overflow-hidden transition-transform duration-700 hover:rotate-x-[2deg] hover:rotate-y-[2deg] hover:-translate-y-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] cursor-pointer group-hover:border-amber-500/30 overflow-hidden">
                <div className={`relative z-10 flex flex-col md:flex-row justify-between items-center h-full gap-10 transition-all duration-500 ${!isPremium ? 'blur-[10px] opacity-40' : ''}`}>
                  <div className="w-full md:w-1/2 flex justify-center group-hover:scale-105 transition-transform duration-700 drop-shadow-[0_0_40px_rgba(245,158,11,0.2)] flex-shrink-0">
                    <RadialProgress percentage={stats.avgMatchScore} colorClass={getScoreColor(stats.avgMatchScore)} size={280} strokeWidth={16} label="PROBABILITY" subLabel="Network Sync" />
                  </div>
                  
                  <div className="w-full md:w-1/2 text-center md:text-left md:border-l md:border-white/10 md:pl-10 min-w-0 flex-1">
                    <h2 className={`text-[clamp(1.8rem,4vw,4.5rem)] font-black text-transparent bg-clip-text bg-gradient-to-b ${alignmentGradient} tracking-tighter mb-2 drop-shadow-md leading-none whitespace-nowrap`}>
                      {alignmentStatus}
                    </h2>
                    <p className={`font-black uppercase tracking-widest text-[10px] mb-8 w-fit mx-auto md:mx-0 px-3 py-1.5 rounded-lg border shadow-sm whitespace-nowrap ${statusBadgeClass}`}>Cohort Alignment</p>
                    <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-xs mx-auto md:mx-0">The active cohort probability factor against prevailing market data points, weighted by real-world job descriptions.</p>
                  </div>
                </div>

                {!isPremium && <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-20 rounded-[3rem]"><div className="bg-[#18181b] p-8 rounded-[2rem] border border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.3)] flex flex-col items-center hover:scale-110 transition-transform"><Lock className="w-12 h-12 text-amber-500 mb-3 drop-shadow-[0_0_15px_rgba(245,158,11,0.8)]" /><span className="text-[10px] text-white font-black uppercase tracking-widest">Locked Area</span></div></div>}
             </div>
          </div>

          {/* DUAL STACK COLUMN */}
          <div className="xl:col-span-5 flex flex-col gap-8">
            
            {/* AT RISK BLEEDING EDGE */}
            <div className="flex-1 bg-black/50 backdrop-blur-3xl border-t border-rose-500/30 border-l border-rose-500/10 border-b border-r border-black rounded-[3rem] p-8 relative overflow-hidden transition-transform duration-500 hover:rotate-x-[-2deg] hover:-translate-y-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] cursor-pointer group" onClick={() => !isPremium && setShowUpgradeModal(true)}>
               <div className="absolute -top-32 -right-32 w-80 h-80 bg-rose-500/20 blur-[80px] rounded-full group-hover:bg-rose-500/40 transition-all duration-700 z-0"></div>
               
               <div className={`relative z-10 flex flex-col sm:flex-row h-full items-start sm:items-center justify-between gap-6 transition-all duration-500 ${!isPremium ? 'blur-[8px] opacity-40' : ''}`}>
                 <div>
                   <h3 className="text-rose-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-2 bg-rose-500/10 w-fit px-3 py-1.5 rounded-lg border border-rose-500/20 whitespace-nowrap"><AlertTriangle size={14}/> Critical Drop</h3>
                   <div className="text-[clamp(1.5rem,2.5vw,3rem)] font-black text-white tracking-tighter drop-shadow-md group-hover:translate-x-2 transition-transform leading-none whitespace-nowrap">AT-RISK <br className="hidden sm:block"/>STUDENTS</div>
                 </div>
                 <div className="text-8xl md:text-9xl font-black text-rose-500 tracking-tighter drop-shadow-[0_0_40px_rgba(244,63,94,0.6)] animate-pulse flex-shrink-0 leading-none">{stats.atRiskCount}</div>
               </div>

               {!isPremium && <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20 rounded-[3rem]"><div className="bg-[#18181b] p-6 rounded-[2rem] border border-rose-500/30 shadow-[0_0_40px_rgba(244,63,94,0.3)] hover:scale-110 transition-transform"><Lock className="w-10 h-10 text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]" /></div></div>}
            </div>

            {/* NEON STAT SPLITS */}
            <div className="flex-1 flex flex-col sm:flex-row gap-8">
               <div className="flex-1 bg-black/50 backdrop-blur-3xl border-t border-l border-white/10 border-r border-b border-black rounded-[2.5rem] p-8 relative overflow-hidden flex flex-col justify-end transition-all duration-500 hover:-translate-y-2 hover:border-blue-500/40 shadow-[0_10px_30px_rgba(0,0,0,0.5)] group min-w-0">
                 <div className="absolute top-6 right-6 w-14 h-14 bg-blue-500/10 rounded-full flex items-center justify-center group-hover:bg-blue-500/30 transition-colors shadow-inner flex-shrink-0 z-0"><Users className="text-blue-400" size={24}/></div>
                 <div className="text-5xl md:text-6xl font-black text-white tracking-tighter mb-2 mt-12 relative z-10 truncate leading-none">{stats.uniqueStudents}</div>
                 <div className="text-[10px] text-blue-400 font-black uppercase tracking-widest relative z-10 truncate whitespace-nowrap">Active Students</div>
               </div>
               
               <div className="flex-1 bg-black/50 backdrop-blur-3xl border-t border-l border-white/10 border-r border-b border-black rounded-[2.5rem] p-8 relative overflow-hidden flex flex-col justify-end transition-all duration-500 hover:-translate-y-2 hover:border-purple-500/40 shadow-[0_10px_30px_rgba(0,0,0,0.5)] group min-w-0">
                 <div className="absolute top-6 right-6 w-14 h-14 bg-purple-500/10 rounded-full flex items-center justify-center group-hover:bg-purple-500/30 transition-colors shadow-inner flex-shrink-0 z-0"><FileText className="text-purple-400" size={24}/></div>
                 <div className="text-5xl md:text-6xl font-black text-white tracking-tighter mb-2 mt-12 relative z-10 truncate leading-none">{stats.totalScans}</div>
                 <div className="text-[10px] text-purple-400 font-black uppercase tracking-widest relative z-10 truncate whitespace-nowrap">Evaluations</div>
               </div>
            </div>
          </div>
        </div>

        {/* --- DETAILED METRICS GRID --- */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

          {/* DATA SHARD MATRIX */}
          <div className="xl:col-span-2 relative">
             <div className="bg-black/50 backdrop-blur-3xl border-t border-l border-white/10 border-r border-b border-black rounded-[3rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] h-[600px] flex flex-col relative overflow-hidden group hover:border-white/20 duration-500 transition-all">
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-blue-500/10 transition-all duration-700 z-0"></div>

                <div className="sticky top-0 z-20 bg-black/50 backdrop-blur-2xl border-b border-white/10 -mt-8 -mx-8 pt-8 px-8 md:-mt-12 md:-mx-12 md:pt-12 md:px-12 pb-6 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
                  
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[clamp(2rem,3vw,3rem)] font-black text-white tracking-tighter drop-shadow-md leading-none whitespace-nowrap">DATA STREAM.</h3>
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-2 flex items-center gap-2 truncate whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping flex-shrink-0"></span> Live Cohort Matrix</p>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto flex-shrink-0">
                    <div className="relative flex-grow sm:w-64">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                      <input type="text" placeholder="FILTER STREAM..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#0a0f1c]/80 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-amber-500/50 transition-all placeholder:text-slate-600 shadow-inner" />
                    </div>
                  </div>
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-4 relative z-10 mask-fade-bottom pb-4 min-w-0">
                  {scans.filter(scan => (scan.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) || scan.targetRole?.toLowerCase().includes(searchTerm.toLowerCase()))).map(scan => {
                     const score = scan.roleMatchScore || scan.score || 0;
                     const isReady = score >= 60;
                     return (
                       <div key={scan.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/20 rounded-2xl transition-all duration-300 cursor-crosshair group/row shadow-sm hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:-translate-y-0.5 min-w-0 gap-4">
                          <div className="flex-1 mb-4 md:mb-0 w-full md:w-auto min-w-0">
                            <div className="text-sm font-black text-white truncate flex items-center gap-3 group-hover/row:text-amber-300 transition-colors tracking-tight"><Users size={14} className={isReady ? 'text-emerald-500' : 'text-rose-500'}/> {scan.userEmail}</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 ml-6 whitespace-nowrap">{scan.timestamp ? new Date(scan.timestamp.toDate()).toLocaleDateString() : 'Active'}</div>
                          </div>
                          <div className="flex-1 flex justify-start md:justify-center mb-4 md:mb-0 w-full md:w-auto flex-shrink-0">
                            <span className="text-[10px] font-black uppercase tracking-widest text-black bg-white px-4 py-2 rounded-xl border border-slate-300 shadow-[0_0_15px_rgba(255,255,255,0.3)] whitespace-nowrap">{scan.targetRole || "Unknown"}</span>
                          </div>
                          {isPremium && (
                            <div className="flex-1 flex justify-start md:justify-end gap-8 mb-4 md:mb-0 w-full md:w-auto flex-shrink-0">
                               <div className="text-center group-hover/row:scale-110 transition-transform">
                                 <div className={`text-2xl font-black tracking-tighter ${getScoreColor(score)} drop-shadow-sm leading-none`}>{score}%</div>
                                 <div className="text-[9px] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap">Match</div>
                               </div>
                               <div className="text-center group-hover/row:scale-110 transition-transform">
                                 <div className={`text-2xl font-black tracking-tighter ${getScoreColor(scan.atsFormatScore || 0)} drop-shadow-sm leading-none`}>{scan.atsFormatScore || 0}%</div>
                                 <div className="text-[9px] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap">Format</div>
                               </div>
                            </div>
                          )}
                          <div className="flex justify-end md:ml-8 w-full md:w-auto flex-shrink-0">
                            {isReady ? <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] shadow-inner"><CheckCircle size={20}/></div> : <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.3)] shadow-inner animate-pulse"><AlertCircle size={20}/></div>}
                          </div>
                       </div>
                     )
                  })}
                  
                  {/* RADAR SWEEP EMPTY STATE */}
                  {scans.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 opacity-70 relative overflow-hidden rounded-2xl border border-dashed border-white/10 mx-2 flex-grow">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-48 h-48 rounded-full border border-amber-500/20 relative flex items-center justify-center overflow-hidden">
                          <div className="absolute inset-0 radar-sweep animate-radar rounded-full"></div>
                          <div className="absolute inset-[2px] rounded-full bg-[#0a0f1c]"></div>
                          <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping z-10 shadow-[0_0_15px_rgba(245,158,11,1)]"></div>
                        </div>
                      </div>
                      <div className="text-[10px] font-black uppercase text-amber-500 tracking-widest relative z-10 mt-36 bg-black/50 px-4 py-2 rounded-xl backdrop-blur-sm border border-amber-500/20 whitespace-nowrap">
                        AWAITING STREAM...
                      </div>
                    </div>
                  )}
                </div>
             </div>
          </div>

          {/* RADICAL SKILL GAPS TYPOGRAPHY */}
          <div className="xl:col-span-1 relative group" onClick={() => !isPremium && setShowUpgradeModal(true)}>
            
            <div className="bg-black/80 backdrop-blur-3xl border-t border-r border-b border-l-4 border-t-white/5 border-r-white/5 border-b-white/5 border-l-rose-500 p-8 md:p-12 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col h-[600px] overflow-hidden relative cursor-pointer transition-all duration-500 hover:-translate-y-2 hover:border-l-rose-400 hover:shadow-[0_20px_60px_rgba(244,63,94,0.15)]">
              
              <div className="absolute pointer-events-none inset-y-0 left-0 w-32 bg-gradient-to-r from-rose-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0"></div>

              <div className="absolute pointer-events-none inset-0 flex items-center justify-center z-0">
                <BookOpen size={140} className="text-white opacity-5 group-hover:opacity-10 transition-opacity duration-500" />
              </div>
              
              <div className="absolute pointer-events-none inset-0 bg-gradient-to-b from-rose-500/10 to-transparent blur-[50px] z-0 group-hover:from-rose-500/20 transition-all duration-500"></div>
              
              <h3 className="text-[clamp(1.5rem,2vw,2.5rem)] xl:text-3xl font-black text-white tracking-tighter flex items-center gap-3 relative z-10 mb-2 drop-shadow-md leading-none whitespace-nowrap transition-colors">
                <Terminal className="text-rose-500 animate-pulse flex-shrink-0" size={32}/> GAPS DETECTED
              </h3>
              
              <p className="text-[10px] font-black uppercase tracking-widest mb-10 relative z-10 w-fit flex items-center gap-1.5 whitespace-nowrap bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 shadow-sm border-b border-rose-500/30 pb-2 transition-all">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,1)]"></span> <span className="font-bold text-rose-300">Critical Missing Skills</span>
              </p>

              <div className={`relative z-10 flex-grow flex flex-col justify-center gap-4 transition-all duration-500 min-w-0 ${!isPremium ? 'blur-[8px] opacity-30 select-none' : ''}`}>
                 {stats.topGaps.length > 0 ? stats.topGaps.map((gap, index) => {
                    const sizes = ['text-6xl md:text-7xl', 'text-5xl md:text-6xl', 'text-4xl md:text-5xl', 'text-3xl md:text-4xl', 'text-2xl md:text-3xl'];
                    const size = sizes[index] || 'text-xl md:text-2xl';
                    const baseOpacities = ['opacity-100', 'opacity-90', 'opacity-80', 'opacity-70', 'opacity-60'];
                    const opacity = baseOpacities[index] || 'opacity-50';
                    return (
                      <div key={index} className={`font-black uppercase tracking-tighter flex justify-between items-end gap-2 ${opacity} hover:opacity-100 transition-all hover:translate-x-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] group/term min-w-0`}>
                        <span className={`text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 ${size} leading-none truncate pr-4 drop-shadow-lg min-w-0 flex-1 transition-all`}>{gap.name}</span>
                        <span className="text-xs font-black text-slate-500 mb-2 group-hover/term:text-amber-500 transition-colors bg-white/5 px-2 py-1 rounded-md flex-shrink-0 whitespace-nowrap">{gap.percentage}%</span>
                      </div>
                    )
                 }) : (
                   <div className="text-[10px] font-black uppercase text-slate-600 tracking-widest text-center relative z-10" style={{opacity: isPremium ? 1 : 0}}>No anomalies logged</div>
                 )}

                 {!isPremium && stats.topGaps.length === 0 && (
                   <div className="flex flex-col justify-center h-full gap-4 pointer-events-none min-w-0">
                     <div className="font-black uppercase tracking-tighter flex justify-between items-end opacity-100 min-w-0"><span className="text-rose-500 text-6xl md:text-7xl leading-none truncate flex-1">PyTorch</span></div>
                     <div className="font-black uppercase tracking-tighter flex justify-between items-end opacity-80 min-w-0"><span className="text-orange-500 text-5xl md:text-6xl leading-none truncate flex-1">Docker</span></div>
                     <div className="font-black uppercase tracking-tighter flex justify-between items-end opacity-60 min-w-0"><span className="text-amber-500 text-4xl md:text-5xl leading-none truncate flex-1">AWS</span></div>
                   </div>
                 )}
              </div>

              {!isPremium && <div className="absolute inset-0 flex items-center justify-center z-20 backdrop-blur-sm rounded-[3rem]"><div className="bg-[#0a0f1c]/90 rounded-[3rem] p-10 flex flex-col items-center border border-rose-500/30 shadow-[0_0_50px_rgba(0,0,0,0.8)] hover:scale-110 transition-transform"><Lock className="w-16 h-16 text-rose-500 mb-6 drop-shadow-[0_0_20px_rgba(244,63,94,0.8)]" /><span className="text-[10px] text-white font-black uppercase tracking-widest border border-rose-500/50 px-6 py-3 rounded-xl shadow-inner bg-rose-500/10 whitespace-nowrap">Encrypted Skills</span></div></div>}
            </div>
          </div>
        </div>

      </div>

      {/* --- UPGRADE TO PREMIUM MODAL --- */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121214] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col relative animate-slide-up">

            <button onClick={() => setShowUpgradeModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10 p-2 rounded-full hover:bg-white/5"><X size={16} /></button>
            <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-600"></div>

            <div className="p-10 text-center relative z-10 w-full">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-amber-500/10 blur-[80px] rounded-full pointer-events-none -z-10"></div>

              <div className="w-20 h-20 bg-[#18181b] border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                <Crown className="text-amber-500 w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Premium Features</h2>
              <p className="text-slate-400 text-sm mb-6">Upgrade to unlock enterprise scale tools.</p>

              <ul className="text-left text-sm font-medium text-slate-300 space-y-4 mb-8 bg-white/5 p-6 rounded-2xl border border-white/10">
                <li className="flex items-center gap-3"><CheckCircle className="text-emerald-400" size={16} /> Bulk Student Upload</li>
                <li className="flex items-center gap-3"><CheckCircle className="text-emerald-400" size={16} /> Detailed Skill Gap Analytics</li>
                <li className="flex items-center gap-3"><CheckCircle className="text-emerald-400" size={16} /> Match Probability Metrics</li>
              </ul>

              <button onClick={() => { setShowUpgradeModal(false); alert("Enterprise Request Sent."); }} className="glare-effect w-full bg-white hover:bg-slate-200 text-black font-semibold py-3 px-6 rounded-xl transition-colors flex justify-center items-center gap-2 uppercase tracking-widest text-xs">
                Request Upgrade <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CSV UPLOAD MODAL (NEW DESIGN) --- */}
      {showUploadModal && isPremium && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121212] border border-white/5 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-slide-up">

            {/* Top Gradient Bar */}
            <div className="w-full h-1 bg-gradient-to-r from-emerald-400 to-blue-500"></div>

            {/* Header */}
            <div className="px-6 py-5 flex justify-between items-center border-b border-white/5">
              <h3 className="text-base font-bold text-white flex items-center gap-2"><UploadCloud className="text-emerald-400" size={18} strokeWidth={2.5} /> Bulk Onboarding</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5"><X size={16} /></button>
            </div>

            {/* Body */}
            <div className="px-8 py-8 relative z-10 w-full min-w-0">
              <p className="text-sm font-medium text-slate-400 mb-6 text-center leading-relaxed">
                Upload a CSV file containing your student roster to onboard them to<br/>cohort <strong className="text-white font-bold">{tenantId}</strong>.
              </p>

              <label className={`flex flex-col items-center justify-center border border-dashed rounded-xl p-10 cursor-pointer transition-all duration-300 ${csvFile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 bg-white/[0.02] hover:border-white/30'}`}>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                {csvFile ? (
                  <div className="text-center animate-fade-in truncate w-full">
                    <CheckCircle className="text-emerald-500 w-10 h-10 mx-auto mb-3"/>
                    <p className="text-emerald-400 text-sm font-bold truncate">{csvFile.name}</p>
                  </div>
                ) : (
                  <div className="text-center w-full">
                    <UploadCloud className="text-slate-400 w-10 h-10 mx-auto mb-3" strokeWidth={1.5}/>
                    <p className="text-white text-sm font-bold mb-1">Select CSV file</p>
                    <p className="text-xs text-slate-500">.csv only max 5MB</p>
                  </div>
                )}
              </label>

              {uploadMessage.text && (
                <div className={`mt-6 text-xs font-semibold p-3 rounded-lg text-center truncate animate-fade-in-up ${uploadMessage.type === 'error' ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20' : uploadMessage.type === 'success' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-blue-400 bg-blue-500/10 border border-blue-500/20'}`}>
                  {uploadMessage.text}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-white/5 bg-[#0e0e10] flex flex-col sm:flex-row justify-end items-center gap-4">
              <button onClick={() => setShowUploadModal(false)} className="text-sm font-semibold text-slate-400 hover:text-white transition-colors w-full sm:w-auto text-center">Cancel</button>
              <button onClick={processBulkUpload} disabled={isUploading || !csvFile} className="bg-[#8b8b8b] hover:bg-[#a0a0a0] text-[#121214] font-bold px-6 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 w-full sm:w-auto">
                {isUploading ? <Activity size={16} className="animate-spin" /> : 'Begin Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}