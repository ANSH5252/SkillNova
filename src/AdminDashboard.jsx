import React, { useState, useEffect, useRef } from 'react';
import { Users, FileText, TrendingDown, AlertTriangle, Activity, CheckCircle, XCircle, Rocket, Target, BarChart3, UploadCloud, Building2, Mail, Check, X, ShieldCheck, LogOut, Briefcase, Globe, Search, Terminal, Crown, Sparkles, Lock } from 'lucide-react';
import { auth, db } from './firebase';
import { collection, query, orderBy, onSnapshot, writeBatch, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

// --- CUSTOM SVG LOGO COMPONENT ---
const SkillNovaLogo = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M50 5L60.5 39.5L95 50L60.5 60.5L50 95L39.5 60.5L5 50L39.5 39.5L50 5Z" fill="url(#nova-godmode)" />
    <circle cx="50" cy="50" r="18" fill="#04060d" />
    <circle cx="50" cy="50" r="8" fill="url(#nova-godmode)" />
    <defs>
      <linearGradient id="nova-godmode" x1="5" y1="5" x2="95" y2="95" gradientUnits="userSpaceOnUse">
        <stop stopColor="#d946ef" />
        <stop offset="1" stopColor="#06b6d4" />
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
          <span className="text-3xl font-black text-white tracking-tight">{percentage}%</span>
        </div>
      </div>
      {(label || subLabel) && (
        <div className="mt-4 text-center">
          {label && <p className="text-[10px] font-black text-slate-200 uppercase tracking-widest">{label}</p>}
          {subLabel && <p className="text-[9px] font-bold text-slate-500 mt-0.5 uppercase tracking-widest">{subLabel}</p>}
        </div>
      )}
    </div>
  );
};

export default function AdminDashboard() {
  const [currentView, setCurrentView] = useState('analytics'); // 'analytics', 'partners', or 'employers'

  const [scans, setScans] = useState([]);
  const [applications, setApplications] = useState([]);
  const [employerApps, setEmployerApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);
  const [revealedEmails, setRevealedEmails] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // --- BULK UPLOAD STATES ---
  const [csvFile, setCsvFile] = useState(null);
  const [targetTenantId, setTargetTenantId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState({ text: '', type: '' });

  // --- APPROVAL STATES ---
  const [processingId, setProcessingId] = useState(null);
  const [assignTenantId, setAssignTenantId] = useState({});

  const [stats, setStats] = useState({
    total: 0, uniqueUsers: 0, avgScore: 0, avgMarketProb: 0, passRate: 0, topSkills: [], topRecommended: []
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
    // 1. Fetch ATS Scans
    const qScans = query(collection(db, 'ats_scans'), orderBy('timestamp', 'desc'));
    const unsubScans = onSnapshot(qScans, (snapshot) => {
      const scanData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setScans(scanData);

      if (scanData.length > 0) {
        const total = scanData.length;
        const uniqueEmails = new Set(scanData.map(s => s.userEmail));
        const totalScore = scanData.reduce((acc, curr) => acc + (curr.roleMatchScore || curr.score || 0), 0);
        const totalMarketProb = scanData.reduce((acc, curr) => acc + (curr.marketProbability || 0), 0);
        const passedCount = scanData.filter(s => (s.roleMatchScore || s.score) >= 60).length;

        const skillCounts = {};
        const recommendedCounts = {};

        scanData.forEach(scan => {
          if (scan.missingKeywords) scan.missingKeywords.forEach(skill => skillCounts[skill] = (skillCounts[skill] || 0) + 1);
          if (scan.recommendedSkills) scan.recommendedSkills.forEach(skill => recommendedCounts[skill] = (recommendedCounts[skill] || 0) + 1);
        });

        const topSkills = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }));
        const topRecommended = Object.entries(recommendedCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }));

        setStats({ total, uniqueUsers: uniqueEmails.size, avgScore: Math.round(totalScore / total), avgMarketProb: Math.round(totalMarketProb / total), passRate: Math.round((passedCount / total) * 100), topSkills, topRecommended });
      }
    });

    // 2. Fetch Partner Applications (Universities)
    const qApps = query(collection(db, 'partner_applications'), orderBy('createdAt', 'desc'));
    const unsubApps = onSnapshot(qApps, (snapshot) => {
      const appData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setApplications(appData);
    });

    // 3. Fetch Employer Applications 
    const qEmpApps = query(collection(db, 'employer_applications'), orderBy('createdAt', 'desc'));
    const unsubEmpApps = onSnapshot(qEmpApps, (snapshot) => {
      const empData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployerApps(empData);
      setLoading(false);
    });

    return () => { unsubScans(); unsubApps(); unsubEmpApps(); };
  }, []);

  // --- UNIVERSITY APPROVAL LOGIC ---
  const handleApprovePartner = async (app) => {
    const finalTenantId = assignTenantId[app.id]?.trim().toUpperCase();
    if (!finalTenantId) { alert("Please assign a strictly formatted Tenant ID (e.g., HARVARD-2026)."); return; }
    setProcessingId(app.id);
    try {
      await setDoc(doc(db, 'admins', app.email.toLowerCase()), { role: 'partner', tenantId: finalTenantId, universityName: app.universityName, contactName: app.contactName, createdAt: serverTimestamp() });
      await updateDoc(doc(db, 'partner_applications', app.id), { status: 'approved', tenantId: finalTenantId, approvedAt: serverTimestamp() });
      setAssignTenantId(prev => ({ ...prev, [app.id]: '' }));
    } catch (error) { console.error("Approval failed:", error); alert("Database error during approval."); }
    finally { setProcessingId(null); }
  };

  const handleRejectPartner = async (appId) => {
    if (!window.confirm("Are you sure you want to reject this university?")) return;
    setProcessingId(appId);
    try { await updateDoc(doc(db, 'partner_applications', appId), { status: 'rejected', rejectedAt: serverTimestamp() }); }
    catch (error) { console.error("Rejection failed:", error); }
    finally { setProcessingId(null); }
  };

  // --- EMPLOYER APPROVAL LOGIC ---
  const handleApproveEmployer = async (app) => {
    if (!window.confirm(`Approve ${app.companyName} for Employer Access?`)) return;
    setProcessingId(app.id);
    try {
      await setDoc(doc(db, 'admins', app.email.toLowerCase()), {
        role: 'employer', companyName: app.companyName, contactName: app.contactName, industry: app.industry, createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'employer_applications', app.id), {
        status: 'approved', approvedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Employer Approval failed:", error); alert("Database error during approval.");
    } finally { setProcessingId(null); }
  };

  const handleRejectEmployer = async (appId) => {
    if (!window.confirm("Are you sure you want to reject this employer?")) return;
    setProcessingId(appId);
    try { await updateDoc(doc(db, 'employer_applications', appId), { status: 'rejected', rejectedAt: serverTimestamp() }); }
    catch (error) { console.error("Rejection failed:", error); }
    finally { setProcessingId(null); }
  };


  // --- CSV BULK UPLOAD LOGIC ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "text/csv") { setCsvFile(file); setUploadMessage({ text: '', type: '' }); }
    else { setCsvFile(null); setUploadMessage({ text: 'Please upload a valid .csv file.', type: 'error' }); }
  };

  const processBulkUpload = async () => {
    if (!csvFile || !targetTenantId.trim()) { setUploadMessage({ text: 'Provide both a CSV file and a Tenant ID.', type: 'error' }); return; }
    setIsUploading(true); setUploadMessage({ text: 'Parsing CSV...', type: 'info' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const rawLines = text.split('\n');
      const emailsToUpload = rawLines.map(line => line.split(',')[0].trim().toLowerCase()).filter(email => email.includes('@'));

      if (emailsToUpload.length === 0) { setUploadMessage({ text: 'No valid emails found in the CSV.', type: 'error' }); setIsUploading(false); return; }

      try {
        setUploadMessage({ text: `Writing ${emailsToUpload.length} users...`, type: 'info' });
        const batch = writeBatch(db);
        const finalTenantId = targetTenantId.trim().toUpperCase();

        emailsToUpload.slice(0, 500).forEach((email) => {
          const studentRef = doc(db, 'allowed_students', email);
          batch.set(studentRef, { tenantId: finalTenantId });
        });

        await batch.commit();
        setUploadMessage({ text: `Success! ${emailsToUpload.slice(0, 500).length} provisioned.`, type: 'success' });
        setCsvFile(null); setTargetTenantId('');
      } catch (error) { setUploadMessage({ text: 'Database error.', type: 'error' }); }
      finally { setIsUploading(false); }
    };
    reader.readAsText(csvFile);
  };

  const getScoreColor = (score) => { if (score >= 75) return 'text-cyan-400'; if (score >= 45) return 'text-fuchsia-400'; return 'text-rose-500'; };

  const maskEmail = (email) => {
    if (!email) return "Unknown";
    const parts = email.split("@");
    if (parts.length !== 2) return email;
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name.substring(0, 2)}${"*".repeat(name.length - 2)}@${domain}`;
  };

  const handleDoubleClickEmail = (id) => {
    setRevealedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  if (loading) return <div className="min-h-screen bg-[#04060d] flex items-center justify-center"><Activity className="text-fuchsia-500 animate-spin w-12 h-12" /></div>;

  const pendingApps = applications.filter(app => app.status === 'pending');
  const processedApps = applications.filter(app => app.status !== 'pending');
  const pendingEmpApps = employerApps.filter(app => app.status === 'pending');
  const processedEmpApps = employerApps.filter(app => app.status !== 'pending');

  return (
    <div className="min-h-screen bg-[#04060d] text-slate-200 font-sans selection:bg-fuchsia-500/30 overflow-x-hidden flex flex-col relative font-inter">
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
        .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(217, 70, 239, 0.2); border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(217, 70, 239, 0.5); }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(217, 70, 239, 0.2) transparent; }

        .bg-grid-godmode {
          background-image: 
            linear-gradient(to right, rgba(217,70,239,0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(6,182,212,0.08) 1px, transparent 1px),
            linear-gradient(to right, rgba(217,70,239,0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(6,182,212,0.02) 1px, transparent 1px);
          background-size: 100px 100px, 100px 100px, 20px 20px, 20px 20px;
        }

        .glare-effect { position: relative; overflow: hidden; }
        .glare-effect::after {
          content: ''; position: absolute; top: -50%; left: -100%; width: 50%; height: 200%;
          background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%);
          transform: rotate(45deg); transition: all 0.6s ease; z-index: 10;
        }
        .glare-effect:hover::after { left: 150%; }
      `}} />

      {/* --- DYNAMIC BACKGROUND GLOWS AND PARALLAX GRID --- */}
      <div ref={gridRef} className="fixed inset-0 bg-grid-godmode [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)] pointer-events-none z-0"></div>
      <div className={`fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] bg-gradient-to-b from-fuchsia-600/10 to-cyan-500/10 blur-[150px] rounded-full pointer-events-none z-0`}></div>

      {/* --- FLOATING PREMIUM NAVBAR --- */}
      <div className="fixed top-4 md:top-6 w-full z-50 px-4 md:px-8 lg:px-12 flex justify-center animate-fade-in pointer-events-none">
        <nav className="w-full max-w-[1800px] 2xl:max-w-[95%] bg-[#0a0f1c]/80 backdrop-blur-2xl border border-fuchsia-500/20 rounded-full px-6 py-3 flex items-center justify-between shadow-[0_8px_32px_rgba(217,70,239,0.15)] pointer-events-auto transition-all hover:bg-[#0a0f1c]/95">
          {/* Left - Logo */}
          <div className="flex items-center gap-3 w-1/4 min-w-0">
            <SkillNovaLogo className="w-8 h-8 drop-shadow-[0_0_12px_rgba(217,70,239,0.5)] flex-shrink-0" />
            <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-cyan-400 tracking-tight hidden sm:block truncate uppercase">System Core</span>
          </div>
          {/* Center - God Mode Indicator */}
          <div className="flex-1 flex justify-center items-center">
            <div className="flex items-center gap-2 relative">
              <div className="absolute inset-0 bg-fuchsia-500/20 blur-md rounded-full animate-pulse"></div>
              <span className="relative text-[10px] font-black tracking-widest uppercase text-white bg-gradient-to-r from-fuchsia-600 to-cyan-600 px-5 py-2 rounded-full shadow-[0_0_20px_rgba(217,70,239,0.4)] flex items-center gap-2 whitespace-nowrap"><Crown size={14} /> Super Admin</span>
            </div>
          </div>
          {/* Right - Signout */}
          <div className="flex justify-end w-1/4 gap-2">
            <button onClick={() => auth.signOut()} className="group flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-rose-500/20 border border-white/10 transition-all shadow-[0_0_15px_rgba(0,0,0,0.4)]">
              <LogOut size={16} className="text-slate-300 group-hover:text-rose-400 transition-colors" />
            </button>
          </div>
        </nav>
      </div>

      <div className="relative z-10 flex-grow px-4 md:px-8 lg:px-12 pt-40 pb-20 max-w-[1800px] 2xl:max-w-[95%] mx-auto w-full animate-fade-in-up delay-200">

        {/* --- COMMAND CONSOLE TOGGLES --- */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 bg-[#121216]/50 backdrop-blur-3xl border-t border-l border-fuchsia-500/30 border-r border-b border-black rounded-[2rem] mb-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-fuchsia-500/10 to-transparent blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
          <div className="flex flex-col sm:flex-row items-center gap-3 relative z-10 w-full md:w-auto">
            <button onClick={() => setCurrentView('analytics')} className={`glare-effect w-full sm:w-auto px-6 py-4 font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-105 active:scale-95 whitespace-nowrap border-b-2 ${currentView === 'analytics' ? 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white border-fuchsia-400 shadow-[0_0_20px_rgba(217,70,239,0.4)]' : 'bg-black/60 hover:bg-black/80 text-fuchsia-500 border-transparent hover:border-fuchsia-500/50'}`}><Activity size={16} /> Matrix Analytics</button>
            <button onClick={() => setCurrentView('partners')} className={`glare-effect w-full sm:w-auto px-6 py-4 font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-105 active:scale-95 whitespace-nowrap border-b-2 ${currentView === 'partners' ? 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'bg-black/60 hover:bg-black/80 text-cyan-500 border-transparent hover:border-cyan-500/50'}`}><Building2 size={16} /> Partner Nodes {pendingApps.length > 0 && <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full">{pendingApps.length}</span>}</button>
            <button onClick={() => setCurrentView('employers')} className={`glare-effect w-full sm:w-auto px-6 py-4 font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-105 active:scale-95 whitespace-nowrap border-b-2 ${currentView === 'employers' ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'bg-black/60 hover:bg-black/80 text-indigo-400 border-transparent hover:border-indigo-500/50'}`}><Briefcase size={16} /> Enterprise Link {pendingEmpApps.length > 0 && <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full">{pendingEmpApps.length}</span>}</button>
          </div>
        </div>

        {/* ========================================= */}
        {/* VIEW 1: ATS ANALYTICS                     */}
        {/* ========================================= */}
        {currentView === 'analytics' && (
          <div className="animate-fade-in-up">

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 perspective-1000">
              {[
                { title: "Total Audits", value: stats.total, sub: `${stats.uniqueUsers} users`, icon: Users, color: "text-blue-400", border: "border-blue-500/30", bg: "bg-blue-500/10" },
                { title: "Network Sync", value: `${stats.avgScore}%`, sub: "Avg Score", icon: Activity, color: "text-fuchsia-400", border: "border-fuchsia-500/30", bg: "bg-fuchsia-500/10" },
                { title: "Market Prob.", value: `${stats.avgMarketProb}%`, sub: "Avg Likelihood", icon: BarChart3, color: "text-cyan-400", border: "border-cyan-500/30", bg: "bg-cyan-500/10" },
                { title: "Viable Core", value: `${stats.passRate}%`, sub: "Passed thresholds", icon: Target, color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10" }
              ].map((card, i) => (
                <div key={i} className={`bg-black/40 backdrop-blur-md border-t border-l ${card.border} border-r border-b border-black p-6 rounded-[2rem] flex justify-between items-center transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_15px_30px_rgba(0,0,0,0.5)] group overflow-hidden relative`}>
                  <div className={`absolute -right-10 -top-10 w-32 h-32 ${card.bg} blur-[40px] rounded-full group-hover:scale-150 transition-transform duration-700`}></div>
                  <div className="relative z-10">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{card.title}</div>
                    <div className="flex items-baseline gap-2"><h4 className="text-4xl font-black text-white tracking-tighter">{card.value}</h4></div>
                    <div className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${card.color}`}>{card.sub}</div>
                  </div>
                  <div className={`relative z-10 ${card.bg} p-4 rounded-2xl group-hover:scale-110 group-hover:rotate-12 transition-transform shadow-inner`}>
                    <card.icon className={card.color} size={28} />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* LIVE DATA STREAM (COL 2) */}
              <div className="xl:col-span-2 relative">
                <div className="bg-black/50 backdrop-blur-3xl border-t border-l border-white/10 border-r border-b border-black rounded-[3rem] p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] h-[750px] flex flex-col relative overflow-hidden group hover:border-fuchsia-500/20 duration-500 transition-all">
                  <div className="absolute -top-40 -left-40 w-96 h-96 bg-fuchsia-500/10 blur-[80px] rounded-full pointer-events-none group-hover:bg-fuchsia-500/20 transition-all duration-700 z-0"></div>

                  <div className="sticky top-0 z-20 bg-black/50 backdrop-blur-2xl border-b border-white/10 -mt-8 -mx-8 pt-8 px-8 md:-mt-12 md:-mx-12 md:pt-12 md:px-12 pb-6 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[clamp(2rem,3vw,3rem)] font-black text-white tracking-tighter drop-shadow-md leading-none whitespace-nowrap">GLOBAL STREAM</h3>
                      <p className="text-[10px] font-black text-fuchsia-500 uppercase tracking-widest mt-2 flex items-center gap-2 truncate"><span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 animate-ping"></span> Live Evaluation Matrix</p>
                    </div>
                  </div>

                  {/* TABLE HEADERS */}
                  <div className="sticky top-[95px] md:top-[120px] z-20 bg-black/80 backdrop-blur-3xl border-y border-white/10 py-3 hidden md:flex items-center text-[9px] font-black uppercase tracking-widest text-slate-500 px-8 gap-6 -mx-8 md:-mx-12 mb-4 shadow-sm">
                    <div className="w-[40%]">Student / Timestamp</div>
                    <div className="w-[30%]">Target Role</div>
                    <div className="w-[15%] text-center">Status</div>
                    <div className="w-[15%] text-right pr-2">Action</div>
                  </div>

                  <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3 relative z-10 pb-4 min-w-0">
                    {scans.filter(s => s.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) || s.tenantId?.toLowerCase().includes(searchTerm.toLowerCase())).map(scan => {
                      const score = scan.roleMatchScore || scan.score || 0;
                      const isReady = score >= 60;
                      const isEmailRevealed = revealedEmails.has(scan.id);
                      const isPremium = scan.tenantId && scan.tenantId.toLowerCase() !== 'public';
                      const isExpanded = expandedRow === scan.id;
                      return (
                        <div key={scan.id} className={`flex-shrink-0 bg-white/[0.02] border ${isExpanded ? 'border-fuchsia-500/40' : 'border-white/5'} rounded-2xl flex flex-col transition-all duration-300 shadow-sm hover:border-fuchsia-500/30 overflow-hidden group/card relative`}>
                          {/* Summary Row */}
                          <div className="flex flex-col md:flex-row items-center p-4 gap-6 min-w-0">
                            {/* STUDENT/TIME */}
                            <div className="w-full md:w-[40%] flex flex-col min-w-0">
                              <div className="text-sm font-black text-white truncate flex items-center gap-3 tracking-tight select-none" onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClickEmail(scan.id); }} title="Double click to reveal email">
                                <Activity size={14} className={isReady ? 'text-cyan-400' : 'text-fuchsia-500'} /> {isEmailRevealed ? scan.userEmail : maskEmail(scan.userEmail)}
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${isPremium ? 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' : 'text-slate-400 bg-slate-800 border-slate-700'}`}>{scan.tenantId || 'PUBLIC'}</span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{scan.timestamp ? new Date(scan.timestamp.toDate()).toLocaleString() : 'Active'}</span>
                              </div>
                            </div>
                            {/* APPLIED ROLE */}
                            <div className="w-full md:w-[30%]">
                              <span className="text-[10px] font-black uppercase tracking-widest text-[#04060d] bg-slate-200 px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap overflow-hidden text-ellipsis inline-block max-w-full" title={scan.targetRole}>{scan.targetRole || "Unknown"}</span>
                            </div>
                            {/* STATUS (SELECTED OR NOT) */}
                            <div className="w-full md:w-[15%] flex justify-start md:justify-center">
                              {isReady ? <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2 py-1.5 rounded-lg border border-cyan-500/30 shadow-inner"><CheckCircle size={12} /> PASS</span> : <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-rose-400 bg-rose-500/10 px-2 py-1.5 rounded-lg border border-rose-500/30 shadow-inner"><XCircle size={12} /> REJECT</span>}
                            </div>
                            {/* VIEW DETAILS ACTION */}
                            <div className="w-full md:w-[15%] flex justify-end">
                              <button onClick={() => setExpandedRow(isExpanded ? null : scan.id)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-[0_0_10px_rgba(217,70,239,0.1)] hover:shadow-[0_0_20px_rgba(217,70,239,0.4)] whitespace-nowrap ${isExpanded ? 'bg-fuchsia-500 text-white border border-fuchsia-400' : 'bg-transparent border border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500 hover:text-white'}`}>{isExpanded ? 'Collapse' : 'Details'}</button>
                            </div>
                          </div>

                          {/* Insights Expansion Panel */}
                          {isExpanded && (
                            <div className="border-t border-white/10 bg-[#060812]/90 p-6 animate-fade-in-up">
                              <div className="flex items-center gap-8 mb-6 pb-6 border-b border-white/5">
                                <div className="flex-1">
                                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">ATS Match Score</div>
                                  <div className={`text-3xl font-black tracking-tighter ${getScoreColor(score)} drop-shadow-sm leading-none`}>{score}%</div>
                                </div>
                                <div className="flex-1 border-l border-white/5 pl-8">
                                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Market Predictability</div>
                                  <div className={`text-3xl font-black tracking-tighter ${getScoreColor(scan.marketProbability || 0)} drop-shadow-sm leading-none`}>{scan.marketProbability || 0}%</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                  <h4 className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-2"><CheckCircle size={12} /> Validated Skills</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {scan.foundSkills && scan.foundSkills.length > 0 ? scan.foundSkills.map((s, i) => <span key={i} className="text-[9px] font-bold uppercase tracking-widest text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">{s}</span>) : <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">None detected</span>}
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-[9px] font-black uppercase tracking-widest text-rose-400 mb-3 flex items-center gap-2"><AlertTriangle size={12} /> Missing Gaps</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {scan.missingKeywords && scan.missingKeywords.length > 0 ? scan.missingKeywords.map((s, i) => <span key={i} className="text-[9px] font-bold uppercase tracking-widest text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded">{s}</span>) : <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">No major gaps</span>}
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-[9px] font-black uppercase tracking-widest text-cyan-400 mb-3 flex items-center gap-2"><Rocket size={12} /> Upskill Path</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {scan.recommendedSkills && scan.recommendedSkills.length > 0 ? scan.recommendedSkills.map((s, i) => <span key={i} className="text-[9px] font-bold uppercase tracking-widest text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded">{s}</span>) : <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">N/A</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {scans.length === 0 && <div className="text-center text-slate-500 text-xs font-bold uppercase tracking-widest py-20">Awaiting Submissions...</div>}
                  </div>
                </div>
              </div>

              {/* ANOMALIES & GAPS (COL 1) */}
              <div className="xl:col-span-1 flex flex-col gap-6 h-[750px]">
                <div className="flex-1 bg-black/80 backdrop-blur-3xl border-t border-r border-b border-l-4 border-t-white/5 border-r-white/5 border-b-white/5 border-l-rose-500 p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden relative group transition-all duration-500 hover:border-l-rose-400">
                  <div className="absolute pointer-events-none inset-0 bg-gradient-to-b from-rose-500/10 to-transparent blur-[30px] z-0"></div>
                  <h3 className="text-2xl font-black text-white tracking-tighter flex items-center justify-between relative z-10 mb-6 drop-shadow-md leading-none flex-shrink-0">
                    <span className="flex items-center gap-3"><AlertTriangle className="text-rose-500" size={24} /> CRITICAL GAPS</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-rose-300 bg-rose-500/20 px-3 py-1.5 rounded-full border border-rose-500/30">{stats.topSkills.length} Total</span>
                  </h3>
                  <div className="relative z-10 flex-grow flex flex-col justify-start gap-4 overflow-y-auto custom-scrollbar pr-2 min-h-0">
                    {stats.topSkills.map((gap, i) => (
                      <div key={i} className="flex-shrink-0 font-black uppercase tracking-tighter flex justify-between items-end gap-2 hover:translate-x-2 transition-all">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-400 text-[clamp(1.2rem,2vw,1.8rem)] truncate min-w-0 flex-1">{gap.name}</span>
                        <span className="text-xs font-black text-slate-500 bg-white/5 px-2 py-1 rounded-md mb-0.5">{gap.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 bg-black/80 backdrop-blur-3xl border-t border-r border-b border-l-4 border-t-white/5 border-r-white/5 border-b-white/5 border-l-cyan-500 p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden relative group transition-all duration-500 hover:border-l-cyan-400">
                  <div className="absolute pointer-events-none inset-0 bg-gradient-to-b from-cyan-500/10 to-transparent blur-[30px] z-0"></div>
                  <h3 className="text-2xl font-black text-white tracking-tighter flex items-center justify-between relative z-10 mb-6 drop-shadow-md leading-none flex-shrink-0">
                    <span className="flex items-center gap-3"><Rocket className="text-cyan-400" size={24} /> UPSKILL PATHS</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-cyan-300 bg-cyan-500/20 px-3 py-1.5 rounded-full border border-cyan-500/30">{stats.topRecommended.length} Total</span>
                  </h3>
                  <div className="relative z-10 flex-grow flex flex-col justify-start gap-4 overflow-y-auto custom-scrollbar pr-2 min-h-0">
                    {stats.topRecommended.map((skill, i) => (
                      <div key={i} className="flex-shrink-0 font-black uppercase tracking-tighter flex justify-between items-end gap-2 hover:translate-x-2 transition-all">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 text-[clamp(1.2rem,2vw,1.8rem)] truncate min-w-0 flex-1">{skill.name}</span>
                        <span className="text-xs font-black text-slate-500 bg-white/5 px-2 py-1 rounded-md mb-0.5">{skill.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* VIEW 2: PARTNERS (UNIVERSITIES)           */}
        {/* ========================================= */}
        {currentView === 'partners' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-fade-in-up">
            <div className="xl:col-span-8 space-y-8">
              {/* PENDING */}
              <div className="bg-black/50 backdrop-blur-3xl border-t border-l border-cyan-500/30 border-r border-b border-black p-8 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <h3 className="text-[clamp(1.5rem,2vw,2.5rem)] font-black text-white mb-8 flex items-center gap-3 tracking-tighter"><Building2 className="text-cyan-400" /> PENDING ALLOCATIONS</h3>
                <div className="space-y-4">
                  {pendingApps.map(app => (
                    <div key={app.id} className="bg-white/[0.02] border border-cyan-500/20 rounded-2xl p-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center shadow-lg">
                      <div>
                        <h4 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">{app.universityName} <span className="text-[9px] bg-amber-500/20 text-amber-400 px-2 py-1 rounded uppercase tracking-widest shadow-[0_0_10px_rgba(245,158,11,0.3)]">Review</span></h4>
                        <div className="flex flex-col sm:flex-row gap-4 mt-3 text-xs text-slate-400 font-bold tracking-widest uppercase"><span className="flex items-center gap-1.5"><Mail size={14} className="text-cyan-500" /> {app.email}</span><span className="flex items-center gap-1.5"><Users size={14} className="text-fuchsia-500" /> {app.contactName}</span></div>
                      </div>
                      <div className="w-full md:w-auto flex flex-col gap-3 min-w-[250px]">
                        <input type="text" placeholder="ASSIGN TENANT (EX. SRM-26)" value={assignTenantId[app.id] || ''} onChange={(e) => setAssignTenantId({ ...assignTenantId, [app.id]: e.target.value.toUpperCase() })} className="w-full bg-[#0a0f1c] border border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-3 text-[10px] font-black tracking-widest text-white outline-none uppercase shadow-inner" />
                        <div className="flex gap-2">
                          <button onClick={() => handleRejectPartner(app.id)} disabled={processingId === app.id} className="flex-1 px-3 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"><X size={14} /> Reject</button>
                          <button onClick={() => handleApprovePartner(app)} disabled={processingId === app.id} className="glare-effect flex-1 px-3 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 disabled:opacity-50">{processingId === app.id ? <Activity size={14} className="animate-spin" /> : <><Check size={14} /> Approve</>}</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {pendingApps.length === 0 && <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl"><CheckCircle className="text-slate-600 w-12 h-12 mx-auto mb-3" /><p className="text-[10px] font-black text-slate-500 tracking-widest uppercase">No pending requests</p></div>}
                </div>
              </div>

              {/* HISTORY */}
              <div className="bg-black/30 backdrop-blur-2xl border border-white/5 p-8 rounded-[2.5rem]">
                <h3 className="text-[10px] font-black text-slate-500 mb-6 uppercase tracking-widest">Processed Nodes</h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                  {processedApps.map(app => (
                    <div key={app.id} className="flex justify-between items-center p-4 bg-white/[0.01] rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                      <div><p className="text-sm font-black text-slate-300 tracking-tight">{app.universityName}</p><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{app.email}</p></div>
                      <div className="text-right">
                        {app.status === 'approved' ? <span className="text-[9px] font-black text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20 shadow-sm uppercase tracking-widest">APPROVED: {app.tenantId}</span> : <span className="text-[9px] font-black text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 uppercase tracking-widest">REJECTED</span>}
                      </div>
                    </div>
                  ))}
                  {processedApps.length === 0 && <p className="text-xs text-slate-600 text-center py-4 font-bold uppercase tracking-widest">No history</p>}
                </div>
              </div>
            </div>

            {/* BULK UPLOADER */}
            <div className="xl:col-span-4">
              <div className="bg-gradient-to-br from-fuchsia-900/30 to-cyan-900/10 border-t border-l border-fuchsia-500/40 p-8 rounded-[3rem] flex flex-col relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] h-fit sticky top-28">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-fuchsia-500/20 blur-[50px] rounded-full pointer-events-none"></div>
                <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-3 relative z-10 tracking-tighter"><Terminal className="text-fuchsia-400" size={24} /> BULK ROOT</h3>
                <p className="text-[10px] font-bold text-slate-400 mb-8 relative z-10 uppercase tracking-widest leading-relaxed">Direct CSV inject to provision tenant accounts into the mainframe.</p>
                <div className="space-y-6 relative z-10">
                  <input type="text" value={targetTenantId} onChange={(e) => setTargetTenantId(e.target.value)} placeholder="TARGET COHORT ID" className="w-full bg-[#0a0f1c]/80 border border-slate-700 focus:border-fuchsia-500 rounded-xl px-5 py-4 text-[10px] font-black tracking-widest text-white outline-none uppercase shadow-inner block" />
                  <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all ${csvFile ? 'border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.2)]' : 'border-slate-700 bg-black/40 hover:border-fuchsia-500/40'}`}>
                    <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                    {csvFile ? <div className="text-center"><CheckCircle className="text-cyan-400 w-10 h-10 mx-auto mb-3" /><p className="text-cyan-300 text-[10px] font-black uppercase tracking-widest truncate w-48">{csvFile.name}</p></div> : <div className="text-center"><UploadCloud className="text-slate-500 w-10 h-10 mx-auto mb-3" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">INJECT .CSV FILE</p></div>}
                  </label>
                  {uploadMessage.text && <div className={`text-[9px] font-black uppercase tracking-widest p-4 rounded-xl text-center ${uploadMessage.type === 'error' ? 'text-rose-400 bg-rose-500/10 border border-rose-500/30' : uploadMessage.type === 'success' ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30' : 'text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/30'}`}>{uploadMessage.text}</div>}
                  <button onClick={processBulkUpload} disabled={isUploading || !csvFile || !targetTenantId} className="glare-effect w-full bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white text-[10px] font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-[0_0_30px_rgba(217,70,239,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-105 active:scale-95">{isUploading ? <Activity size={18} className="animate-spin" /> : 'EXECUTE PROVISION'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* VIEW 3: EMPLOYERS                         */}
        {/* ========================================= */}
        {currentView === 'employers' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-fade-in-up">
            <div className="xl:col-span-8 bg-black/50 backdrop-blur-3xl border-t border-l border-indigo-500/30 border-r border-b border-black p-8 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <h3 className="text-[clamp(1.5rem,2vw,2.5rem)] font-black text-white mb-8 flex items-center gap-3 tracking-tighter"><Briefcase className="text-indigo-400" /> ENTERPRISE QUEUE</h3>
              {pendingEmpApps.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl"><CheckCircle className="text-slate-600 w-12 h-12 mx-auto mb-3" /><p className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Queue Empty</p></div>
              ) : (
                <div className="space-y-4">
                  {pendingEmpApps.map(app => (
                    <div key={app.id} className="bg-white/[0.02] border border-indigo-500/20 rounded-2xl p-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center shadow-lg">
                      <div>
                        <h4 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">{app.companyName} <span className="text-[9px] bg-amber-500/20 text-amber-400 px-2 py-1 rounded uppercase tracking-widest shadow-[0_0_10px_rgba(245,158,11,0.3)]">Review</span></h4>
                        <div className="flex flex-col sm:flex-row gap-4 mt-3 text-xs text-slate-400 font-bold tracking-widest uppercase">
                          <span className="flex items-center gap-1.5"><Mail size={14} className="text-indigo-400" /> {app.email}</span>
                          <span className="flex items-center gap-1.5"><Users size={14} className="text-fuchsia-400" /> {app.contactName}</span>
                          <span className="flex items-center gap-1.5"><Globe size={14} className="text-cyan-400" /> {app.industry}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={() => handleRejectEmployer(app.id)} disabled={processingId === app.id} className="flex-1 px-5 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"><X size={14} /> Terminate</button>
                        <button onClick={() => handleApproveEmployer(app)} disabled={processingId === app.id} className="glare-effect flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center gap-2 disabled:opacity-50">{processingId === app.id ? <Activity size={14} className="animate-spin" /> : <><Check size={14} /> Authorize</>}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="xl:col-span-4 bg-black/30 backdrop-blur-2xl border border-white/5 p-8 rounded-[3rem] h-fit sticky top-28">
              <h3 className="text-[10px] font-black text-slate-500 mb-6 uppercase tracking-widest">Authorized Enterprises</h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                {processedEmpApps.map(app => (
                  <div key={app.id} className="flex justify-between items-center p-4 bg-white/[0.01] rounded-xl border border-white/5 hover:border-indigo-500/30 transition-colors">
                    <div>
                      <p className="text-sm font-black text-slate-300 flex items-center gap-2 tracking-tight"><Building2 size={14} className="text-indigo-400" /> {app.companyName}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{app.email}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      {app.status === 'approved' ? (
                        <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 shadow-sm uppercase tracking-widest">VERIFIED</span>
                      ) : (
                        <span className="text-[9px] font-black text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 uppercase tracking-widest">REJECTED</span>
                      )}
                    </div>
                  </div>
                ))}
                {processedEmpApps.length === 0 && <p className="text-xs text-slate-600 text-center py-4 font-bold uppercase tracking-widest">No history</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}