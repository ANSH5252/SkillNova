import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, Target, TrendingUp, Download, CheckCircle, 
  XCircle, FileText, Activity, BookOpen, AlertCircle, UploadCloud, X, Lock, Crown, ArrowRight 
} from 'lucide-react';
import { auth, db } from './firebase';
import { collection, query, where, onSnapshot, writeBatch, doc, getDoc } from 'firebase/firestore'; 
import { useAuth } from './AuthContext';

export default function PartnerDashboard() {
  const { tenantId, currentUser } = useAuth();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null); 

  // --- MONETIZATION TIER ---
  const [partnerTier, setPartnerTier] = useState('free'); // 'free' or 'premium'

  // --- MODAL STATES ---
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState({ text: '', type: '' });

  const [stats, setStats] = useState({
    totalScans: 0,
    uniqueStudents: 0,
    avgMatchScore: 0,
    passRate: 0,
    topGaps: []
  });

  useEffect(() => {
    if (!tenantId || !currentUser?.email) {
      if(!tenantId) setErrorMsg("Admin configuration error: No Partner Code assigned to this account.");
      setLoading(false);
      return;
    }

    // 1. Fetch the Partner's Tier Status
    const fetchTier = async () => {
      try {
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.email.toLowerCase()));
        if (adminDoc.exists()) {
          setPartnerTier(adminDoc.data().tier || 'free'); 
        }
      } catch (err) {
        console.error("Tier fetch error:", err);
      }
    };
    fetchTier();

    // 2. Fetch the ATS Data
    const q = query(collection(db, 'ats_scans'), where('tenantId', '==', tenantId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scanData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        const timeA = a.timestamp?.toMillis() || 0;
        const timeB = b.timestamp?.toMillis() || 0;
        return timeB - timeA;
      });

      setScans(scanData);

      if (scanData.length > 0) {
        const total = scanData.length;
        const uniqueEmails = new Set(scanData.map(s => s.userEmail));
        const totalScore = scanData.reduce((acc, curr) => acc + (curr.roleMatchScore || curr.score || 0), 0);
        const passedCount = scanData.filter(s => (s.roleMatchScore || s.score || 0) >= 60).length;
        
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
    }, (error) => {
      console.error("Firestore Error:", error);
      setErrorMsg("Database connection blocked: " + error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId, currentUser]);

  // --- CSV UPLOAD LOGIC ---
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
    if (!csvFile) return;
    setIsUploading(true);
    setUploadMessage({ text: 'Parsing CSV...', type: 'info' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const rawLines = text.split('\n');
      const emailsToUpload = rawLines.map(line => line.split(',')[0].trim().toLowerCase()).filter(email => email.includes('@'));

      if (emailsToUpload.length === 0) {
        setUploadMessage({ text: 'No valid emails found in the CSV.', type: 'error' });
        setIsUploading(false); return;
      }

      try {
        setUploadMessage({ text: `Provisioning ${emailsToUpload.length} students...`, type: 'info' });
        const batch = writeBatch(db);

        emailsToUpload.slice(0, 500).forEach((email) => {
          const studentRef = doc(db, 'allowed_students', email);
          batch.set(studentRef, { tenantId: tenantId }); 
        });

        await batch.commit();
        setUploadMessage({ text: `Success! ${emailsToUpload.slice(0, 500).length} students onboarded.`, type: 'success' });
        setCsvFile(null);
        setTimeout(() => setShowUploadModal(false), 2000);
      } catch (error) {
        setUploadMessage({ text: 'Database error. Check console.', type: 'error' });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(csvFile);
  };

  const handleExportCurriculumReport = () => {
    setIsExporting(true);
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

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4">
        <AlertCircle className="text-rose-500 w-16 h-16 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Dashboard Error</h2>
        <p className="text-slate-400 text-center max-w-md mb-6">{errorMsg}</p>
        <button onClick={() => auth.signOut()} className="px-6 py-2 bg-indigo-600 text-white rounded-lg">Sign Out</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-8 font-sans pb-24 relative">
      <div className="max-w-7xl mx-auto">
        
        {/* TOP NAVIGATION & BRANDING */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 border-b border-slate-800 pb-6 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Building2 size={14} /> Enterprise Partner Portal
              </div>
              {partnerTier === 'premium' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                  <Crown size={14} className="text-indigo-400"/> Premium Active
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold uppercase tracking-wider">
                  Free Tier
                </div>
              )}
            </div>
            
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              Cohort Intelligence <span className="text-slate-600">/</span> <span className="text-indigo-400 uppercase">{tenantId || 'Unknown'}</span>
            </h1>
            <p className="text-slate-400 mt-2 text-sm">Real-time curriculum alignment and placement probability for your students.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* ADD STUDENTS BUTTON (GATED) */}
            <button 
              onClick={() => partnerTier === 'premium' ? setShowUploadModal(true) : setShowUpgradeModal(true)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg flex items-center gap-2"
            >
              {partnerTier === 'free' ? <Lock size={16} className="opacity-70" /> : <UploadCloud size={18} />}
              Add Students
            </button>

            {/* EXPORT BUTTON (GATED) */}
            <button 
              onClick={() => partnerTier === 'premium' ? handleExportCurriculumReport() : setShowUpgradeModal(true)}
              disabled={isExporting}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2"
            >
              {isExporting ? <Activity size={18} className="animate-spin" /> : (partnerTier === 'free' ? <Lock size={16} className="opacity-70"/> : <Download size={18} />)}
              {isExporting ? 'Compiling Data...' : 'Export Report'}
            </button>
            <button onClick={() => auth.signOut()} className="px-4 py-2.5 bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 rounded-lg text-sm font-medium transition-all">
              Sign Out
            </button>
          </div>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#1e293b]/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center">
            <div><p className="text-slate-400 text-sm font-medium mb-1">Active Students</p><h4 className="text-3xl font-bold text-white">{stats.uniqueStudents}</h4></div>
            <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20"><Users className="text-blue-400" size={22} /></div>
          </div>

          <div className="bg-[#1e293b]/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center">
            <div><p className="text-slate-400 text-sm font-medium mb-1">Total Resume Scans</p><h4 className="text-3xl font-bold text-white">{stats.totalScans}</h4></div>
            <div className="bg-purple-500/10 p-3 rounded-xl border border-purple-500/20"><FileText className="text-purple-400" size={22} /></div>
          </div>

          {/* GATED METRIC: READINESS */}
          <div className="bg-[#1e293b]/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center relative overflow-hidden group cursor-pointer" onClick={() => partnerTier==='free' && setShowUpgradeModal(true)}>
            <div className={`transition-all duration-300 ${partnerTier === 'free' ? 'blur-sm opacity-40' : ''}`}>
              <p className="text-slate-400 text-sm font-medium mb-1">Avg. Readiness</p>
              <h4 className={`text-3xl font-bold ${getScoreColor(stats.avgMatchScore)}`}>{stats.avgMatchScore}%</h4>
            </div>
            <div className={`p-3 rounded-xl border transition-all ${partnerTier === 'free' ? 'bg-slate-800 border-slate-700' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
              <Target className={partnerTier === 'free' ? 'text-slate-500' : 'text-emerald-400'} size={22} />
            </div>
            {partnerTier === 'free' && <div className="absolute inset-0 flex items-center justify-center bg-[#1e293b]/40"><Lock className="text-indigo-400 group-hover:scale-110 transition-transform" size={24}/></div>}
          </div>

          {/* GATED METRIC: PLACEMENT */}
          <div className="bg-[#1e293b]/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center relative overflow-hidden group cursor-pointer" onClick={() => partnerTier==='free' && setShowUpgradeModal(true)}>
            <div className={`transition-all duration-300 ${partnerTier === 'free' ? 'blur-sm opacity-40' : ''}`}>
              <p className="text-slate-400 text-sm font-medium mb-1">Placement Prob.</p>
              <h4 className="text-3xl font-bold text-white">{stats.passRate}%</h4>
            </div>
            <div className={`p-3 rounded-xl border transition-all ${partnerTier === 'free' ? 'bg-slate-800 border-slate-700' : 'bg-indigo-500/10 border-indigo-500/20'}`}>
              <TrendingUp className={partnerTier === 'free' ? 'text-slate-500' : 'text-indigo-400'} size={22} />
            </div>
            {partnerTier === 'free' && <div className="absolute inset-0 flex items-center justify-center bg-[#1e293b]/40"><Lock className="text-indigo-400 group-hover:scale-110 transition-transform" size={24}/></div>}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* LEFT SIDEBAR: CURRICULUM INSIGHTS (GATED) */}
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-gradient-to-b from-[#1e293b]/80 to-[#1e293b]/30 border border-slate-800 p-6 rounded-2xl flex flex-col relative overflow-hidden h-full min-h-[400px]">
              
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none z-0"><BookOpen size={100} /></div>
              
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 relative z-10"><AlertCircle className="text-rose-400" size={20} /> Curriculum Gaps</h3>
              <p className="text-xs text-slate-400 mb-6 relative z-10">Technologies your students are consistently missing based on current market demands.</p>
              
              {/* THE PAYWALL BLUR */}
              <div className={`space-y-5 relative z-10 flex-grow transition-all duration-500 ${partnerTier === 'free' ? 'blur-[6px] opacity-30 select-none pointer-events-none' : ''}`}>
                {stats.topGaps.length > 0 ? stats.topGaps.map((gap, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-2"><span className="font-bold text-rose-300">{gap.name}</span><span className="text-slate-400">{gap.percentage}% of students miss this</span></div>
                    <div className="w-full bg-slate-800 rounded-full h-2"><div className="bg-gradient-to-r from-rose-500 to-orange-500 h-2 rounded-full" style={{ width: `${gap.percentage}%` }}></div></div>
                  </div>
                )) : (
                  <div className="text-slate-500 text-center py-6 text-sm">No gap data collected yet.</div>
                )}
                
                {/* Dummy data for the blur effect if empty */}
                {partnerTier === 'free' && stats.topGaps.length === 0 && (
                   <>
                     <div><div className="flex justify-between text-sm mb-2"><span className="font-bold text-rose-300">React.js</span></div><div className="w-full bg-slate-800 rounded-full h-2"><div className="bg-rose-500 h-2 rounded-full w-[80%]"></div></div></div>
                     <div><div className="flex justify-between text-sm mb-2"><span className="font-bold text-rose-300">Docker</span></div><div className="w-full bg-slate-800 rounded-full h-2"><div className="bg-orange-500 h-2 rounded-full w-[60%]"></div></div></div>
                     <div><div className="flex justify-between text-sm mb-2"><span className="font-bold text-rose-300">AWS</span></div><div className="w-full bg-slate-800 rounded-full h-2"><div className="bg-amber-500 h-2 rounded-full w-[40%]"></div></div></div>
                   </>
                )}
              </div>

              {/* PAYWALL OVERLAY */}
              {partnerTier === 'free' && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0f172a]/40 backdrop-blur-[2px] rounded-2xl border border-indigo-500/20 p-6 text-center">
                  <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                    <Lock className="text-indigo-400 w-8 h-8" />
                  </div>
                  <h4 className="text-white font-bold text-lg mb-2">Premium Insights</h4>
                  <p className="text-xs text-slate-300 mb-6 leading-relaxed">Upgrade your cohort to SkillNova Enterprise to reveal deep curriculum gaps and precise hiring analytics.</p>
                  <button onClick={() => setShowUpgradeModal(true)} className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-lg text-sm shadow-lg transition-all w-full">
                    Upgrade to Premium
                  </button>
                </div>
              )}

            </div>
          </div>

          {/* RIGHT PANEL: STUDENT ROSTER (Always available, but standard view) */}
          <div className="xl:col-span-2 bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><Users className="text-blue-400" /> Cohort Feed</h3>
              <span className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">Basic View</span>
            </div>
            
            <div className="overflow-x-auto overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
              <table className="w-full text-left table-fixed border-separate border-spacing-0 relative">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-slate-800/90 backdrop-blur-md text-slate-300 text-[11px] uppercase tracking-wider shadow-sm">
                    <th className="py-4 pl-4 font-bold w-[35%] rounded-tl-lg border-b border-slate-700">Student Email</th>
                    <th className="py-4 pr-2 font-bold w-[30%] border-b border-slate-700">Target Role</th>
                    <th className="py-4 pr-4 font-bold w-[35%] rounded-tr-lg border-b border-slate-700">Recent Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan) => {
                    const score = scan.roleMatchScore || scan.score || 0;
                    return (
                      <tr key={scan.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 pl-4 pr-2 border-b border-slate-800/50">
                          <div className="font-medium text-slate-200 truncate">{scan.userEmail}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{scan.timestamp ? new Date(scan.timestamp.toDate()).toLocaleDateString() : 'Just now'}</div>
                        </td>
                        <td className="py-4 pr-2 border-b border-slate-800/50">
                          <span className="text-sm text-indigo-300 font-medium truncate block">{scan.targetRole || "Unknown Role"}</span>
                        </td>
                        <td className="py-4 pr-4 border-b border-slate-800/50">
                          {score >= 60 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md"><CheckCircle size={14} /> Pass</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md"><AlertCircle size={14} /> Fail</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {scans.length === 0 && (
                    <tr><td colSpan="3" className="py-8 text-center text-slate-500 border-b border-slate-800/50">No students in this cohort have run scans yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* --- UPGRADE TO PREMIUM MODAL --- */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-gradient-to-b from-[#1e293b] to-[#0f172a] border border-indigo-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col relative">
            
            <button onClick={() => setShowUpgradeModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"><X size={20} /></button>
            
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/30">
                <Crown className="text-white w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Unlock SkillNova Premium</h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">Your institution is currently on the basic Free Tier. Upgrade to Enterprise Premium to unlock powerful tools.</p>
              
              <ul className="text-left text-sm text-slate-300 space-y-3 mb-8 bg-slate-800/50 p-5 rounded-xl border border-slate-700">
                <li className="flex items-center gap-2"><CheckCircle className="text-emerald-400" size={16}/> CSV Bulk Student Upload</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-emerald-400" size={16}/> Advanced Curriculum Gap Analysis</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-emerald-400" size={16}/> Placement Probability Metrics</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-emerald-400" size={16}/> Downloadable Reports</li>
              </ul>

              <button onClick={() => {setShowUpgradeModal(false); alert("Billing integration goes here!");}} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2">
                Contact Sales to Upgrade <ArrowRight size={18}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CSV UPLOAD MODAL (Only shows if Premium) --- */}
      {showUploadModal && partnerTier === 'premium' && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up">
         <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
           <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
             <h3 className="text-lg font-bold text-white flex items-center gap-2"><UploadCloud className="text-indigo-400" /> Roster Upload</h3>
             <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-rose-400 transition-colors"><X size={20} /></button>
           </div>
           
           <div className="p-6">
             <p className="text-sm text-slate-400 mb-6">Upload a CSV containing student emails. They will instantly receive premium access tied to <strong className="text-indigo-300 uppercase">{tenantId}</strong>.</p>
             
             <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${csvFile ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-indigo-500/30'}`}>
               <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
               {csvFile ? (
                 <div className="text-center"><CheckCircle className="text-emerald-500 w-10 h-10 mx-auto mb-3"/><p className="text-emerald-400 text-sm font-medium">{csvFile.name}</p></div>
               ) : (
                 <div className="text-center"><UploadCloud className="text-slate-500 w-10 h-10 mx-auto mb-3"/><p className="text-slate-300 text-sm font-medium mb-1">Click to browse files</p><p className="text-xs text-slate-500">Must be a .CSV file</p></div>
               )}
             </label>

             {uploadMessage.text && (
               <div className={`mt-4 text-[12px] font-medium p-3 rounded-lg ${uploadMessage.type === 'error' ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20' : uploadMessage.type === 'success' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-blue-400 bg-blue-500/10'}`}>
                 {uploadMessage.text}
               </div>
             )}
           </div>

           <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3">
             <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">Cancel</button>
             <button onClick={processBulkUpload} disabled={isUploading || !csvFile} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-500/20">
               {isUploading ? <Activity size={16} className="animate-spin" /> : 'Provision Accounts'}
             </button>
           </div>
         </div>
       </div>
      )}

    </div>
  );
}