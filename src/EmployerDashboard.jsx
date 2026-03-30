import React, { useState, useEffect } from 'react';
import { 
  Building, Search, Filter, Star, Briefcase, Award, 
  CheckCircle, Activity, UserPlus, MapPin, Users, FileText, TrendingUp, Clock
} from 'lucide-react';
import { auth, db } from './firebase';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore'; 
import { useAuth } from './AuthContext';

export default function EmployerDashboard() {
  const { currentUser } = useAuth();
  
  // --- RAW DATA STATES ---
  const [rawScans, setRawScans] = useState([]);
  const [optedInEmails, setOptedInEmails] = useState(new Set());
  const [loading, setLoading] = useState(true);
  
  // --- DERIVED DATA STATE ---
  const [candidates, setCandidates] = useState([]);

  // --- FILTERS & ACTIONS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [shortlisted, setShortlisted] = useState(new Set());

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

  // 2. Fetch All Scans
  useEffect(() => {
    const scansQ = query(collection(db, 'ats_scans'), orderBy('timestamp', 'desc'));
    const unsubscribeScans = onSnapshot(scansQ, (snapshot) => {
      const fetchedScans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRawScans(fetchedScans);
    }, (error) => console.error("Error fetching scans:", error));

    return () => unsubscribeScans();
  }, []);

  // 3. The Deduplication & Peak Performance Engine
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
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center space-y-4">
        <Activity className="text-indigo-500 animate-spin w-12 h-12" />
        <p className="text-indigo-400 font-medium animate-pulse">Curating top talent...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-4 md:p-8 font-sans pb-24 relative overflow-x-hidden">
      
      {/* Dynamic Ambient Background */}
      <div className="fixed top-0 right-0 w-[800px] h-[500px] bg-gradient-to-br from-indigo-500/10 to-purple-500/10 blur-[150px] rounded-full pointer-events-none z-0"></div>
      <div className="fixed bottom-0 left-0 w-[600px] h-[400px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none z-0"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* --- TOP NAVIGATION & BRANDING --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 border-b border-slate-700/60 pb-6 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                <Building size={14} /> SkillNova B2B Portal
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Talent Discovery Hub
            </h1>
            <p className="text-slate-400 mt-2 text-sm md:text-base font-medium">Find pre-vetted, high-match candidates curated by SkillNova's AI.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="px-5 py-2.5 bg-[#1e293b]/80 backdrop-blur-md border border-slate-700 rounded-xl flex items-center gap-2.5 shadow-lg">
              <Star className="text-amber-400 fill-amber-400/20" size={18} strokeWidth={2.5} />
              <span className="text-sm font-bold text-white">{shortlisted.size} Shortlisted</span>
            </div>
            <button onClick={() => auth.signOut()} className="px-5 py-2.5 bg-slate-800/80 backdrop-blur-md hover:bg-rose-500/10 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 rounded-xl text-sm font-bold transition-all shadow-lg">
              Sign Out
            </button>
          </div>
        </div>

        {/* --- SHARP METRICS WITH POP ANIMATION --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          <div className="bg-[#1e293b]/80 backdrop-blur-xl border border-slate-700 hover:border-blue-500/50 p-6 md:p-8 rounded-2xl flex items-center justify-between transition-all duration-300 group shadow-xl shadow-black/20 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/20 cursor-default">
            <div>
              <p className="text-slate-400 text-[11px] md:text-xs font-bold uppercase tracking-widest mb-2">Total Active Candidates</p>
              <h4 className="text-4xl font-black text-white">{candidates.length}</h4>
            </div>
            <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-500/20 transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <Users className="text-blue-400" size={28} strokeWidth={2.5} />
            </div>
          </div>

          <div className="bg-[#1e293b]/80 backdrop-blur-xl border border-slate-700 hover:border-emerald-500/50 p-6 md:p-8 rounded-2xl flex items-center justify-between transition-all duration-300 group shadow-xl shadow-black/20 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/20 cursor-default">
            <div>
              <p className="text-slate-400 text-[11px] md:text-xs font-bold uppercase tracking-widest mb-2">High-Match (75%+)</p>
              <h4 className="text-4xl font-black text-emerald-400">{topCandidatesCount}</h4>
            </div>
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <Award className="text-emerald-400" size={28} strokeWidth={2.5} />
            </div>
          </div>

          <div className="bg-[#1e293b]/80 backdrop-blur-xl border border-slate-700 hover:border-amber-500/50 p-6 md:p-8 rounded-2xl flex items-center justify-between transition-all duration-300 group shadow-xl shadow-black/20 hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-500/20 cursor-default">
            <div>
              <p className="text-slate-400 text-[11px] md:text-xs font-bold uppercase tracking-widest mb-2">Targeted Roles</p>
              <h4 className="text-4xl font-black text-amber-400">{availableRoles.length - 1}</h4>
            </div>
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-500/20 transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <Briefcase className="text-amber-400" size={28} strokeWidth={2.5} />
            </div>
          </div>

        </div>

        {/* --- HIGH-CONTRAST SEARCH AND FILTER BAR WITH VISIBLE ICONS --- */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-grow group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-400 group-focus-within:text-indigo-400 transition-colors">
              <Search size={20} strokeWidth={2.5} />
            </div>
            <input 
              type="text" 
              placeholder="Search by candidate email or validated technical skill (e.g. 'React', 'Python')..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#1e293b]/80 backdrop-blur-md border border-slate-700 hover:border-slate-500 focus:border-indigo-500 rounded-xl py-4 pl-14 pr-4 text-sm font-medium text-white outline-none transition-all shadow-inner relative z-0"
            />
          </div>
          <div className="relative min-w-[240px] group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-400 group-focus-within:text-indigo-400 transition-colors">
              <Filter size={20} strokeWidth={2.5} />
            </div>
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full bg-[#1e293b]/80 backdrop-blur-md border border-slate-700 hover:border-slate-500 focus:border-indigo-500 rounded-xl py-4 pl-14 px-4 text-sm font-bold text-slate-200 outline-none transition-all appearance-none cursor-pointer shadow-inner relative z-0"
            >
              {availableRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
        </div>

        {/* --- DEDUPLICATED CANDIDATE GRID WITH POP ANIMATION --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCandidates.map(candidate => {
            const score = candidate.roleMatchScore || candidate.score || 0;
            const isTopTier = score >= 75;
            const isShortlisted = shortlisted.has(candidate.email || candidate.id);

            return (
              <div key={candidate.id} className={`bg-[#1e293b]/80 backdrop-blur-xl border ${isShortlisted ? 'border-indigo-500 shadow-[0_0_25px_rgba(99,102,241,0.2)]' : 'border-slate-700'} rounded-2xl p-6 flex flex-col transition-all duration-300 hover:border-slate-400 hover:-translate-y-1 hover:shadow-2xl relative overflow-hidden group`}>
                
                {/* Top Badge */}
                {isTopTier && (
                  <div className="absolute top-0 right-0 bg-gradient-to-bl from-emerald-500/20 to-transparent px-5 py-2 border-b border-l border-emerald-500/30 rounded-bl-xl text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                    <Star size={12} className="fill-emerald-400" /> Peak Performance
                  </div>
                )}

                <div className="flex justify-between items-start mb-6 mt-3">
                  <div className="pr-4">
                    <h3 className="text-lg font-bold text-white truncate max-w-[220px]">{candidate.userEmail || 'Anonymous Candidate'}</h3>
                    <p className="text-sm text-indigo-400 font-bold flex items-center gap-1.5 mt-2 bg-indigo-500/10 w-fit px-2.5 py-1 rounded-md border border-indigo-500/20 shadow-sm">
                      <Briefcase size={14} strokeWidth={2.5} /> {candidate.targetRole || 'General Engineering'}
                    </p>
                  </div>
                  <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl border-2 ${isTopTier ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'border-amber-500/50 text-amber-400 bg-amber-500/10'} font-black text-2xl flex-shrink-0`}>
                    {score}
                  </div>
                </div>

                <div className="flex-grow space-y-5">
                  {/* Skill Pills */}
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2.5 flex items-center gap-1.5">
                      <CheckCircle size={14} strokeWidth={2.5}/> Validated Core Skills
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {candidate.foundSkills && candidate.foundSkills.length > 0 ? (
                        candidate.foundSkills.slice(0, 4).map((skill, i) => (
                          <span key={i} className="bg-slate-800 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 shadow-sm">
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500 italic font-medium">No exact core skills matched.</span>
                      )}
                      {candidate.foundSkills && candidate.foundSkills.length > 4 && (
                        <span className="bg-slate-800/50 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400">
                          +{candidate.foundSkills.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cohort & Activity Tracking */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50">
                      <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1.5">Cohort Tag</p>
                      <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5 truncate">
                        <MapPin size={14} className="text-indigo-400" strokeWidth={2.5} /> {candidate.tenantId?.toUpperCase() || 'PUBLIC-POOL'}
                      </p>
                    </div>
                    <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50">
                      <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1.5">Activity Level</p>
                      <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-blue-400" strokeWidth={2.5} /> {candidate.totalScans} Scans Run
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-700/60 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Last Active</span>
                    <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mt-1">
                      <Clock size={14} strokeWidth={2.5}/> {candidate.timestamp?.toDate ? new Date(candidate.timestamp.toDate()).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => handleShortlist(candidate.email || candidate.id)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm ${
                      isShortlisted 
                        ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/50 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/50' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-500 hover:shadow-indigo-500/25'
                    }`}
                  >
                    {isShortlisted ? (
                      <><CheckCircle size={16} strokeWidth={2.5} /> Shortlisted</>
                    ) : (
                      <><UserPlus size={16} strokeWidth={2.5} /> Shortlist</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {filteredCandidates.length === 0 && !loading && (
            <div className="col-span-full py-20 text-center bg-slate-800/30 border-2 border-slate-700 border-dashed rounded-3xl backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/5 to-transparent pointer-events-none"></div>
              <div className="w-20 h-20 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg relative z-10">
                <FileText className="text-slate-500" size={36} strokeWidth={2} />
              </div>
              <h3 className="text-2xl font-bold text-white relative z-10">No candidates found</h3>
              <p className="text-slate-400 text-sm mt-3 max-w-md mx-auto leading-relaxed font-medium relative z-10">
                Either no candidates match your current search filters, or no students have opted into the Employer Network yet.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}