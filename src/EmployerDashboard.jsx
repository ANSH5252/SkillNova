import React, { useState, useEffect } from 'react';
import { 
  Building, Search, Filter, Star, Briefcase, Award, 
  CheckCircle, Activity, UserPlus, MapPin, Users 
} from 'lucide-react';
import { auth, db } from './firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore'; 
import { useAuth } from './AuthContext';

export default function EmployerDashboard() {
  const { currentUser } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters and Actions
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [shortlisted, setShortlisted] = useState(new Set());

  useEffect(() => {
    // For employers, we fetch all ATS scans to find top talent across all cohorts.
    const q = query(collection(db, 'ats_scans'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedCandidates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCandidates(fetchedCandidates);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching candidates:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleShortlist = (id) => {
    setShortlisted(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  // Derive unique roles for the filter dropdown
  const availableRoles = ['All Roles', ...new Set(candidates.map(c => c.targetRole).filter(Boolean))];

  // Filter candidates based on search and role
  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = (c.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (c.missingKeywords || []).join(' ').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All Roles' || c.targetRole === roleFilter;
    return matchesSearch && matchesRole;
  });

  const topCandidatesCount = candidates.filter(c => (c.roleMatchScore || c.score || 0) >= 75).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <Activity className="text-blue-500 animate-spin w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-8 font-sans pb-24 relative">
      {/* THE TYPO IS FIXED ON THIS NEXT LINE! */}
      <div className="max-w-7xl mx-auto">
        
        {/* TOP NAVIGATION & BRANDING */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 border-b border-slate-800 pb-6 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
                <Building size={14} /> SkillNova B2B Portal
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              Talent Discovery Hub
            </h1>
            <p className="text-slate-400 mt-2 text-sm">Find pre-vetted, high-match candidates curated by SkillNova's AI.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg flex items-center gap-2">
              <Star className="text-amber-400" size={16} />
              <span className="text-sm font-bold text-white">{shortlisted.size} Shortlisted</span>
            </div>
            <button onClick={() => auth.signOut()} className="px-4 py-2 bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 rounded-lg text-sm font-medium transition-all">
              Sign Out
            </button>
          </div>
        </div>

        {/* METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl flex justify-between items-center transition-all duration-300 group hover:scale-[1.02] hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Total Talent Pool</p>
              <h4 className="text-3xl font-bold text-white">{candidates.length}</h4>
            </div>
            <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20 group-hover:-translate-y-1 transition-transform">
              <Users className="text-blue-400" size={24} />
            </div>
          </div>

          <div className="bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl flex justify-between items-center transition-all duration-300 group hover:scale-[1.02] hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">High-Match Candidates (75%+)</p>
              <h4 className="text-3xl font-bold text-emerald-400">{topCandidatesCount}</h4>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 group-hover:-translate-y-1 transition-transform">
              <Award className="text-emerald-400" size={24} />
            </div>
          </div>

          <div className="bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl flex justify-between items-center transition-all duration-300 group hover:scale-[1.02] hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Actively Hiring Roles</p>
              <h4 className="text-3xl font-bold text-amber-400">{availableRoles.length - 1}</h4>
            </div>
            <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 group-hover:-translate-y-1 transition-transform">
              <Briefcase className="text-amber-400" size={24} />
            </div>
          </div>
        </div>

        {/* SEARCH AND FILTER BAR */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search by candidate email or technical skill (e.g. 'React', 'Python')..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#1e293b]/60 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-blue-500 transition-colors shadow-inner"
            />
          </div>
          <div className="relative min-w-[200px]">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full bg-[#1e293b]/60 border border-slate-700 rounded-xl py-3 pl-11 px-4 text-sm text-slate-200 outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
            >
              {availableRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
        </div>

        {/* CANDIDATE GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCandidates.map(candidate => {
            const score = candidate.roleMatchScore || candidate.score || 0;
            const isTopTier = score >= 75;
            const isShortlisted = shortlisted.has(candidate.id);

            return (
              <div key={candidate.id} className={`bg-[#1e293b]/40 border ${isShortlisted ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'border-slate-800'} rounded-2xl p-6 flex flex-col transition-all duration-300 hover:scale-[1.02] hover:border-slate-600 relative overflow-hidden`}>
                
                {/* Top Badge */}
                {isTopTier && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-500/20 to-transparent px-4 py-1 border-b border-l border-emerald-500/20 rounded-bl-xl text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Star size={10} className="fill-emerald-400" /> Top Match
                  </div>
                )}

                <div className="flex justify-between items-start mb-4 mt-2">
                  <div>
                    <h3 className="text-lg font-bold text-white truncate max-w-[200px]">{candidate.userEmail || 'Anonymous Candidate'}</h3>
                    <p className="text-sm text-indigo-400 font-medium flex items-center gap-1 mt-1">
                      <Briefcase size={14} /> {candidate.targetRole || 'General Engineering'}
                    </p>
                  </div>
                  <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-full border-4 ${isTopTier ? 'border-emerald-500/30 text-emerald-400' : 'border-amber-500/30 text-amber-400'} bg-slate-900 font-bold`}>
                    {score}
                  </div>
                </div>

                <div className="flex-grow space-y-4">
                  {/* Identified Skills */}
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Cohort Focus Area</p>
                    <div className="flex items-center gap-2 text-sm text-slate-300 bg-slate-900/50 p-2 rounded-lg border border-slate-800/50 w-fit">
                      <MapPin size={14} className="text-slate-500" /> {candidate.tenantId?.toUpperCase() || 'SKILLNOVA-POOL'}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Scanned: {candidate.timestamp?.toDate ? new Date(candidate.timestamp.toDate()).toLocaleDateString() : 'Recent'}
                  </span>
                  
                  <button 
                    onClick={() => handleShortlist(candidate.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                      isShortlisted 
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/50' 
                        : 'bg-slate-800 text-white hover:bg-blue-600 hover:text-white border border-slate-700 hover:border-blue-500'
                    }`}
                  >
                    {isShortlisted ? (
                      <><CheckCircle size={16} /> Shortlisted</>
                    ) : (
                      <><UserPlus size={16} /> Shortlist</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {filteredCandidates.length === 0 && (
            <div className="col-span-full py-12 text-center bg-slate-800/20 border border-slate-800 border-dashed rounded-2xl">
              <Search className="mx-auto text-slate-600 mb-3" size={32} />
              <h3 className="text-lg font-bold text-slate-300">No candidates found</h3>
              <p className="text-slate-500 text-sm mt-1">Try adjusting your search terms or role filters.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}