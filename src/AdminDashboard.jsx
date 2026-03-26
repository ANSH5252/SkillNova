import React, { useState, useEffect } from 'react';
import { Users, FileText, TrendingDown, AlertTriangle, Activity, CheckCircle, XCircle, Rocket, Target, BarChart3, UploadCloud, Building2, Mail, Check, X, ShieldCheck, LogOut } from 'lucide-react';
import { auth, db } from './firebase';
import { collection, query, orderBy, onSnapshot, writeBatch, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function AdminDashboard() {
  const [currentView, setCurrentView] = useState('analytics'); // 'analytics' or 'partners'
  
  const [scans, setScans] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revealedEmails, setRevealedEmails] = useState(new Set());

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

    // 2. Fetch Partner Applications
    const qApps = query(collection(db, 'partner_applications'), orderBy('createdAt', 'desc'));
    const unsubApps = onSnapshot(qApps, (snapshot) => {
      const appData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setApplications(appData);
      setLoading(false);
    });

    return () => { unsubScans(); unsubApps(); };
  }, []);

  // --- PARTNER APPROVAL LOGIC ---
  const handleApprove = async (app) => {
    const finalTenantId = assignTenantId[app.id]?.trim().toUpperCase();
    if (!finalTenantId) { alert("Please assign a strictly formatted Tenant ID (e.g., HARVARD-2026)."); return; }
    setProcessingId(app.id);
    try {
      await setDoc(doc(db, 'admins', app.email), { role: 'partner', tenantId: finalTenantId, universityName: app.universityName, contactName: app.contactName, createdAt: serverTimestamp() });
      await updateDoc(doc(db, 'partner_applications', app.id), { status: 'approved', tenantId: finalTenantId, approvedAt: serverTimestamp() });
      setAssignTenantId(prev => ({ ...prev, [app.id]: '' }));
    } catch (error) { console.error("Approval failed:", error); alert("Database error during approval."); } 
    finally { setProcessingId(null); }
  };

  const handleReject = async (appId) => {
    if(!window.confirm("Are you sure you want to reject this application?")) return;
    setProcessingId(appId);
    try { await updateDoc(doc(db, 'partner_applications', appId), { status: 'rejected', rejectedAt: serverTimestamp() }); } 
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
        setUploadMessage({ text: `Writing ${emailsToUpload.length} users to database...`, type: 'info' });
        const batch = writeBatch(db);
        const finalTenantId = targetTenantId.trim().toUpperCase();

        emailsToUpload.slice(0, 500).forEach((email) => {
          const studentRef = doc(db, 'allowed_students', email);
          batch.set(studentRef, { tenantId: finalTenantId });
        });

        await batch.commit();
        setUploadMessage({ text: `Success! ${emailsToUpload.slice(0, 500).length} students onboarded to ${finalTenantId}.`, type: 'success' });
        setCsvFile(null); setTargetTenantId('');
      } catch (error) { setUploadMessage({ text: 'Database error. Check console.', type: 'error' }); } 
      finally { setIsUploading(false); }
    };
    reader.readAsText(csvFile);
  };

  const getScoreColor = (score) => { if (score >= 75) return 'text-emerald-400'; if (score >= 45) return 'text-amber-400'; return 'text-rose-500'; };
  
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

  if (loading) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>;

  const pendingApps = applications.filter(app => app.status === 'pending');
  const processedApps = applications.filter(app => app.status !== 'pending');

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
        
        {/* ========================================= */}
        {/* REDESIGNED TOP NAVIGATION & HEADER        */}
        {/* ========================================= */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 border-b border-slate-800/80 pb-6 gap-6 relative">
          
          {/* Title Area */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-3">
              <ShieldCheck size={14} /> Super Admin Auth
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Global Command Center</h1>
            <p className="text-slate-400 mt-2 text-sm">Real-time ATS performance and enterprise partner management.</p>
          </div>
          
          {/* Controls Area */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
            
            {/* Segmented View Toggle */}
            <div className="flex items-center bg-[#0b1120] p-1.5 rounded-xl border border-slate-800 shadow-inner w-full sm:w-auto">
              <button 
                onClick={() => setCurrentView('analytics')} 
                className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${currentView === 'analytics' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <Activity size={16} /> ATS Analytics
              </button>
              <button 
                onClick={() => setCurrentView('partners')} 
                className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${currentView === 'partners' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <Building2 size={16} /> Partner Mgmt
                {pendingApps.length > 0 && <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm">{pendingApps.length}</span>}
              </button>
            </div>

            {/* Vertical Divider (Hidden on small screens) */}
            <div className="w-px h-8 bg-slate-800 hidden sm:block"></div>

            {/* Separated Sign Out Button */}
            <button 
              onClick={() => auth.signOut()} 
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-800/50 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-700/50 hover:border-rose-500/30 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={16} /> Sign Out
            </button>

          </div>
        </div>

        {/* ========================================= */}
        {/* VIEW 1: ATS ANALYTICS                     */}
        {/* ========================================= */}
        {currentView === 'analytics' && (
          <div className="animate-fade-in-up">
            {/* METRICS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-[#1e293b]/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center hover:border-blue-500/30 transition-colors group">
                <div><p className="text-slate-400 text-sm font-medium mb-1">Total Scans</p><div className="flex items-baseline gap-2"><h4 className="text-3xl font-bold text-white">{stats.total}</h4><span className="text-xs text-blue-400 font-medium">/ {stats.uniqueUsers} users</span></div></div>
                <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20 group-hover:scale-110 transition-transform"><Users className="text-blue-400" size={22} /></div>
              </div>
              <div className="bg-[#1e293b]/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center hover:border-indigo-500/30 transition-colors group">
                <div><p className="text-slate-400 text-sm font-medium mb-1">Avg ATS Match</p><div className="flex items-baseline gap-2"><h4 className="text-3xl font-bold text-white">{stats.avgScore}%</h4></div></div>
                <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 group-hover:scale-110 transition-transform"><FileText className="text-indigo-400" size={22} /></div>
              </div>
              <div className="bg-[#1e293b]/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center hover:border-purple-500/30 transition-colors group">
                <div><p className="text-slate-400 text-sm font-medium mb-1">Avg Market Prob.</p><div className="flex items-baseline gap-2"><h4 className="text-3xl font-bold text-white">{stats.avgMarketProb}%</h4></div></div>
                <div className="bg-purple-500/10 p-3 rounded-xl border border-purple-500/20 group-hover:scale-110 transition-transform"><BarChart3 className="text-purple-400" size={22} /></div>
              </div>
              <div className="bg-[#1e293b]/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center hover:border-emerald-500/30 transition-colors group">
                <div><p className="text-slate-400 text-sm font-medium mb-1">Viable Candidates</p><div className="flex items-baseline gap-2"><h4 className="text-3xl font-bold text-white">{stats.passRate}%</h4><span className="text-xs text-emerald-400 font-medium">passed filter</span></div></div>
                <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 group-hover:scale-110 transition-transform"><Target className="text-emerald-400" size={22} /></div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              {/* LEFT SIDEBAR: GAPS & UPSKILLS */}
              <div className="xl:col-span-3 space-y-6">
                <div className="bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl flex flex-col">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><TrendingDown className="text-rose-400" size={20} /> Critical Skill Gaps</h3>
                  <div className="space-y-5 overflow-y-auto max-h-[300px] pr-3 custom-scrollbar">
                    {stats.topSkills.length > 0 ? stats.topSkills.map((skill, index) => (
                      <div key={`gap-${index}`}><div className="flex justify-between text-xs mb-2"><span className="font-medium text-slate-200">{skill.name}</span><span className="text-slate-400">{skill.percentage}%</span></div><div className="w-full bg-slate-800 rounded-full h-1.5"><div className="bg-gradient-to-r from-rose-500 to-orange-500 h-1.5 rounded-full" style={{ width: `${skill.percentage}%` }}></div></div></div>
                    )) : <div className="text-slate-500 text-sm text-center py-4">No data yet.</div>}
                  </div>
                </div>

                <div className="bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl flex flex-col">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Rocket className="text-blue-400" size={20} /> Recommended Upskills</h3>
                  <div className="space-y-5 overflow-y-auto max-h-[300px] pr-3 custom-scrollbar">
                    {stats.topRecommended.length > 0 ? stats.topRecommended.map((skill, index) => (
                      <div key={`rec-${index}`}><div className="flex justify-between text-xs mb-2"><span className="font-medium text-slate-200">{skill.name}</span><span className="text-slate-400">{skill.percentage}%</span></div><div className="w-full bg-slate-800 rounded-full h-1.5"><div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full" style={{ width: `${skill.percentage}%` }}></div></div></div>
                    )) : <div className="text-slate-500 text-sm text-center py-4">No data yet.</div>}
                  </div>
                </div>
              </div>

              {/* RIGHT PANEL: LIVE SCAN FEED (9 COLUMNS) */}
              <div className="xl:col-span-9 bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl flex flex-col">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Activity className="text-indigo-400" /> Live Scan Feed</h3>
                
                <div className="overflow-x-auto overflow-y-auto max-h-[750px] custom-scrollbar pr-2 rounded-xl">
                  <table className="w-full text-left table-fixed border-separate border-spacing-0 relative">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-slate-800/90 backdrop-blur-md text-slate-300 text-[11px] uppercase tracking-wider shadow-sm">
                        <th className="py-4 pl-4 font-bold w-[14%] rounded-tl-lg border-b border-slate-700">Student / Time</th>
                        <th className="py-4 pr-2 font-bold w-[10%] border-b border-slate-700">Cohort</th>
                        <th className="py-4 pr-2 font-bold w-[12%] border-b border-slate-700">Applied Role</th>
                        <th className="py-4 pr-2 font-bold w-[7%] border-b border-slate-700">Match</th>
                        <th className="py-4 pr-2 font-bold w-[7%] border-b border-slate-700">Market</th>
                        <th className="py-4 pr-2 font-bold w-[8%] border-b border-slate-700">Verdict</th>
                        <th className="py-4 pr-2 font-bold w-[14%] border-b border-slate-700">Validated Skills</th>
                        <th className="py-4 pr-2 font-bold w-[14%] border-b border-slate-700">Skill Gaps</th>
                        <th className="py-4 pr-4 font-bold w-[14%] rounded-tr-lg border-b border-slate-700">Upskill Path</th>
                      </tr>
                    </thead>
                    
                    <tbody>
                      {scans.map((scan) => {
                        const actualScore = scan.roleMatchScore || scan.score || 0;
                        const isEmailRevealed = revealedEmails.has(scan.id);
                        const isPremium = scan.tenantId && scan.tenantId.toLowerCase() !== 'public';

                        return (
                          <tr key={scan.id} className="hover:bg-slate-800/30 transition-colors group">
                            
                            {/* COLUMN 1: STUDENT / TIME (With Double Click) */}
                            <td className="py-4 pl-4 pr-2 border-b border-slate-800/50">
                              <div 
                                className="font-medium text-slate-200 truncate cursor-pointer select-none hover:text-indigo-300 transition-colors"
                                onDoubleClick={() => handleDoubleClickEmail(scan.id)}
                                title="Double click to reveal/hide email"
                              >
                                {isEmailRevealed ? scan.userEmail : maskEmail(scan.userEmail)}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-1 group-hover:text-slate-400 transition-colors">
                                {scan.timestamp ? new Date(scan.timestamp.toDate()).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit' }) : 'Just now'}
                              </div>
                            </td>

                            {/* COLUMN 2: COHORT */}
                            <td className="py-4 pr-2 border-b border-slate-800/50">
                              <span className={`px-2 py-1 rounded-md text-[9px] font-mono font-bold tracking-wider border truncate max-w-full inline-block ${isPremium ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                {scan.tenantId || 'PUBLIC'}
                              </span>
                            </td>

                            {/* COLUMN 3: ROLE */}
                            <td className="py-4 pr-2 border-b border-slate-800/50">
                              <span className="text-sm text-indigo-300 font-medium line-clamp-2">{scan.targetRole || "Unknown"}</span>
                            </td>

                            {/* COLUMN 4: MATCH SCORE */}
                            <td className="py-4 pr-2 border-b border-slate-800/50">
                              <span className={`font-bold ${getScoreColor(actualScore)}`}>{actualScore}%</span>
                            </td>

                            {/* COLUMN 5: MARKET PROB */}
                            <td className="py-4 pr-2 border-b border-slate-800/50">
                              {scan.marketProbability ? <span className={`font-bold ${getScoreColor(scan.marketProbability)}`}>{scan.marketProbability}%</span> : <span className="text-slate-500 text-sm">N/A</span>}
                            </td>

                            {/* COLUMN 6: VERDICT */}
                            <td className="py-4 pr-2 border-b border-slate-800/50">
                              {actualScore >= 60 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md whitespace-nowrap"><CheckCircle size={12} /> Passed</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-400/10 px-2 py-1 rounded-md whitespace-nowrap"><XCircle size={12} /> Rejected</span>
                              )}
                            </td>

                            {/* COLUMN 7: VALIDATED SKILLS */}
                            <td className="py-4 pr-2 border-b border-slate-800/50">
                              <div className="flex flex-wrap gap-1">
                                {scan.foundSkills && scan.foundSkills.length > 0 ? scan.foundSkills.slice(0, 2).map((skill, index) => (
                                  <span key={`found-${index}`} className="text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={skill}>{skill}</span>
                                )) : <span className="text-[11px] text-rose-500 font-medium">None</span>}
                              </div>
                            </td>

                            {/* COLUMN 8: SKILL GAPS */}
                            <td className="py-4 pr-2 border-b border-slate-800/50">
                              <div className="flex flex-wrap gap-1">
                                {scan.missingKeywords && scan.missingKeywords.length > 0 ? scan.missingKeywords.slice(0, 2).map((skill, index) => (
                                  <span key={`miss-${index}`} className="text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={skill}>{skill}</span>
                                )) : <span className="text-[11px] text-emerald-500 font-medium">None!</span>}
                              </div>
                            </td>

                            {/* COLUMN 9: UPSKILL PATH */}
                            <td className="py-4 pr-4 border-b border-slate-800/50">
                              <div className="flex flex-wrap gap-1">
                                {scan.recommendedSkills && scan.recommendedSkills.length > 0 ? scan.recommendedSkills.slice(0, 2).map((skill, index) => (
                                  <span key={`upskill-${index}`} className="text-[10px] text-blue-300 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={skill}>{skill}</span>
                                )) : <span className="text-[11px] text-slate-500">N/A</span>}
                              </div>
                            </td>
                            
                          </tr>
                        );
                      })}
                      {scans.length === 0 && <tr><td colSpan="9" className="py-8 text-center text-slate-500 border-b border-slate-800/50">Waiting for first student scan...</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* VIEW 2: PARTNER MANAGEMENT */}
        {/* ========================================= */}
        {currentView === 'partners' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-fade-in-up">
            
            {/* LEFT SIDE: PENDING APPLICATIONS & HISTORY */}
            <div className="xl:col-span-8 space-y-6">
              
              {/* PENDING APPROVALS */}
              <div className="bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Users className="text-indigo-400" /> Action Required: Pending Partners</h3>
                {pendingApps.length === 0 ? (
                  <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50 border-dashed">
                    <CheckCircle className="text-emerald-500/50 w-12 h-12 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">Inbox Zero. No pending applications.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingApps.map(app => (
                      <div key={app.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                        <div>
                          <h4 className="text-lg font-bold text-white flex items-center gap-2">{app.universityName} <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-1 rounded uppercase tracking-wider">Awaiting Review</span></h4>
                          <div className="flex flex-col sm:flex-row gap-4 mt-2 text-sm text-slate-400"><span className="flex items-center gap-1.5"><Mail size={14}/> {app.email}</span><span className="flex items-center gap-1.5"><Users size={14}/> {app.contactName}</span></div>
                          <p className="text-xs text-slate-500 mt-2">Applied: {app.createdAt ? new Date(app.createdAt.toDate()).toLocaleDateString() : 'Recently'}</p>
                        </div>
                        <div className="w-full md:w-auto flex flex-col gap-3 min-w-[250px]">
                          <input type="text" placeholder="Assign Tenant ID (e.g. SRM-26)" value={assignTenantId[app.id] || ''} onChange={(e) => setAssignTenantId({...assignTenantId, [app.id]: e.target.value.toUpperCase()})} className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white outline-none uppercase" />
                          <div className="flex gap-2">
                            <button onClick={() => handleReject(app.id)} disabled={processingId === app.id} className="flex-1 px-3 py-2 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-700 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1"><X size={16} /> Reject</button>
                            <button onClick={() => handleApprove(app)} disabled={processingId === app.id} className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1 disabled:opacity-50">{processingId === app.id ? <Activity size={16} className="animate-spin" /> : <><Check size={16} /> Approve</>}</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* RECENTLY PROCESSED HISTORY */}
              <div className="bg-[#1e293b]/20 border border-slate-800/50 p-6 rounded-2xl">
                <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">Recently Processed</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                  {processedApps.slice(0,10).map(app => (
                    <div key={app.id} className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg border border-slate-800">
                      <div><p className="text-sm font-medium text-slate-300">{app.universityName}</p><p className="text-xs text-slate-500">{app.email}</p></div>
                      <div className="text-right">
                        {app.status === 'approved' ? <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">APPROVED: {app.tenantId}</span> : <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded">REJECTED</span>}
                      </div>
                    </div>
                  ))}
                  {processedApps.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No history yet.</p>}
                </div>
              </div>
            </div>

            {/* RIGHT SIDE: THE BULK UPLOADER */}
            <div className="xl:col-span-4">
              <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/10 border border-indigo-500/30 p-6 rounded-2xl flex flex-col relative overflow-hidden sticky top-24">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><UploadCloud size={80} /></div>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 relative z-10"><UploadCloud className="text-indigo-400" size={20} /> Bulk Provision Students</h3>
                <p className="text-xs text-slate-400 mb-6 relative z-10">Upload a CSV of emails to instantly grant premium access to an approved Cohort.</p>
                <div className="space-y-4 relative z-10">
                  <input type="text" value={targetTenantId} onChange={(e) => setTargetTenantId(e.target.value)} placeholder="Target Cohort (e.g. VIT)" className="w-full bg-slate-900/50 border border-slate-700 focus:border-indigo-500 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 outline-none uppercase" />
                  <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-all ${csvFile ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-indigo-500/30'}`}>
                    <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                    {csvFile ? <div className="text-center"><CheckCircle className="text-emerald-500 w-8 h-8 mx-auto mb-2"/><p className="text-emerald-400 text-xs font-medium truncate w-48">{csvFile.name}</p></div> : <div className="text-center"><UploadCloud className="text-slate-500 w-8 h-8 mx-auto mb-2"/><p className="text-slate-400 text-xs font-medium">Click to attach .CSV</p></div>}
                  </label>
                  {uploadMessage.text && <div className={`text-[11px] font-medium p-3 rounded-lg ${uploadMessage.type === 'error' ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20' : uploadMessage.type === 'success' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-blue-400 bg-blue-500/10'}`}>{uploadMessage.text}</div>}
                  <button onClick={processBulkUpload} disabled={isUploading || !csvFile || !targetTenantId} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-3 rounded-lg transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 flex items-center justify-center gap-2">{isUploading ? <Activity size={18} className="animate-spin" /> : 'Provision CSV Accounts'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}