import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, Target, TrendingUp, Download, CheckCircle, 
  XCircle, FileText, Activity, BookOpen, AlertCircle
} from 'lucide-react';
import { auth, db } from './firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';

export default function PartnerDashboard() {
  const { tenantId, currentUser } = useAuth();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [stats, setStats] = useState({
    totalScans: 0,
    uniqueStudents: 0,
    avgMatchScore: 0,
    passRate: 0,
    topGaps: []
  });

  useEffect(() => {
    // SECURITY ALGORITHM: Only fetch scans matching this specific Partner's Tenant ID
    if (!tenantId) return;

    const q = query(
      collection(db, 'ats_scans'), 
      where('tenantId', '==', tenantId),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scanData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setScans(scanData);

      if (scanData.length > 0) {
        const total = scanData.length;
        const uniqueEmails = new Set(scanData.map(s => s.userEmail));
        const totalScore = scanData.reduce((acc, curr) => acc + (curr.roleMatchScore || 0), 0);
        const passedCount = scanData.filter(s => (s.roleMatchScore || 0) >= 60).length;
        
        // Calculate Curriculum Gaps
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

        setStats({
          totalScans: total,
          uniqueStudents: uniqueEmails.size,
          avgMatchScore: Math.round(totalScore / total),
          passRate: Math.round((passedCount / total) * 100),
          topGaps
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  const handleExportCurriculumReport = () => {
    setIsExporting(true);
    // Simulate PDF Generation for the pitch
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
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <Activity className="text-indigo-500 animate-spin w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* TOP NAVIGATION & BRANDING */}
        <div className="flex justify-between items-end mb-10 border-b border-slate-800 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
              <Building2 size={14} /> Enterprise Partner Portal
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              Cohort Intelligence <span className="text-slate-600">/</span> <span className="text-indigo-400 uppercase">{tenantId || 'Unknown'}</span>
            </h1>
            <p className="text-slate-400 mt-2 text-sm">Real-time curriculum alignment and placement probability for your students.</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleExportCurriculumReport}
              disabled={isExporting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2"
            >
              {isExporting ? <Activity size={18} className="animate-spin" /> : <Download size={18} />}
              {isExporting ? 'Compiling Data...' : 'Export Curriculum Report'}
            </button>
            <button onClick={() => auth.signOut()} className="px-4 py-2 bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 rounded-lg text-sm font-medium transition-all">
              Sign Out
            </button>
          </div>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#1e293b]/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Active Students</p>
              <h4 className="text-3xl font-bold text-white">{stats.uniqueStudents}</h4>
            </div>
            <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
              <Users className="text-blue-400" size={22} />
            </div>
          </div>

          <div className="bg-[#1e293b]/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Total Resume Scans</p>
              <h4 className="text-3xl font-bold text-white">{stats.totalScans}</h4>
            </div>
            <div className="bg-purple-500/10 p-3 rounded-xl border border-purple-500/20">
              <FileText className="text-purple-400" size={22} />
            </div>
          </div>

          <div className="bg-[#1e293b]/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Avg. Industry Readiness</p>
              <h4 className={`text-3xl font-bold ${getScoreColor(stats.avgMatchScore)}`}>{stats.avgMatchScore}%</h4>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
              <Target className="text-emerald-400" size={22} />
            </div>
          </div>

          <div className="bg-[#1e293b]/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Placement Probability</p>
              <h4 className="text-3xl font-bold text-white">{stats.passRate}%</h4>
            </div>
            <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20">
              <TrendingUp className="text-indigo-400" size={22} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* LEFT SIDEBAR: CURRICULUM INSIGHTS */}
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-gradient-to-b from-[#1e293b]/80 to-[#1e293b]/30 border border-slate-800 p-6 rounded-2xl flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <BookOpen size={100} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 relative z-10">
                <AlertCircle className="text-rose-400" size={20} />
                Curriculum Gaps Detected
              </h3>
              <p className="text-xs text-slate-400 mb-6 relative z-10">Technologies your students are consistently missing based on current market demands.</p>
              
              <div className="space-y-5 relative z-10">
                {stats.topGaps.length > 0 ? stats.topGaps.map((gap, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-bold text-rose-300">{gap.name}</span>
                      <span className="text-slate-400">{gap.percentage}% of students miss this</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div className="bg-gradient-to-r from-rose-500 to-orange-500 h-2 rounded-full" style={{ width: `${gap.percentage}%` }}></div>
                    </div>
                  </div>
                )) : (
                  <div className="text-slate-500 text-center py-6 text-sm">No gap data collected yet.</div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: STUDENT ROSTER */}
          <div className="xl:col-span-2 bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl flex flex-col">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Users className="text-indigo-400" />
              Cohort Performance Feed
            </h3>
            
            <div className="overflow-x-auto overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
              <table className="w-full text-left table-fixed border-separate border-spacing-0 relative">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-slate-800/90 backdrop-blur-md text-slate-300 text-[11px] uppercase tracking-wider shadow-sm">
                    <th className="py-4 pl-4 font-bold w-[30%] rounded-tl-lg border-b border-slate-700">Student Email</th>
                    <th className="py-4 pr-2 font-bold w-[25%] border-b border-slate-700">Target Role</th>
                    <th className="py-4 pr-2 font-bold w-[15%] border-b border-slate-700">Readiness</th>
                    <th className="py-4 pr-4 font-bold w-[30%] rounded-tr-lg border-b border-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan) => {
                    const score = scan.roleMatchScore || scan.score || 0;
                    return (
                      <tr key={scan.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 pl-4 pr-2 border-b border-slate-800/50">
                          <div className="font-medium text-slate-200 truncate">{scan.userEmail}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {scan.timestamp ? new Date(scan.timestamp.toDate()).toLocaleDateString() : 'Just now'}
                          </div>
                        </td>
                        <td className="py-4 pr-2 border-b border-slate-800/50">
                          <span className="text-sm text-indigo-300 font-medium truncate block">
                            {scan.targetRole || "Unknown Role"}
                          </span>
                        </td>
                        <td className="py-4 pr-2 border-b border-slate-800/50">
                          <span className={`font-bold ${getScoreColor(score)}`}>{score}%</span>
                        </td>
                        <td className="py-4 pr-4 border-b border-slate-800/50">
                          {score >= 60 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
                              <CheckCircle size={14} /> Interview Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md">
                              <AlertCircle size={14} /> Needs Upskilling
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {scans.length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-slate-500 border-b border-slate-800/50">
                        No students in this cohort have run scans yet.
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