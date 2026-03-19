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
    // 1. Create a query to get all scans, newest first
    const q = query(collection(db, 'ats_scans'), orderBy('timestamp', 'desc'));

    // 2. Listen to the database in REAL-TIME
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scanData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setScans(scanData);

      // 3. Crunch the numbers for the dashboard metrics
      if (scanData.length > 0) {
        const total = scanData.length;
        const totalScore = scanData.reduce((acc, curr) => acc + (curr.score || 0), 0);
        const passedCount = scanData.filter(s => s.score >= 75).length;
        
        // Count up all the missing keywords to find the biggest skill gaps
        const skillCounts = {};
        scanData.forEach(scan => {
          if (scan.missingKeywords) {
            scan.missingKeywords.forEach(skill => {
              skillCounts[skill] = (skillCounts[skill] || 0) + 1;
            });
          }
        });

        // Sort skills by frequency and take the top 5
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

    // Cleanup the listener when the component unmounts
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* TOP NAVIGATION */}
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

        {/* TOP METRICS CARDS */}
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
              <h3 className="text-slate-400 font-medium">Pass to Recruiter Rate</h3>
            </div>
            <p className="text-4xl font-bold text-white ml-16">{stats.passRate}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* THE INVESTOR PITCH: SKILL GAP ANALYSIS */}
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

          {/* LIVE FEED OF SCANS */}
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
                    <th className="pb-3 font-medium">Match Score</th>
                    <th className="pb-3 font-medium">Verdict</th>
                    <th className="pb-3 font-medium">Top Missing Skill</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan) => (
                    <tr key={scan.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                      <td className="py-4">
                        <div className="font-medium text-slate-200">{scan.userEmail}</div>
                        <div className="text-xs text-slate-500">
                          {scan.timestamp ? new Date(scan.timestamp.toDate()).toLocaleString() : 'Just now'}
                        </div>
                      </td>
                      <td className="py-4">
                        <span className={`font-bold ${scan.score >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {scan.score}%
                        </span>
                      </td>
                      <td className="py-4">
                        {scan.score >= 75 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
                            <CheckCircle size={14} /> Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-400 bg-rose-400/10 px-2 py-1 rounded-md">
                            <XCircle size={14} /> Rejected
                          </span>
                        )}
                      </td>
                      <td className="py-4">
                        <span className="text-sm text-slate-300 bg-slate-800 px-2 py-1 rounded">
                          {scan.missingKeywords && scan.missingKeywords.length > 0 ? scan.missingKeywords[0] : 'None'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {scans.length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-slate-500">
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