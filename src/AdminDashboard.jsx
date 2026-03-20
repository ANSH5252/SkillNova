import React, { useState, useEffect } from 'react';
import { Users, FileText, TrendingDown, AlertTriangle, Activity, CheckCircle, XCircle } from 'lucide-react';
import { auth, db } from './firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

export default function AdminDashboard() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    avgScore: 0,
    passRate: 0,
    topSkills: []
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
        
        const totalScore = scanData.reduce((acc, curr) => acc + (curr.roleMatchScore || curr.score || 0), 0);
        const passedCount = scanData.filter(s => (s.roleMatchScore || s.score) >= 60).length;
        
        const skillCounts = {};
        scanData.forEach(scan => {
          if (scan.missingKeywords) {
            scan.missingKeywords.forEach(skill => {
              skillCounts[skill] = (skillCounts[skill] || 0) + 1;
            });
          }
        });

        const topSkills = Object.entries(skillCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }));

        setStats({
          total,
          avgScore: Math.round(totalScore / total),
          passRate: Math.round((passedCount / total) * 100),
          topSkills
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex justify-between items-center mb-10 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Activity className="text-indigo-500" />
              University Global Dashboard
            </h1>
            <p className="text-slate-400 mt-1">Live aggregated student ATS performance</p>
          </div>
          <button onClick={() => auth.signOut()} className="text-sm text-slate-400 hover:text-red-400 transition-colors">
            Log Out Admin
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl">
            <div className="flex items-center gap-4 mb-2">
              <div className="bg-blue-500/20 p-3 rounded-lg">
                <Users className="text-blue-400 w-6 h-6" />
              </div>
              <h3 className="text-slate-400 font-medium">Total Scans Processed</h3>
            </div>
            <p className="text-4xl font-bold text-white ml-16">{stats.total}</p>
          </div>

          <div className="bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl">
            <div className="flex items-center gap-4 mb-2">
              <div className="bg-indigo-500/20 p-3 rounded-lg">
                <FileText className="text-indigo-400 w-6 h-6" />
              </div>
              <h3 className="text-slate-400 font-medium">Average Match Score</h3>
            </div>
            <p className="text-4xl font-bold text-white ml-16">{stats.avgScore}%</p>
          </div>

          <div className="bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl">
            <div className="flex items-center gap-4 mb-2">
              <div className="bg-emerald-500/20 p-3 rounded-lg">
                <CheckCircle className="text-emerald-400 w-6 h-6" />
              </div>
              <h3 className="text-slate-400 font-medium">Viable Candidate Rate</h3>
            </div>
            <p className="text-4xl font-bold text-white ml-16">{stats.passRate}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl flex flex-col">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <TrendingDown className="text-rose-400" />
              Critical Skill Gaps
            </h3>
            <p className="text-sm text-slate-400 mb-6">Most frequent missing keywords across all student applications.</p>
            
            <div className="space-y-6 flex-1">
              {stats.topSkills.length > 0 ? stats.topSkills.map((skill, index) => (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-slate-200">{skill.name}</span>
                    <span className="text-slate-400">{skill.percentage}% of students</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-rose-500 to-orange-500 h-2 rounded-full" 
                      style={{ width: `${skill.percentage}%` }}
                    ></div>
                  </div>
                </div>
              )) : (
                <div className="text-slate-500 text-center py-10">No skill data collected yet.</div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Activity className="text-indigo-400" />
              Live Scan Feed
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-sm">
                    <th className="pb-3 font-medium">Student / Time</th>
                    <th className="pb-3 font-medium">Applied Role</th>
                    <th className="pb-3 font-medium">Match %</th>
                    <th className="pb-3 font-medium">Verdict</th>
                    <th className="pb-3 font-medium">Validated Skills</th>
                    <th className="pb-3 font-medium">Skill Gaps</th>
                    <th className="pb-3 font-medium">Upskill Path</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan) => {
                    const actualScore = scan.roleMatchScore || scan.score || 0;
                    return (
                      <tr key={scan.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                        
                        <td className="py-4 pr-2">
                          <div className="font-medium text-slate-200 truncate max-w-[120px]">{scan.userEmail}</div>
                          <div className="text-xs text-slate-500">
                            {scan.timestamp ? new Date(scan.timestamp.toDate()).toLocaleString() : 'Just now'}
                          </div>
                        </td>

                        <td className="py-4 pr-2">
                          <span className="text-sm text-indigo-300 font-medium">
                            {scan.targetRole || "Unknown Role"}
                          </span>
                        </td>

                        <td className="py-4 pr-2">
                          <span className={`font-bold ${getScoreColor(actualScore)}`}>
                            {actualScore}%
                          </span>
                        </td>

                        <td className="py-4 pr-2">
                          {actualScore >= 60 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
                              <CheckCircle size={14} /> Passed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-400 bg-rose-400/10 px-2 py-1 rounded-md whitespace-nowrap">
                              <XCircle size={14} /> Rejected
                            </span>
                          )}
                        </td>

                        <td className="py-4 pr-2">
                          <div className="flex flex-wrap gap-1 max-w-[120px]">
                            {scan.foundSkills && scan.foundSkills.length > 0 ? (
                              scan.foundSkills.slice(0, 2).map((skill, index) => (
                                <span key={`found-${index}`} className="text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded whitespace-nowrap">
                                  {skill}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500">None</span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 pr-2">
                          <div className="flex flex-wrap gap-1 max-w-[120px]">
                            {scan.missingKeywords && scan.missingKeywords.length > 0 ? (
                              scan.missingKeywords.slice(0, 2).map((skill, index) => (
                                <span key={`miss-${index}`} className="text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded whitespace-nowrap">
                                  {skill}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-emerald-500 font-medium">None!</span>
                            )}
                          </div>
                        </td>

                        {/* NEW: Upskill Path Column */}
                        <td className="py-4">
                          <div className="flex flex-wrap gap-1 max-w-[120px]">
                            {scan.recommendedSkills && scan.recommendedSkills.length > 0 ? (
                              scan.recommendedSkills.slice(0, 2).map((skill, index) => (
                                <span key={`upskill-${index}`} className="text-[10px] text-blue-300 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded whitespace-nowrap">
                                  {skill}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500">N/A</span>
                            )}
                          </div>
                        </td>
                        
                      </tr>
                    );
                  })}
                  {scans.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-500">
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