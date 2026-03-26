import React, { useState, useEffect } from 'react';
import { Users, FileText, TrendingDown, AlertTriangle, Activity, CheckCircle, XCircle, Rocket, Target, BarChart3, UploadCloud } from 'lucide-react';
import { auth, db } from './firebase';
import { collection, query, orderBy, onSnapshot, writeBatch, doc } from 'firebase/firestore';

export default function AdminDashboard() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revealedEmails, setRevealedEmails] = useState(new Set());

  // --- BULK UPLOAD STATES ---
  const [csvFile, setCsvFile] = useState(null);
  const [targetTenantId, setTargetTenantId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState({ text: '', type: '' });

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

  // --- CSV BULK UPLOAD LOGIC ---
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
    if (!csvFile || !targetTenantId.trim()) {
      setUploadMessage({ text: 'Provide both a CSV file and a Tenant ID.', type: 'error' });
      return;
    }

    setIsUploading(true);
    setUploadMessage({ text: 'Parsing CSV...', type: 'info' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      // Extract emails (assuming they are in the first column or separated by newlines)
      const rawLines = text.split('\n');
      const emailsToUpload = rawLines
        .map(line => line.split(',')[0].trim().toLowerCase()) // Take first column, lowercase
        .filter(email => email.includes('@')); // Basic validation

      if (emailsToUpload.length === 0) {
        setUploadMessage({ text: 'No valid emails found in the CSV.', type: 'error' });
        setIsUploading(false);
        return;
      }

      try {
        setUploadMessage({ text: `Writing ${emailsToUpload.length} users to database...`, type: 'info' });
        
        // Firestore batches can handle 500 writes at a time
        const batch = writeBatch(db);
        const finalTenantId = targetTenantId.trim().toUpperCase();

        emailsToUpload.slice(0, 500).forEach((email) => {
          const studentRef = doc(db, 'allowed_students', email);
          batch.set(studentRef, { tenantId: finalTenantId });
        });

        await batch.commit();

        setUploadMessage({ text: `Success! ${emailsToUpload.slice(0, 500).length} students onboarded to ${finalTenantId}.`, type: 'success' });
        setCsvFile(null);
        setTargetTenantId('');
      } catch (error) {
        console.error("Batch write failed:", error);
        setUploadMessage({ text: 'Database error. Check console.', type: 'error' });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(csvFile);
  };

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
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #475569 transparent; }
      `}} />

      <div className="max-w-[1600px] mx-auto">
        
        {/* TOP NAVIGATION */}
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

        {/* METRICS CARDS */}
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
          
          {/* LEFT SIDEBAR: ANALYTICS & UPLOAD */}
          <div className="xl:col-span-3 space-y-6">
            
            {/* NEW: ENTERPRISE CSV UPLOADER */}
            <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/10 border border-indigo-500/30 p-6 rounded-2xl flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <UploadCloud size={80} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 relative z-10">
                <UploadCloud className="text-indigo-400" size={20} />
                Bulk Onboard Students
              </h3>
              <p className="text-xs text-slate-400 mb-5 relative z-10">Upload a CSV of emails to instantly grant premium access to a specific cohort.</p>
              
              <div className="space-y-4 relative z-10">
                <input 
                  type="text" 
                  value={targetTenantId}
                  onChange={(e) => setTargetTenantId(e.target.value)}
                  placeholder="Target Cohort (e.g. VIT)" 
                  className="w-full bg-slate-900/50 border border-slate-700 focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 outline-none uppercase"
                />
                
                <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer transition-all ${csvFile ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-indigo-500/30'}`}>
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                  {csvFile ? (
                    <div className="text-center"><p className="text-emerald-400 text-xs font-medium truncate w-48">{csvFile.name}</p></div>
                  ) : (
                    <div className="text-center"><p className="text-slate-400 text-xs font-medium">Click to attach .CSV</p></div>
                  )}
                </label>

                {uploadMessage.text && (
                  <div className={`text-[11px] font-medium p-2 rounded ${uploadMessage.type === 'error' ? 'text-rose-400 bg-rose-500/10' : uploadMessage.type === 'success' ? 'text-emerald-400 bg-emerald-500/10' : 'text-blue-400 bg-blue-500/10'}`}>
                    {uploadMessage.text}
                  </div>
                )}

                <button 
                  onClick={processBulkUpload} 
                  disabled={isUploading || !csvFile || !targetTenantId}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-2.5 rounded-lg transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUploading ? <Activity size={16} className="animate-spin" /> : 'Provision Accounts'}
                </button>
              </div>
            </div>

            <div className="bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl flex flex-col">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <TrendingDown className="text-rose-400" size={20} />
                Critical Skill Gaps
              </h3>
              <p className="text-xs text-slate-400 mb-6">Most frequent missing core requirements.</p>
              <div className="space-y-5 overflow-y-auto max-h-[250px] pr-3 custom-scrollbar">
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
              <div className="space-y-5 overflow-y-auto max-h-[250px] pr-3 custom-scrollbar">
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
          <div className="xl:col-span-9 bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl flex flex-col">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Activity className="text-indigo-400" />
              Live Scan Feed
            </h3>
            
            <div className="overflow-x-auto overflow-y-auto max-h-[950px] custom-scrollbar pr-2 rounded-xl">
              <table className="w-full text-left table-fixed border-separate border-spacing-0 relative">
                
                <thead className="sticky top-0 z-20">
                  <tr className="bg-slate-800/90 backdrop-blur-md text-slate-300 text-[11px] uppercase tracking-wider shadow-sm">
                    <th className="py-4 pl-4 font-bold w-[16%] rounded-tl-lg border-b border-slate-700">Student / Time</th>
                    <th className="py-4 pr-2 font-bold w-[14%] border-b border-slate-700">Applied Role</th>
                    <th className="py-4 pr-2 font-bold w-[8%] border-b border-slate-700">Match</th>
                    <th className="py-4 pr-2 font-bold w-[8%] border-b border-slate-700">Market</th>
                    <th className="py-4 pr-2 font-bold w-[10%] border-b border-slate-700">Verdict</th>
                    <th className="py-4 pr-2 font-bold w-[15%] border-b border-slate-700">Validated Skills</th>
                    <th className="py-4 pr-2 font-bold w-[15%] border-b border-slate-700">Skill Gaps</th>
                    <th className="py-4 pr-4 font-bold w-[14%] rounded-tr-lg border-b border-slate-700">Upskill Path</th>
                  </tr>
                </thead>
                
                <tbody>
                  {scans.map((scan) => {
                    const actualScore = scan.roleMatchScore || scan.score || 0;
                    const isEmailRevealed = revealedEmails.has(scan.id);

                    return (
                      <tr key={scan.id} className="hover:bg-slate-800/30 transition-colors group">
                        
                        <td className="py-4 pl-4 pr-2 border-b border-slate-800/50">
                          <div 
                            className="font-medium text-slate-200 truncate cursor-pointer select-none hover:text-indigo-300 transition-colors"
                            onDoubleClick={() => handleDoubleClickEmail(scan.id)}
                            title="Double click to reveal email"
                          >
                            {isEmailRevealed ? scan.userEmail : maskEmail(scan.userEmail)}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 group-hover:text-slate-400 transition-colors">
                            {scan.timestamp ? new Date(scan.timestamp.toDate()).toLocaleString() : 'Just now'}
                          </div>
                        </td>

                        <td className="py-4 pr-2 border-b border-slate-800/50">
                          <span className="text-sm text-indigo-300 font-medium line-clamp-2">
                            {scan.targetRole || "Unknown Role"}
                          </span>
                        </td>

                        <td className="py-4 pr-2 border-b border-slate-800/50">
                          <span className={`font-bold ${getScoreColor(actualScore)}`}>
                            {actualScore}%
                          </span>
                        </td>

                        <td className="py-4 pr-2 border-b border-slate-800/50">
                          {scan.marketProbability ? (
                            <span className={`font-bold ${getScoreColor(scan.marketProbability)}`}>
                              {scan.marketProbability}%
                            </span>
                          ) : (
                            <span className="text-slate-500 text-sm">N/A</span>
                          )}
                        </td>

                        <td className="py-4 pr-2 border-b border-slate-800/50">
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

                        <td className="py-4 pr-2 border-b border-slate-800/50">
                          <div className="flex flex-wrap gap-1">
                            {scan.foundSkills && scan.foundSkills.length > 0 ? (
                              scan.foundSkills.slice(0, 2).map((skill, index) => (
                                <span key={`found-${index}`} className="text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded whitespace-nowrap" title={skill}>
                                  {skill.length > 12 ? skill.substring(0, 10) + '...' : skill}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-rose-500 font-medium">None</span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 pr-2 border-b border-slate-800/50">
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

                        <td className="py-4 pr-4 border-b border-slate-800/50">
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
                      <td colSpan="8" className="py-8 text-center text-slate-500 border-b border-slate-800/50">
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