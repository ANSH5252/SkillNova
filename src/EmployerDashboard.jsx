import React, { useState, useEffect, useRef } from 'react';
import { 
  Building, Search, Filter, Star, Briefcase, Award, 
  CheckCircle, Activity, UserPlus, MapPin, Users, FileText, 
  TrendingUp, Clock, Plus, X, Globe, DollarSign, Trash2, ChevronRight, Target, Crown, LogOut, Terminal, Layers, Sparkles
} from 'lucide-react';
import { auth, db } from './firebase';
import { collection, query, onSnapshot, orderBy, where, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore'; 
import { useAuth } from './AuthContext';

// --- CUSTOM SVG LOGO COMPONENT ---
const SkillNovaLogo = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M50 5L60.5 39.5L95 50L60.5 60.5L50 95L39.5 60.5L5 50L39.5 39.5L50 5Z" fill="url(#nova-employer)" />
    <circle cx="50" cy="50" r="18" fill="#04060d" />
    <circle cx="50" cy="50" r="8" fill="url(#nova-employer)" />
    <defs>
      <linearGradient id="nova-employer" x1="5" y1="5" x2="95" y2="95" gradientUnits="userSpaceOnUse">
        <stop stopColor="#10b981" />
        <stop offset="1" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
  </svg>
);

export default function EmployerDashboard() {
  const { currentUser } = useAuth();
  
  // --- UI TABS ---
  const [activeTab, setActiveTab] = useState('discovery'); // discovery, jobs, applicants
  const [selectedJobForApplicants, setSelectedJobForApplicants] = useState(null);

  // --- RAW DATA STATES ---
  const [rawScans, setRawScans] = useState([]);
  const [optedInEmails, setOptedInEmails] = useState(new Set());
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- DERIVED DATA STATE ---
  const [candidates, setCandidates] = useState([]);

  // --- FILTERS & ACTIONS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [shortlisted, setShortlisted] = useState(new Set());

  // --- JOB MODAL STATE ---
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobFormData, setJobFormData] = useState({
    title: '', location: '', salary: '', type: 'Full-time', description: '', requirements: ''
  });

  // --- ANIMATION / PARALLAX LOGIC ---
  const gridRef = useRef(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const timeOffset = useRef({ x: 0, y: 0 });

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

  // 1. Fetch Opted-In Students
  useEffect(() => {
    const profilesQ = query(collection(db, 'student_profiles'), where('openToOpportunities', '==', true));
    const unsubscribeProfiles = onSnapshot(profilesQ, (snapshot) => {
      const emails = new Set();
      snapshot.forEach(doc => { if (doc.data().email) emails.add(doc.data().email.toLowerCase()); });
      setOptedInEmails(emails);
    }, (error) => console.error("Error fetching profiles:", error));
    return () => unsubscribeProfiles();
  }, []);

  // 2. Fetch All Scans
  useEffect(() => {
    const scansQ = query(collection(db, 'ats_scans'), orderBy('timestamp', 'desc'));
    const unsubscribeScans = onSnapshot(scansQ, (snapshot) => {
      const fetchedScans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRawScans(fetchedScans);
    }, (error) => console.error("Error fetching scans:", error));
    return () => unsubscribeScans();
  }, []);

  // 3. Fetch Jobs
  useEffect(() => {
    if (!currentUser) return;
    try {
      const jobsQ = query(collection(db, 'jobs'), where('employerId', '==', currentUser.uid));
      const unsubscribeJobs = onSnapshot(jobsQ, (snapshot) => {
        const fetchedJobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setJobs(fetchedJobs);
      }, (error) => console.error("Error fetching jobs:", error));
      return () => unsubscribeJobs();
    } catch (err) { console.error("Jobs setup error:", err); }
  }, [currentUser]);

  // 4. Candidate Deduplication
  useEffect(() => {
    if (rawScans.length === 0 && optedInEmails.size === 0) { setLoading(false); return; }
    const allowedScans = rawScans.filter(scan => scan.userEmail && optedInEmails.has(scan.userEmail.toLowerCase()));
    const groupedCandidates = {};
    allowedScans.forEach(scan => {
      const email = scan.userEmail.toLowerCase();
      const score = scan.roleMatchScore || scan.score || 0;
      if (!groupedCandidates[email]) { groupedCandidates[email] = { ...scan, totalScans: 1 }; } 
      else {
        groupedCandidates[email].totalScans += 1;
        const currentBestScore = groupedCandidates[email].roleMatchScore || groupedCandidates[email].score || 0;
        if (score > currentBestScore) { groupedCandidates[email] = { ...scan, totalScans: groupedCandidates[email].totalScans }; }
      }
    });
    const finalCandidates = Object.values(groupedCandidates).sort((a, b) => {
      const scoreA = a.roleMatchScore || a.score || 0;
      const scoreB = b.roleMatchScore || b.score || 0;
      return scoreB - scoreA;
    });
    setCandidates(finalCandidates);
    setLoading(false);
  }, [rawScans, optedInEmails]);

  const handlePostJob = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'jobs'), {
        ...jobFormData, employerId: currentUser.uid, employerName: currentUser.displayName || 'Unknown Employer', createdAt: serverTimestamp(), active: true
      });
      setShowJobModal(false);
      setJobFormData({ title: '', location: '', salary: '', type: 'Full-time', description: '', requirements: '' });
    } catch (err) { alert("Error posting job: " + err.message); }
  };

  const handleDeleteJob = async (jobId, jobTitle) => {
    if (!window.confirm(`Are you sure you want to permanently remove the posting for "${jobTitle}"?`)) return;
    try { await deleteDoc(doc(db, 'jobs', jobId)); } 
    catch (err) { alert("Failed to delete job: " + err.message); }
  };

  const handleManageApplicants = (job) => {
    setSelectedJobForApplicants(job);
    setActiveTab('applicants');
  };

  const handleShortlist = (id) => {
    setShortlisted(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const availableRoles = ['All Roles', ...new Set(candidates.map(c => c.targetRole).filter(Boolean))];
  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = (c.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) || (c.foundSkills || []).join(' ').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All Roles' || c.targetRole === roleFilter;
    return matchesSearch && matchesRole;
  });
  const topCandidatesCount = candidates.filter(c => (c.roleMatchScore || c.score || 0) >= 75).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#04060d] flex flex-col items-center justify-center space-y-4 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-64 bg-emerald-500/20 blur-[100px] rounded-full animate-pulse"></div>
        </div>
        <Activity className="text-emerald-500 animate-spin w-12 h-12 relative z-10" />
        <p className="text-emerald-400 font-bold animate-pulse tracking-widest text-xs uppercase relative z-10">Initializing Connection...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04060d] text-slate-200 font-sans pb-24 relative overflow-x-hidden flex flex-col font-inter">
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
        .animate-fade-in-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, 0.2); border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(16, 185, 129, 0.5); }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(16, 185, 129, 0.2) transparent; }

        .bg-grid-godmode {
          background-image: 
            linear-gradient(to right, rgba(16,185,129,0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(6,182,212,0.08) 1px, transparent 1px),
            linear-gradient(to right, rgba(16,185,129,0.02) 1px, transparent 1px),
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

      {/* CONTINUOUS PARALLAX GRID BACKGROUND */}
      <div ref={gridRef} className="fixed inset-0 bg-grid-godmode [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)] pointer-events-none z-0"></div>

      {/* Dynamic Ambient Background */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] bg-gradient-to-b from-emerald-600/10 to-cyan-500/10 blur-[150px] rounded-full pointer-events-none z-0"></div>

      {/* --- FLOATING PREMIUM NAVBAR --- */}
      <div className="fixed top-4 md:top-6 w-full z-50 px-4 md:px-8 lg:px-12 flex justify-center animate-fade-in pointer-events-none">
        <nav className="w-full max-w-[1800px] 2xl:max-w-[95%] bg-[#0a0f1c]/80 backdrop-blur-2xl border border-emerald-500/20 rounded-full px-6 py-3 flex items-center justify-between shadow-[0_8px_32px_rgba(16,185,129,0.15)] pointer-events-auto transition-all hover:bg-[#0a0f1c]/95">
          {/* Left - Logo */}
          <div className="flex items-center gap-3 w-[30%] min-w-0">
            <SkillNovaLogo className="w-8 h-8 drop-shadow-[0_0_12px_rgba(16,185,129,0.5)] flex-shrink-0" />
            <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-tight hidden sm:block truncate uppercase">SkillNova Hub</span>
          </div>
          {/* Center - God Mode Indicator */}
          <div className="flex-1 flex justify-center items-center">
            <div className="flex items-center gap-2 relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-md rounded-full animate-pulse"></div>
              <span className="relative text-[10px] font-black tracking-widest uppercase text-white bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-2 whitespace-nowrap"><Building size={14} /> Enterprise Link</span>
            </div>
          </div>
          {/* Right - Profile & Signout */}
          <div className="flex items-center justify-end w-[30%] gap-4">
            <div className="hidden md:flex px-4 py-2 bg-black/50 border border-white/5 rounded-full items-center gap-2 shadow-inner">
              <Star className="text-emerald-400 fill-emerald-400/20" size={14} />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">{shortlisted.size} Shortlisted</span>
            </div>
            <button onClick={() => auth.signOut()} className="group flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-rose-500/20 border border-white/10 transition-all shadow-[0_0_15px_rgba(0,0,0,0.4)]">
              <LogOut size={16} className="text-slate-300 group-hover:text-rose-400 transition-colors" />
            </button>
          </div>
        </nav>
      </div>

      <div className="relative z-10 flex-grow px-4 md:px-8 lg:px-12 pt-40 pb-20 max-w-[1800px] 2xl:max-w-[95%] mx-auto w-full animate-fade-in-up delay-200">
        
        {/* --- COMMAND CONSOLE TOGGLES --- */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 bg-[#121216]/50 backdrop-blur-3xl border-t border-l border-emerald-500/30 border-r border-b border-black rounded-[2rem] mb-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-emerald-500/10 to-transparent blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
          <div className="flex flex-col sm:flex-row items-center gap-3 relative z-10 w-full md:w-auto">
            <button onClick={() => setActiveTab('discovery')} className={`glare-effect w-full sm:w-auto px-6 py-4 font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-105 active:scale-95 whitespace-nowrap border-b-2 ${activeTab === 'discovery' ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-black/60 hover:bg-black/80 text-emerald-500 border-transparent hover:border-emerald-500/50'}`}><Search size={16} /> Talent Discovery</button>
            <button onClick={() => setActiveTab('jobs')} className={`glare-effect w-full sm:w-auto px-6 py-4 font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-105 active:scale-95 whitespace-nowrap border-b-2 ${activeTab === 'jobs' ? 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'bg-black/60 hover:bg-black/80 text-cyan-500 border-transparent hover:border-cyan-500/50'}`}><Briefcase size={16} /> Active Postings {jobs.length > 0 && <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-full">{jobs.length}</span>}</button>
            <button onClick={() => setActiveTab('applicants')} className={`glare-effect w-full sm:w-auto px-6 py-4 font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-105 active:scale-95 whitespace-nowrap border-b-2 ${activeTab === 'applicants' ? 'bg-teal-600 hover:bg-teal-500 text-white border-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.4)]' : 'bg-black/60 hover:bg-black/80 text-teal-400 border-transparent hover:border-teal-500/50'}`}><Users size={16} /> Track Applicants</button>
          </div>
        </div>

        {activeTab === 'discovery' && (
          <div className="animate-fade-in-up">
            {/* --- METRICS --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 perspective-1000">
              <div className="bg-black/40 backdrop-blur-md border-t border-l border-emerald-500/30 border-r border-b border-black p-6 rounded-[2rem] flex justify-between items-center transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_15px_30px_rgba(0,0,0,0.5)] group overflow-hidden relative">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-emerald-500/10 blur-[40px] rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                <div className="relative z-10">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Discovery Pool</div>
                  <div className="flex items-baseline gap-2"><h4 className="text-4xl font-black text-white tracking-tighter">{candidates.length}</h4></div>
                  <div className="text-[9px] font-bold uppercase tracking-widest mt-1 text-emerald-400">Total Available</div>
                </div>
                <div className="relative z-10 bg-emerald-500/10 p-4 rounded-2xl group-hover:scale-110 group-hover:rotate-12 transition-transform shadow-inner">
                  <Layers className="text-emerald-400" size={28} />
                </div>
              </div>
              <div className="bg-black/40 backdrop-blur-md border-t border-l border-teal-500/30 border-r border-b border-black p-6 rounded-[2rem] flex justify-between items-center transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_15px_30px_rgba(0,0,0,0.5)] group overflow-hidden relative">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-teal-500/10 blur-[40px] rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                <div className="relative z-10">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Top Match Rate</div>
                  <div className="flex items-baseline gap-2"><h4 className="text-4xl font-black text-white tracking-tighter">{topCandidatesCount}</h4></div>
                  <div className="text-[9px] font-bold uppercase tracking-widest mt-1 text-teal-400">Scores &gt; 75%</div>
                </div>
                <div className="relative z-10 bg-teal-500/10 p-4 rounded-2xl group-hover:scale-110 group-hover:rotate-12 transition-transform shadow-inner">
                  <Sparkles className="text-teal-400" size={28} />
                </div>
              </div>
              <div className="bg-black/40 backdrop-blur-md border-t border-l border-cyan-500/30 border-r border-b border-black p-6 rounded-[2rem] flex justify-between items-center transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_15px_30px_rgba(0,0,0,0.5)] group overflow-hidden relative">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-cyan-500/10 blur-[40px] rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                <div className="relative z-10">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Industry Roles</div>
                  <div className="flex items-baseline gap-2"><h4 className="text-4xl font-black text-white tracking-tighter">{availableRoles.length - 1}</h4></div>
                  <div className="text-[9px] font-bold uppercase tracking-widest mt-1 text-cyan-400">Unique Targets</div>
                </div>
                <div className="relative z-10 bg-cyan-500/10 p-4 rounded-2xl group-hover:scale-110 group-hover:rotate-12 transition-transform shadow-inner">
                  <Target className="text-cyan-400" size={28} />
                </div>
              </div>
            </div>

            {/* --- FILTERS --- */}
            <div className="flex flex-col md:flex-row gap-4 mb-8 bg-black/30 backdrop-blur-3xl border border-white/5 p-4 rounded-[2rem]">
              <div className="relative flex-grow">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500/50" size={18} />
                <input 
                  type="text" 
                  placeholder="FILTER COMMAND: EMAIL OR SKILL..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-[10px] font-black tracking-widest uppercase text-white outline-none focus:border-emerald-500/50 transition-all shadow-inner"
                />
              </div>
              <div className="relative min-w-[300px]">
                <Filter className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500/50" size={18} />
                <select 
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-[10px] font-black tracking-widest uppercase text-white outline-none appearance-none cursor-pointer focus:border-emerald-500/50 transition-all"
                >
                  {availableRoles.map(role => (
                    <option key={role} value={role} className="bg-slate-900">{role}</option>
                  ))}
                </select>
                <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 rotate-90 pointer-events-none" size={16} />
              </div>
            </div>

            {/* --- CANDIDATE DATA SHARDS --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredCandidates.map((candidate, index) => {
                const score = candidate.roleMatchScore || candidate.score || 0;
                const isShortlisted = shortlisted.has(candidate.email || candidate.id);
                return (
                  <div key={candidate.id} className={`bg-black/50 backdrop-blur-3xl border-t border-l border-r border-b group relative overflow-hidden transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 rounded-[2.5rem] animate-fade-in-up ${isShortlisted ? 'border-t-emerald-500/40 border-l-emerald-500/40 border-b-black border-r-black hover:border-emerald-400/80 bg-emerald-900/10' : 'border-white/10 border-b-black border-r-black hover:border-emerald-500/30'} flex flex-col`} style={{animationDelay: `${(index * 50)}ms`}}>
                    {isShortlisted && <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none z-0"></div>}
                    
                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <div className="max-w-[65%] min-w-0">
                        <h3 className="text-lg font-black text-white truncate drop-shadow-sm">{candidate.userEmail || 'ANONYMOUS'}</h3>
                        <div className="flex items-center gap-2 mt-2">
                           <span className="text-[9px] text-cyan-400 font-black uppercase tracking-widest bg-cyan-500/10 px-2 py-1.5 rounded-md border border-cyan-500/20 shadow-sm truncate inline-block max-w-[150px]">
                             <Target size={10} className="inline mr-1 -mt-0.5" /> {candidate.targetRole || 'ENGINEERING'}
                           </span>
                        </div>
                      </div>
                      <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center border ${score >= 75 ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'border-teal-500/30 text-teal-400 bg-teal-500/10'} font-black flex-shrink-0`}>
                        <span className="text-2xl leading-none">{score}</span>
                        <span className="text-[8px] uppercase opacity-80 tracking-widest mt-0.5">MATCH</span>
                      </div>
                    </div>
                    
                    <div className="space-y-4 mb-6 relative z-10 flex-grow">
                       <div className="flex flex-wrap gap-2">
                        {(candidate.foundSkills || []).slice(0, 3).map((s, i) => (
                           <span key={i} className="text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-slate-300 px-2.5 py-1.5 rounded-lg shadow-sm">{s}</span>
                        ))}
                       </div>
                       <div className="grid grid-cols-2 gap-3 mt-4">
                         <div className="bg-black/40 p-4 rounded-[1.5rem] border border-white/5">
                            <p className="text-[8px] text-slate-500 font-black uppercase mb-1.5 tracking-widest flex items-center gap-1.5"><Activity size={10} className="text-emerald-500"/> USAGE</p>
                            <p className="text-xs font-black text-white uppercase tracking-widest">{candidate.totalScans} SCANS</p>
                         </div>
                         <div className="bg-black/40 p-4 rounded-[1.5rem] border border-white/5">
                            <p className="text-[8px] text-slate-500 font-black uppercase mb-1.5 tracking-widest flex items-center gap-1.5"><MapPin size={10} className="text-cyan-500"/> ORIGIN</p>
                            <p className="text-xs font-black text-white truncate uppercase tracking-widest">{candidate.tenantId || 'PUBLIC HUB'}</p>
                         </div>
                       </div>
                    </div>

                    <button 
                      onClick={() => handleShortlist(candidate.email || candidate.id)}
                      className={`relative z-10 w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-lg flex items-center justify-center gap-2 mt-auto
                        ${isShortlisted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30' : 'bg-white/5 hover:bg-emerald-600 border border-white/10 hover:border-emerald-400 text-slate-300 hover:text-white'}
                      `}
                    >
                      {isShortlisted ? <><CheckCircle size={14} /> SHORTLISTED</> : <><UserPlus size={14} /> PIPELINE CANDIDATE</>}
                    </button>
                  </div>
                );
              })}
            </div>
            {filteredCandidates.length === 0 && !loading && (
               <div className="py-24 text-center border-2 border-dashed border-white/10 rounded-[3rem] bg-black/30 backdrop-blur-md">
                 <Search size={48} className="mx-auto text-emerald-500/30 mb-4" />
                 <h3 className="text-xl font-black text-white tracking-tight uppercase">NO DATA STREAMS FOUND</h3>
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">ADJUST FILTER PROTOCOLS TO WIDEN NET.</p>
               </div>
            )}
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4 bg-black/30 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5">
              <div>
                <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3"><Terminal className="text-cyan-400" /> ACTIVE LISTINGS</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manage your corporate pipeline requirements.</p>
              </div>
              <button 
                onClick={() => setShowJobModal(true)}
                className="glare-effect px-6 py-4 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-2 hover:scale-105 active:scale-95"
              >
                <Plus size={16} /> INITIATE POSTING
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {jobs.map(job => (
                <div key={job.id} className="bg-black/50 backdrop-blur-3xl border-t border-l border-cyan-500/30 border-r border-b border-black p-8 rounded-[3rem] relative overflow-hidden group hover:border-cyan-400 transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-cyan-500/10 blur-[50px] rounded-full pointer-events-none group-hover:bg-cyan-500/20 transition-all duration-700"></div>
                  <div className="flex justify-between items-start mb-8 relative z-10">
                    <div>
                      <h3 className="text-[clamp(1.5rem,2vw,2rem)] font-black text-white mb-3 leading-none tracking-tighter uppercase">{job.title}</h3>
                      <div className="flex flex-wrap items-center gap-3">
                         <span className="text-[9px] font-black uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg text-slate-300 flex items-center gap-1.5"><MapPin size={12} className="text-cyan-400"/> {job.location}</span>
                         <span className="text-[9px] font-black uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg text-slate-300 flex items-center gap-1.5"><Globe size={12} className="text-emerald-400"/> {job.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-black text-xs tracking-widest shadow-inner whitespace-nowrap">{job.salary}</div>
                        <button 
                          onClick={() => handleDeleteJob(job.id, job.title)}
                          className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl transition-all shadow-sm"
                          title="Terminate Posting"
                        >
                          <Trash2 size={16} />
                        </button>
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-slate-400 leading-relaxed mb-8 border-l-2 border-cyan-500/40 pl-5 relative z-10 flex-grow uppercase tracking-wide opacity-80 line-clamp-3">
                    {job.description}
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-6 border-t border-white/10 relative z-10">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
                       <Clock size={12} className="text-cyan-500"/> ONLINE {job.createdAt?.toDate ? new Date(job.createdAt.toDate()).toLocaleDateString() : 'SYNCING'}
                    </span>
                    <button 
                      onClick={() => handleManageApplicants(job)}
                      className="glare-effect px-4 py-2.5 bg-cyan-600/20 hover:bg-cyan-500 text-cyan-300 hover:text-white border border-cyan-500/40 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-1.5"
                    >
                      ANALYZE QUEUE <ChevronRight size={14}/>
                    </button>
                  </div>
                </div>
              ))}
              {jobs.length === 0 && (
                <div className="col-span-full py-24 text-center border-2 border-dashed border-white/10 rounded-[3rem] bg-black/30 backdrop-blur-md">
                  <Briefcase size={48} className="mx-auto text-cyan-500/30 mb-4" />
                  <h3 className="text-xl font-black text-white tracking-tight uppercase">NO ACTIVE LISTINGS</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">DEPLOY YOUR FIRST PIPELINE PROTOCOL.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'applicants' && (
          <div className="animate-fade-in-up">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 bg-black/30 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5">
                <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3"><Users className="text-teal-400" /> APPLICANT QUEUE</h2>
                {selectedJobForApplicants && (
                    <button 
                        onClick={() => setSelectedJobForApplicants(null)}
                        className="text-[9px] font-black uppercase tracking-widest px-4 py-2 bg-teal-500/10 text-teal-400 border border-teal-500/30 rounded-xl flex items-center gap-2 hover:bg-teal-500/20 transition-all shadow-sm group"
                    >
                        TARGET: <span className="text-white truncate max-w-[150px]">{selectedJobForApplicants.title}</span> 
                        <X size={14} className="text-teal-500 group-hover:text-rose-400 transition-colors" />
                    </button>
                )}
              </div>
              <div className="py-24 text-center border-2 border-dashed border-white/10 rounded-[3rem] bg-black/30 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <Users size={64} className="mx-auto text-teal-500/20 mb-6 drop-shadow-md" />
                <h3 className="text-2xl font-black text-white tracking-tighter uppercase mb-3">
                    {selectedJobForApplicants ? `AWAITING INCOMING FOR ${selectedJobForApplicants.title}` : 'ADVANCED QUEUE TRACKING IMMINENT'}
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest max-w-[500px] mx-auto leading-relaxed">
                    INCOMING STUDENT PROFILES ROUTED VIA ENCRYPTED PORTALS WILL APPEAR HERE ONCE MATRIX SYNC COMPLETES.
                </p>
              </div>
          </div>
        )}

      </div>

      {/* --- POST JOB MODAL --- */}
      {showJobModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#04060d]/95 backdrop-blur-xl" onClick={() => setShowJobModal(false)}></div>
          <div className="bg-black/80 backdrop-blur-3xl border-t border-l border-cyan-500/40 border-r border-b border-black w-full max-w-3xl rounded-[3rem] p-8 md:p-12 relative z-10 shadow-[0_20px_60px_rgba(6,182,212,0.3)] animate-fade-in-up overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/10 blur-[80px] rounded-full pointer-events-none"></div>
            
            <button onClick={() => setShowJobModal(false)} className="absolute top-8 right-8 w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all z-20">
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-4 mb-10 relative z-10">
              <div className="w-14 h-14 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center justify-center shadow-inner">
                <Terminal className="text-cyan-400" size={28} />
              </div>
              <div>
                <h2 className="text-[clamp(1.8rem,3vw,2.5rem)] font-black text-white tracking-tighter uppercase leading-none">INJECT PROTOCOL</h2>
                <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mt-1">NEW ENTERPRISE LISTING</p>
              </div>
            </div>
            
            <form onSubmit={handlePostJob} className="space-y-6 relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">TARGET DESIGNATION</label>
                  <input 
                    required
                    value={jobFormData.title}
                    onChange={(e) => setJobFormData({...jobFormData, title: e.target.value})}
                    placeholder="E.G. SR. DATA ENGINEER"
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-5 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-cyan-500/80 transition-all shadow-inner"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">GEOGRAPHIC ORIGIN</label>
                  <input 
                    required
                    value={jobFormData.location}
                    onChange={(e) => setJobFormData({...jobFormData, location: e.target.value})}
                    placeholder="E.G. BOSTON, MA / REMOTE"
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-5 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-cyan-500/80 transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">COMPENSATION VECTOR</label>
                  <input 
                    required
                    value={jobFormData.salary}
                    onChange={(e) => setJobFormData({...jobFormData, salary: e.target.value})}
                    placeholder="E.G. $140K - $160K"
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-5 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-cyan-500/80 transition-all shadow-inner"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">CONTRACT TYPE</label>
                  <div className="relative">
                    <select 
                      value={jobFormData.type}
                      onChange={(e) => setJobFormData({...jobFormData, type: e.target.value})}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-4 pl-5 pr-10 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-cyan-500/80 appearance-none transition-all shadow-inner cursor-pointer"
                    >
                      <option value="Full-time">FULL-TIME DIRECTIVE</option>
                      <option value="Contract">CONTRACT ALIGNMENT</option>
                      <option value="Internship">INCUBATION PIPELINE</option>
                    </select>
                    <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 rotate-90 pointer-events-none" size={16} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">MISSION DOSSIER (DESCRIPTION)</label>
                <textarea 
                  required
                  rows={5}
                  value={jobFormData.description}
                  onChange={(e) => setJobFormData({...jobFormData, description: e.target.value})}
                  placeholder="PROVIDE MISSION PARAMETERS..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-5 text-[10px] font-bold tracking-widest uppercase text-white outline-none focus:border-cyan-500/80 resize-none transition-all shadow-inner custom-scrollbar"
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  className="glare-effect w-full py-5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-[0_0_30px_rgba(6,182,212,0.4)] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98]"
                >
                  EXECUTE APPEND <Activity size={18} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}