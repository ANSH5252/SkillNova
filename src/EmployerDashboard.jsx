import React, { useState, useEffect, useRef } from 'react';
import { 
  Building, Search, Filter, Star, Briefcase, Award, 
  CheckCircle, Activity, UserPlus, MapPin, Users, FileText, 
  TrendingUp, Clock, Plus, X, Globe, DollarSign, Trash2, ChevronRight, Target
} from 'lucide-react';
import { auth, db } from './firebase';
import { collection, query, onSnapshot, orderBy, where, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore'; 
import { useAuth } from './AuthContext';

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
    title: '',
    location: '',
    salary: '',
    type: 'Full-time',
    description: '',
    requirements: ''
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

  // 1. Fetch Opted-In Students
  useEffect(() => {
    const profilesQ = query(collection(db, 'student_profiles'), where('openToOpportunities', '==', true));
    const unsubscribeProfiles = onSnapshot(profilesQ, (snapshot) => {
      const emails = new Set();
      snapshot.forEach(doc => {
        if (doc.data().email) emails.add(doc.data().email.toLowerCase());
      });
      setOptedInEmails(emails);
    }, (error) => console.error("Error fetching profiles:", error));

    return () => unsubscribeProfiles();
  }, []);

  // 2. Fetch All Scans (For Candidate Discovery)
  useEffect(() => {
    const scansQ = query(collection(db, 'ats_scans'), orderBy('timestamp', 'desc'));
    const unsubscribeScans = onSnapshot(scansQ, (snapshot) => {
      const fetchedScans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRawScans(fetchedScans);
    }, (error) => console.error("Error fetching scans:", error));

    return () => unsubscribeScans();
  }, []);

  // 3. Fetch Jobs Posted by this Employer
  useEffect(() => {
    if (!currentUser) return;
    try {
      const jobsQ = query(collection(db, 'jobs'), where('employerId', '==', currentUser.uid));
      const unsubscribeJobs = onSnapshot(jobsQ, (snapshot) => {
        const fetchedJobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Fetched Jobs:", fetchedJobs);
        setJobs(fetchedJobs);
      }, (error) => {
          console.error("Error fetching jobs:", error);
          if (error.code === 'failed-precondition') {
              console.warn("Firestore index required for this query.");
          }
      });

      return () => unsubscribeJobs();
    } catch (err) {
      console.error("Jobs setup error:", err);
    }
  }, [currentUser]);

  // 4. Candidate Deduplication logic
  useEffect(() => {
    if (rawScans.length === 0 && optedInEmails.size === 0) {
      setLoading(false);
      return;
    }

    const allowedScans = rawScans.filter(scan => 
      scan.userEmail && optedInEmails.has(scan.userEmail.toLowerCase())
    );

    const groupedCandidates = {};
    allowedScans.forEach(scan => {
      const email = scan.userEmail.toLowerCase();
      const score = scan.roleMatchScore || scan.score || 0;
      
      if (!groupedCandidates[email]) {
        groupedCandidates[email] = { ...scan, totalScans: 1 };
      } else {
        groupedCandidates[email].totalScans += 1;
        const currentBestScore = groupedCandidates[email].roleMatchScore || groupedCandidates[email].score || 0;
        if (score > currentBestScore) {
          groupedCandidates[email] = { 
            ...scan, 
            totalScans: groupedCandidates[email].totalScans 
          };
        }
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
      console.log("Post Job Start");
      const docRef = await addDoc(collection(db, 'jobs'), {
        ...jobFormData,
        employerId: currentUser.uid,
        employerName: currentUser.displayName || 'Unknown Employer',
        createdAt: serverTimestamp(),
        active: true
      });
      console.log("Post Job Success:", docRef.id);
      setShowJobModal(false);
      setJobFormData({ title: '', location: '', salary: '', type: 'Full-time', description: '', requirements: '' });
    } catch (err) {
      console.error("Post job error:", err);
      alert("Error posting job: " + err.message);
    }
  };

  const handleDeleteJob = async (jobId, jobTitle) => {
    const confirmed = window.confirm(`Are you sure you want to permanently remove the posting for "${jobTitle}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'jobs', jobId));
      console.log("Job deleted:", jobId);
    } catch (err) {
      console.error("Delete job error:", err);
      alert("Failed to delete job: " + err.message);
    }
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
    const matchesSearch = (c.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (c.foundSkills || []).join(' ').toLowerCase().includes(searchTerm.toLowerCase());
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
        <p className="text-emerald-400 font-bold animate-pulse tracking-widest text-xs uppercase relative z-10">Initializing Pipeline...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04060d] text-slate-200 p-4 md:p-8 font-sans pb-24 relative overflow-x-hidden">
      
      <style dangerouslySetInnerHTML={{ __html: `
          /* DUAL-LAYERED GRID LOGIC (Matched to Landing Page) */
          .bg-grid-pattern {
            background-image: 
              linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px),
              linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
            background-size: 100px 100px, 100px 100px, 20px 20px, 20px 20px;
            transition: background-position 0.1s ease-out;
          }
          @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(20px); filter: blur(4px); }
            to { opacity: 1; transform: translateY(0); filter: blur(0); }
          }
          .animate-fade-in-up { animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
          .animate-fade-in { animation: fade-in 1s ease-out forwards; opacity: 0; }
          @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
      `}} />

      {/* CONTINUOUS PARALLAX GRID BACKGROUND FROM LANDING PAGE */}
      <div ref={gridRef} className="fixed inset-0 bg-grid-pattern [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)] pointer-events-none z-0"></div>

      {/* Dynamic Ambient Background */}
      <div className="fixed top-0 right-0 w-[800px] h-[500px] bg-gradient-to-bl from-emerald-600/10 to-teal-600/10 blur-[150px] rounded-full pointer-events-none z-0"></div>
      <div className="fixed bottom-0 left-0 w-[600px] h-[400px] bg-gradient-to-tr from-teal-900/20 to-cyan-800/10 blur-[120px] rounded-full pointer-events-none z-0"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* --- TOP NAVIGATION & BRANDING --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 border-b border-white/5 pb-6 gap-6 animate-fade-in-up">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest shadow-sm">
                <Building size={14} className="text-emerald-400" /> SkillNova Enterprise Hub
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-1 drop-shadow-sm">
              Manage <span className="text-transparent bg-clip-text bg-gradient-to-br from-emerald-300 via-teal-400 to-cyan-400">Ecosystem</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="px-5 py-2.5 bg-[#0a0f1c]/80 backdrop-blur-md border border-white/10 rounded-xl flex items-center gap-2.5 shadow-xl">
              <Star className="text-emerald-400 fill-emerald-400/20" size={18} />
              <span className="text-xs font-black text-white uppercase tracking-widest">{shortlisted.size} Candidates</span>
            </div>
            <button onClick={() => auth.signOut()} className="px-5 py-2.5 bg-slate-800/80 backdrop-blur-md hover:bg-rose-500/10 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg">
              Sign Out
            </button>
          </div>
        </div>

        {/* --- TABS --- */}
        <div className="flex items-center gap-1 p-1.5 bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl mb-10 w-fit shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-fade-in-up" style={{animationDelay: '100ms'}}>
          {[
            { id: 'discovery', label: 'Talent Discovery', icon: <Search size={16} /> },
            { id: 'jobs', label: 'My Postings', icon: <Briefcase size={16} /> },
            { id: 'applicants', label: 'Applicants', icon: <Users size={16} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300
                ${activeTab === tab.id 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-emerald-400/20 scale-[1.02]' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'discovery' && (
          <div className="animate-fade-in-up" style={{animationDelay: '200ms'}}>
            {/* --- METRICS --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/5 p-8 rounded-3xl group transition-all duration-500 hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500"></div>
                <div className="relative z-10">
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4">Discovery Pool</p>
                  <div className="flex items-end justify-between">
                    <h4 className="text-5xl font-black text-white leading-none">{candidates.length}</h4>
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                      <Users className="text-emerald-400" size={24} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/5 p-8 rounded-3xl group transition-all duration-500 hover:border-teal-500/50 hover:shadow-[0_0_30px_rgba(20,184,166,0.15)] relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition-all duration-500"></div>
                <div className="relative z-10">
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4">Top Match Rate</p>
                  <div className="flex items-end justify-between">
                    <h4 className="text-5xl font-black text-teal-400 leading-none">{topCandidatesCount}</h4>
                    <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                      <Award className="text-teal-400" size={24} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/5 p-8 rounded-3xl group transition-all duration-500 hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all duration-500"></div>
                <div className="relative z-10">
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4">Industry Roles</p>
                  <div className="flex items-end justify-between">
                    <h4 className="text-5xl font-black text-white leading-none">{availableRoles.length - 1}</h4>
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                      <Target className="text-cyan-400" size={24} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* --- FILTERS --- */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="relative flex-grow">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500/50" size={18} />
                <input 
                  type="text" 
                  placeholder="Filter by skill or email..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#0a0f1c]/80 backdrop-blur-md border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:border-emerald-500/50 transition-all shadow-inner hover:border-white/20"
                />
              </div>
              <div className="relative min-w-[200px]">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500/50" size={18} />
                <select 
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full bg-[#0a0f1c]/80 backdrop-blur-md border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white outline-none appearance-none cursor-pointer focus:border-emerald-500/50 hover:border-white/20 transition-all"
                >
                  {availableRoles.map(role => (
                    <option key={role} value={role} className="bg-slate-900">{role}</option>
                  ))}
                </select>
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 rotate-90 pointer-events-none" size={16} />
              </div>
            </div>

            {/* --- CANDIDATE GRID --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredCandidates.map((candidate, index) => {
                const score = candidate.roleMatchScore || candidate.score || 0;
                const isShortlisted = shortlisted.has(candidate.email || candidate.id);
                return (
                  <div key={candidate.id} className={`bg-[#0a0f1c]/80 backdrop-blur-xl border ${isShortlisted ? 'border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)] bg-emerald-900/10' : 'border-white/5 hover:border-emerald-500/30 hover:bg-white/[0.02]'} p-6 rounded-3xl transition-all duration-500 group relative overflow-hidden animate-fade-in-up`} style={{animationDelay: `${(index * 50) + 300}ms`}}>
                    {isShortlisted && <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none"></div>}
                    
                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <div className="max-w-[180px]">
                        <h3 className="text-lg font-bold text-white truncate group-hover:text-emerald-400 transition-colors">{candidate.userEmail || 'Anonymous'}</h3>
                        <p className="text-[10px] text-teal-400 font-black uppercase tracking-widest mt-2 bg-teal-500/10 w-fit px-2.5 py-1 rounded-md border border-teal-500/20 flex items-center gap-1.5 shadow-sm">
                          <Target size={12} className="text-teal-400" /> {candidate.targetRole || 'Engineering'}
                        </p>
                      </div>
                      <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border ${score >= 75 ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'} font-black text-xl`}>
                        {score}
                        <span className="text-[8px] uppercase -mt-1 opacity-80 tracking-widest">ATS</span>
                      </div>
                    </div>
                    
                    <div className="space-y-4 mb-6 relative z-10">
                       <div className="flex flex-wrap gap-2">
                        {(candidate.foundSkills || []).slice(0, 3).map((s, i) => (
                           <span key={i} className="text-[10px] font-bold bg-[#1e293b]/80 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg shadow-sm">{s}</span>
                        ))}
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                         <div className="bg-slate-800/40 p-3 rounded-2xl border border-white/5">
                            <p className="text-[9px] text-slate-500 font-bold uppercase mb-1 tracking-widest flex items-center gap-1.5"><Activity size={10} className="text-emerald-500"/> Activity</p>
                            <p className="text-xs font-bold text-white">{candidate.totalScans} Scans</p>
                         </div>
                         <div className="bg-slate-800/40 p-3 rounded-2xl border border-white/5">
                            <p className="text-[9px] text-slate-500 font-bold uppercase mb-1 tracking-widest flex items-center gap-1.5"><MapPin size={10} className="text-cyan-500"/> Cohort</p>
                            <p className="text-xs font-bold text-white truncate">{candidate.tenantId || 'PUBLIC'}</p>
                         </div>
                       </div>
                    </div>

                    <button 
                      onClick={() => handleShortlist(candidate.email || candidate.id)}
                      className={`relative z-10 w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 shadow-sm flex items-center justify-center gap-2
                        ${isShortlisted ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-400/20'}
                      `}
                    >
                      {isShortlisted ? <><CheckCircle size={14} className="text-emerald-400" /> Shortlisted</> : <><UserPlus size={14} /> Shortlist Candidate</>}
                    </button>
                  </div>
                );
              })}
            </div>
            {filteredCandidates.length === 0 && !loading && (
               <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02]">
                 <Search size={48} className="mx-auto text-slate-700 mb-4 opacity-50" />
                 <h3 className="text-xl font-bold text-slate-400">No matching candidates</h3>
                 <p className="text-slate-500 text-sm mt-2">Adjust your filters or search terms.</p>
               </div>
            )}
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight drop-shadow-sm">Active Postings</h2>
                <p className="text-slate-400 text-sm mt-1">Manage your corporate job listings and hiring pipelines.</p>
              </div>
              <button 
                onClick={() => setShowJobModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-400/20"
              >
                <Plus size={18} /> New Posting
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {jobs.map(job => (
                <div key={job.id} className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 p-8 rounded-3xl relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-500 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-500"></div>
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors duration-300">{job.title}</h3>
                      <p className="text-slate-400 text-sm flex items-center gap-2 font-medium tracking-wide"><MapPin size={14} className="text-teal-500"/> {job.location} <span className="opacity-40">&bull;</span> <Globe size={14} className="text-cyan-500"/> {job.type}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 font-bold text-sm tracking-wide shadow-sm flex items-center gap-1.5"><DollarSign size={14} />{job.salary}</div>
                        <button 
                          onClick={() => handleDeleteJob(job.id, job.title)}
                          className="p-2 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-xl transition-all"
                          title="Delete Posting"
                        >
                          <Trash2 size={18} />
                        </button>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-8 border-l-2 border-emerald-500/30 pl-4 italic relative z-10">
                    "{job.description?.substring(0, 150)}..."
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-6 border-t border-white/5 relative z-10">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                       <Clock size={14} className="text-emerald-500/50"/> Posted {job.createdAt?.toDate ? new Date(job.createdAt.toDate()).toLocaleDateString() : 'Just now'}
                    </span>
                    <button 
                      onClick={() => handleManageApplicants(job)}
                      className="text-xs font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-all flex items-center gap-1 group-hover:translate-x-1 duration-300"
                    >
                      Process Applicants <ChevronRight size={16}/>
                    </button>
                  </div>
                </div>
              ))}
              {jobs.length === 0 && (
                <div className="col-span-full py-24 text-center border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02]">
                  <Briefcase size={48} className="mx-auto text-slate-700 mb-4 opacity-50" />
                  <h3 className="text-xl font-bold text-slate-400">No active postings found</h3>
                  <p className="text-slate-500 text-sm mt-2">Start your first hiring campaign by clicking "New Posting".</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'applicants' && (
          <div className="animate-fade-in-up">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-white tracking-tight drop-shadow-sm">Applicant Tracking</h2>
                {selectedJobForApplicants && (
                    <button 
                        onClick={() => setSelectedJobForApplicants(null)}
                        className="text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center gap-2 hover:bg-emerald-500/20 transition-all shadow-sm"
                    >
                        Filtering: <span className="text-white">{selectedJobForApplicants.title}</span> <X size={14} className="text-emerald-500" />
                    </button>
                )}
              </div>
              <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02]">
                <Users size={48} className="mx-auto text-emerald-500/20 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">
                    {selectedJobForApplicants ? `No applicants yet for ${selectedJobForApplicants.title}` : 'Advanced Applicant Tracking Coming Soon'}
                </h3>
                <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                    This section will display students who specifically applied to your postings through the SkillNova Student Portal over the encrypted network.
                </p>
              </div>
          </div>
        )}

      </div>

      {/* --- POST JOB MODAL --- */}
      {showJobModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#04060d]/90 backdrop-blur-md" onClick={() => setShowJobModal(false)}></div>
          <div className="bg-[#0a0f1c] border border-white/10 w-full max-w-2xl rounded-3xl p-8 md:p-10 relative z-10 shadow-2xl animate-fade-in-up">
            <button onClick={() => setShowJobModal(false)} className="absolute top-6 right-6 w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center shadow-inner">
                <Briefcase className="text-emerald-400" size={24} />
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight">Create New Posting</h2>
            </div>
            
            <form onSubmit={handlePostJob} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Job Title</label>
                  <input 
                    required
                    value={jobFormData.title}
                    onChange={(e) => setJobFormData({...jobFormData, title: e.target.value})}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl py-3 px-4 text-white outline-none focus:border-emerald-500/80 transition-colors shadow-inner"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Location</label>
                  <input 
                    required
                    value={jobFormData.location}
                    onChange={(e) => setJobFormData({...jobFormData, location: e.target.value})}
                    placeholder="e.g. San Francisco, Remote"
                    className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl py-3 px-4 text-white outline-none focus:border-emerald-500/80 transition-colors shadow-inner"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Salary Estimate</label>
                  <input 
                    required
                    value={jobFormData.salary}
                    onChange={(e) => setJobFormData({...jobFormData, salary: e.target.value})}
                    placeholder="e.g. $120k - $150k"
                    className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl py-3 px-4 text-white outline-none focus:border-emerald-500/80 transition-colors shadow-inner"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Job Type</label>
                  <div className="relative">
                    <select 
                      value={jobFormData.type}
                      onChange={(e) => setJobFormData({...jobFormData, type: e.target.value})}
                      className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl py-3 pl-4 pr-10 text-white outline-none focus:border-emerald-500/80 appearance-none transition-colors shadow-inner cursor-pointer"
                    >
                      <option value="Full-time">Full-time</option>
                      <option value="Contract">Contract</option>
                      <option value="Internship">Internship</option>
                    </select>
                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 rotate-90 pointer-events-none" size={16} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Detailed Description</label>
                <textarea 
                  required
                  rows={4}
                  value={jobFormData.description}
                  onChange={(e) => setJobFormData({...jobFormData, description: e.target.value})}
                  placeholder="Describe the role and your company vision..."
                  className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl py-3 px-4 text-white outline-none focus:border-emerald-500/80 resize-none transition-colors shadow-inner"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-400/20 flex items-center justify-center gap-2"
              >
                Launch Posting <Target size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}