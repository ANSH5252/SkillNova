import React, { useState, useEffect } from 'react';
import { Users, FileText, TrendingDown, AlertTriangle, Activity, CheckCircle, XCircle, Rocket, Target, BarChart3 } from 'lucide-react';
import { auth, db } from './firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

export default function AdminDashboard() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [revealedEmails, setRevealedEmails] = useState(new Set());

  // Added uniqueUsers and avgMarketProb to our stats state
  const [stats, setStats] = useState({
    total: 0,
    uniqueUsers: 0,
    avgScore: 0,
    avgMarketProb: 0,
    passRate: 0,
    topSkills: [],
    topRecommended: []
  });

  useEffect(() => {
    const q = query(collection(db, 'ats_scans'), orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scanData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setScans(scanData);

      if (scanData.length > 0) {
        const total = scanData.length;
        
        // Calculate unique users
        const uniqueEmails = new Set(scanData.map(s => s.userEmail));
        
        const totalScore = scanData.reduce((acc, curr) => acc + (curr.roleMatchScore || curr.score || 0), 0);
        const totalMarketProb = scanData.reduce((acc, curr) => acc + (curr.marketProbability || 0), 0);
        
        const passedCount = scanData.filter(s => (s.roleMatchScore || s.score) >= 60).length;
        
        const skillCounts = {};
        const recommendedCounts = {};

        scanData.forEach(scan => {
          if (scan.missingKeywords) {
            scan.missingKeywords.forEach(skill => {
              skillCounts[skill] = (skillCounts[skill] || 0) + 1;
            });
          }
          if (scan.recommendedSkills) {
            scan.recommendedSkills.forEach(skill => {
              recommendedCounts[skill] = (recommendedCounts[skill] || 0) + 1;
            });
          }
        });

        const topSkills = Object.entries(skillCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }));

        const topRecommended = Object.entries(recommendedCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }));

        setStats({
          total,
          uniqueUsers: uniqueEmails.size,
          avgScore: Math.round(totalScore / total),
          avgMarketProb: Math.round(totalMarketProb / total),
          passRate: Math.round((passedCount / total) * 100),
          topSkills,
          topRecommended
        });
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getScoreColor = (score) => {
    if (score >= 75) return 'text-emerald-400';
    if (score >= 45) return 'text-amber-400';
    return 'text-rose-500'; 
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-8 font-sans">
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #475569 #1e293b; }
      `}} />

      <div className="max-w-[1600px] mx-auto">
        
        {/* NEW TITLE & HEADER */}
        <div className="flex justify-between items-end mb-10 border-b border-slate-800 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-3">
              <Activity size={14} /> System Live
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Talent Analytics Command Center
            </h1>
            <p className="text-slate-400 mt-2 text-sm">Real-time ATS performance and market readiness insights.</p>
          </div>
          <button onClick={() => auth.signOut()} className="px-4 py-2 bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 rounded-lg text-sm font-medium transition-all">
            Sign Out Admin
          </button>
        </div>

        {/* NEW SLEEK 4-COLUMN METRICS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          <div className="bg-[#1e293b]/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center hover:border-blue-500/30 transition-colors group">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Total Scans</p>
              <div className="flex items-baseline gap-2">
                <h4 className="text-3xl font-bold text-white">{stats.total}</h4>
                <span className="text-xs text-blue-400 font-medium">/ {stats.uniqueUsers} users</span>
              </div>
            </div>
            <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20 group-hover:scale-110 transition-transform">
              <Users className="text-blue-400" size={22} />
            </div>
          </div>

          <div className="bg-[#1e293b]/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center hover:border-indigo-500/30 transition-colors group">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Avg ATS Match</p>
              <div className="flex items-baseline gap-2">
                <h4 className="text-3xl font-bold text-white">{stats.avgScore}%</h4>
              </div>
            </div>
            <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 group-hover:scale-110 transition-transform">
              <FileText className="text-indigo-400" size={22} />
            </div>
          </div>

          <div className="bg-[#1e293b]/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center hover:border-purple-500/30 transition-colors group">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Avg Market Prob.</p>
              <div className="flex items-baseline gap-2">
                <h4 className="text-3xl font-bold text-white">{stats.avgMarketProb}%</h4>
              </div>
            </div>
            <div className="bg-purple-500/10 p-3 rounded-xl border border-purple-500/20 group-hover:scale-110 transition-transform">
              <BarChart3 className="text-purple-400" size={22} />
            </div>
          </div>

          <div className="bg-[#1e293b]/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center hover:border-emerald-500/30 transition-colors group">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Viable Candidates</p>
              <div className="flex items-baseline gap-2">
                <h4 className="text-3xl font-bold text-white">{stats.passRate}%</h4>
                <span className="text-xs text-emerald-400 font-medium">passed filter</span>
              </div>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <Target className="text-emerald-400" size={22} />
            </div>
          </div>

        </div>

        {/* MAIN DASHBOARD GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* LEFT SIDEBAR: ANALYTICS */}
          <div className="xl:col-span-3 space-y-6">
            
            <div className="bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl flex flex-col">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <TrendingDown className="text-rose-400" size={20} />
                Critical Skill Gaps
              </h3>
              <p className="text-xs text-slate-400 mb-6">Most frequent missing core requirements.</p>
              
              <div className="space-y-5 overflow-y-auto max-h-[380px] pr-2 custom-scrollbar">
                {stats.topSkills.length > 0 ? stats.topSkills.map((skill, index) => (
                  <div key={`gap-${index}`}>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-medium text-slate-200">{skill.name}</span>
                      <span className="text-slate-400">{skill.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5">
                      <div className="bg-gradient-to-r from-rose-500 to-orange-500 h-1.5 rounded-full" style={{ width: `${skill.percentage}%` }}></div>
                    </div>
                  </div>
                )) : (
                  <div className="text-slate-500 text-center py-6 text-sm">No gap data yet.</div>
                )}
              </div>
            </div>

            <div className="bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl flex flex-col">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Rocket className="text-blue-400" size={20} />
                Top Recommended Upskills
              </h3>
              <p className="text-xs text-slate-400 mb-6">Technologies most frequently suggested by the AI to bridge candidate skill gaps.</p>
              
              <div className="space-y-5 overflow-y-auto max-h-[380px] pr-2 custom-scrollbar">
                {stats.topRecommended.length > 0 ? stats.topRecommended.map((skill, index) => (
                  <div key={`rec-${index}`}>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-medium text-slate-200">{skill.name}</span>
                      <span className="text-slate-400">{skill.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5">
                      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full" style={{ width: `${skill.percentage}%` }}></div>
                    </div>
                  </div>
                )) : (
                  <div className="text-slate-500 text-center py-6 text-sm">No upskill data yet.</div>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT PANEL: LIVE SCAN FEED */}
          <div className="xl:col-span-9 bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Activity className="text-indigo-400" />
              Live Scan Feed
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left table-fixed border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-sm">
                    <th className="pb-3 font-medium w-[15%]">Student / Time</th>
                    <th className="pb-3 font-medium w-[15%]">Applied Role</th>
                    <th className="pb-3 font-medium w-[8%]">Match</th>
                    <th className="pb-3 font-medium w-[8%]">Market</th>
                    <th className="pb-3 font-medium w-[9%]">Verdict</th>
                    <th className="pb-3 font-medium w-[15%]">Validated Skills</th>
                    <th className="pb-3 font-medium w-[15%]">Skill Gaps</th>
                    <th className="pb-3 font-medium w-[15%]">Upskill Path</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {scans.map((scan) => {
                    const actualScore = scan.roleMatchScore || scan.score || 0;
                    const isEmailRevealed = revealedEmails.has(scan.id);

                    return (
                      <tr key={scan.id} className="hover:bg-slate-800/20 transition-colors">
                        
                        <td className="py-4 pr-2">
                          <div 
                            className="font-medium text-slate-200 truncate cursor-pointer select-none hover:text-indigo-300 transition-colors"
                            onDoubleClick={() => handleDoubleClickEmail(scan.id)}
                            title="Double click to reveal email"
                          >
                            {isEmailRevealed ? scan.userEmail : maskEmail(scan.userEmail)}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {scan.timestamp ? new Date(scan.timestamp.toDate()).toLocaleString() : 'Just now'}
                          </div>
                        </td>

                        <td className="py-4 pr-2">
                          <span className="text-sm text-indigo-300 font-medium line-clamp-2">
                            {scan.targetRole || "Unknown Role"}
                          </span>
                        </td>

                        <td className="py-4 pr-2">
                          <span className={`font-bold ${getScoreColor(actualScore)}`}>
                            {actualScore}%
                          </span>
                        </td>

                        <td className="py-4 pr-2">
                          {scan.marketProbability ? (
                            <span className={`font-bold ${getScoreColor(scan.marketProbability)}`}>
                              {scan.marketProbability}%
                            </span>
                          ) : (
                            <span className="text-slate-500 text-sm">N/A</span>
                          )}
                        </td>

                        <td className="py-4 pr-2">
                          {actualScore >= 60 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
                              <CheckCircle size={12} /> Passed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-400/10 px-2 py-1 rounded-md whitespace-nowrap">
                              <XCircle size={12} /> Rejected
                            </span>
                          )}
                        </td>

                        <td className="py-4 pr-2">
                          <div className="flex flex-wrap gap-1">
                            {scan.foundSkills && scan.foundSkills.length > 0 ? (
                              scan.foundSkills.slice(0, 2).map((skill, index) => (
                                <span key={`found-${index}`} className="text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded whitespace-nowrap" title={skill}>
                                  {skill.length > 12 ? skill.substring(0, 10) + '...' : skill}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-500">None</span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 pr-2">
                          <div className="flex flex-wrap gap-1">
                            {scan.missingKeywords && scan.missingKeywords.length > 0 ? (
                              scan.missingKeywords.slice(0, 2).map((skill, index) => (
                                <span key={`miss-${index}`} className="text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded whitespace-nowrap" title={skill}>
                                  {skill.length > 12 ? skill.substring(0, 10) + '...' : skill}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-emerald-500 font-medium">None!</span>
                            )}
                          </div>
                        </td>

                        <td className="py-4">
                          <div className="flex flex-wrap gap-1">
                            {scan.recommendedSkills && scan.recommendedSkills.length > 0 ? (
                              scan.recommendedSkills.slice(0, 2).map((skill, index) => (
                                <span key={`upskill-${index}`} className="text-[10px] text-blue-300 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded whitespace-nowrap" title={skill}>
                                  {skill.length > 12 ? skill.substring(0, 10) + '...' : skill}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-500">N/A</span>
                            )}
                          </div>
                        </td>
                        
                      </tr>
                    );
                  })}
                  {scans.length === 0 && (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-500">
                        Waiting for first student scan...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}