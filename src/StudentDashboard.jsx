import React, { useState, useEffect, useRef } from 'react';
import { 
  Briefcase, FileUp, AlertTriangle, CheckCircle, Activity, 
  Clock, FileText, LayoutTemplate, Building2, Search, Download, Sparkles, Copy, X, TrendingUp, Info, Rocket, Lock, ShieldCheck, Crown, ArrowRight, Network, LogOut, User, Users, ChevronDown 
} from 'lucide-react';
import { auth, db } from './firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore'; 
import Groq from "groq-sdk";
import { useAuth } from './AuthContext';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const SkillNovaLogo = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M50 5L60.5 39.5L95 50L60.5 60.5L50 95L39.5 60.5L5 50L39.5 39.5L50 5Z" fill="url(#nova-gradient)"/>
    <circle cx="50" cy="50" r="18" fill="#04060d"/>
    <circle cx="50" cy="50" r="8" fill="url(#nova-gradient)"/>
    <defs>
      <linearGradient id="nova-gradient" x1="5" y1="5" x2="95" y2="95" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366f1" /> 
        <stop offset="1" stopColor="#ec4899" /> 
      </linearGradient>
    </defs>
  </svg>
);

const partnerCompanies = [
  { name: "TechFlow Solutions", roles: ["Junior React Developer", "Senior UI/UX Designer", "Product Manager"] },
  { name: "Nexus Security", roles: ["Entry-Level Cybersecurity Analyst", "Senior Cloud Engineer"] },
  { name: "InnovateEd", roles: ["Full-Stack Engineer (MERN)", "Junior Data Scientist", "Lead ML Engineer"] }
];

export default function StudentDashboard() {
  const { tenantId } = useAuth(); 
  
  const [isTester, setIsTester] = useState(false);
  const [partnerTier, setPartnerTier] = useState('free');
  
  const isPremium = partnerTier === 'premium' || isTester; 
  const isPublicUser = tenantId === 'public'; 

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isOpenToOpportunities, setIsOpenToOpportunities] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false); 
  
  const [inputMode, setInputMode] = useState('role');
  const [customJobRole, setCustomJobRole] = useState('');
  const [jobDescriptionText, setJobDescriptionText] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedCompanyRole, setSelectedCompanyRole] = useState('');
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  const [resumeFile, setResumeFile] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [scansUsedToday, setScansUsedToday] = useState(0);

  const [extractedText, setExtractedText] = useState('');
  const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [copied, setCopied] = useState(false);

  const reportRef = useRef(null);

  const gridRef = useRef(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const timeOffset = useRef({ x: 0, y: 0 });

  // --- 60FPS CONTINUOUS + PARALLAX GRID LOGIC ---
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

  useEffect(() => {
    const checkAccessLevels = async () => {
      const currentEmail = auth.currentUser?.email;
      if (currentEmail) {
        try {
          const qaRef = doc(db, 'qa_accounts', currentEmail.toLowerCase());
          const qaSnap = await getDoc(qaRef);
          if (qaSnap.exists() && qaSnap.data().active === true) {
            setIsTester(true);
          } else {
            setIsTester(false);
          }
        } catch (e) {
          console.error("QA check failed:", e);
        }

        try {
          const profileRef = doc(db, 'student_profiles', currentEmail.toLowerCase());
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            setIsOpenToOpportunities(profileSnap.data().openToOpportunities || false);
          }
        } catch (err) {
          console.error("Error fetching student profile:", err);
        }
      }

      if (!tenantId || isPublicUser) {
        setPartnerTier('free');
        return;
      }
      try {
        const q = query(collection(db, 'admins'), where('tenantId', '==', tenantId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setPartnerTier(snap.docs[0].data().tier || 'free');
        }
      } catch (err) {
        console.error("Tier check failed:", err);
      }
    };
    
    checkAccessLevels();
  }, [tenantId, isPublicUser, auth.currentUser?.email]); 

  const fetchScansUsedToday = async () => {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const q = query(collection(db, 'ats_scans'), where('userId', '==', auth.currentUser?.uid || 'anonymous'));
      const snapshot = await getDocs(q);
      const count = snapshot.docs.filter(doc => {
        const data = doc.data();
        if (!data.timestamp) return true;
        return data.timestamp.toDate() >= startOfToday;
      }).length;
      setScansUsedToday(count);
    } catch (err) {
      console.error('Failed to fetch scans count:', err);
    }
  };

  useEffect(() => {
    fetchScansUsedToday();
  }, [auth.currentUser?.uid]); 

  useEffect(() => {
    const lastScan = localStorage.getItem('lastScanTime');
    if (lastScan) {
      const timePassed = Math.floor((Date.now() - parseInt(lastScan)) / 1000);
      if (timePassed < 60) setCooldown(60 - timePassed);
    }
  }, []);

  useEffect(() => {
    let timer;
    if (cooldown > 0) timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleToggleOpportunities = async () => {
    if (!isPremium) {
      setShowUpgradeModal(true);
      return;
    }
    setIsUpdatingProfile(true);
    try {
      const newStatus = !isOpenToOpportunities;
      const profileRef = doc(db, 'student_profiles', auth.currentUser.email.toLowerCase());
      await setDoc(profileRef, { 
        openToOpportunities: newStatus,
        email: auth.currentUser.email.toLowerCase(),
        tenantId: tenantId,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setIsOpenToOpportunities(newStatus);
      setErrorMsg('');
    } catch (err) {
      console.error("Error updating profile:", err);
      setErrorMsg("Failed to update networking preferences. Check Firestore rules.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      setResumeFile(file);
      setErrorMsg('');
    } else {
      setResumeFile(null);
      setErrorMsg("Please upload a valid PDF file.");
    }
  };

  const extractTextFromPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(" ");
      fullText += pageText + " ";
    }
    return fullText;
  };

  const handleAnalyze = async () => {
    let finalJobTarget = "";
    if (inputMode === 'role') finalJobTarget = customJobRole;
    if (inputMode === 'jd') finalJobTarget = "Pasted Job Description";
    if (inputMode === 'company') finalJobTarget = `${selectedCompanyRole} at ${selectedCompany}`;

    if (inputMode === 'role' && !customJobRole) { setErrorMsg("Please enter your Target Job Role."); return; }
    if (inputMode === 'jd' && !jobDescriptionText) { setErrorMsg("Please paste a Job Description."); return; }
    if (inputMode === 'company' && (!selectedCompany || !selectedCompanyRole)) { setErrorMsg("Please select a Partner Company and an open role."); return; }
    
    if (!resumeFile) { setErrorMsg("Please upload your Resume PDF."); return; }
    if (cooldown > 0) return;

    setAnalyzing(true);
    setShowResults(false);
    setErrorMsg('');
    setIsCompanyDropdownOpen(false);
    setIsRoleDropdownOpen(false);

    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const q = query(collection(db, 'ats_scans'), where('userId', '==', auth.currentUser?.uid || 'anonymous'));
      const querySnapshot = await getDocs(q);
      const todaysScans = querySnapshot.docs.filter(doc => {
        const data = doc.data();
        if (!data.timestamp) return true; 
        return data.timestamp.toDate() >= startOfToday;
      });

      const maxScans = isTester ? 9999 : (isPremium ? 10 : 2);

      if (todaysScans.length >= maxScans) {
        if (isPremium && !isTester) {
          setErrorMsg("You have reached your daily limit of 10 scans. Please try again tomorrow.");
        } else if (isPublicUser) {
          setErrorMsg("Free daily limit reached (2/2). Please try again tomorrow, or upgrade to Premium for 10 daily scans.");
        } else {
          setErrorMsg("Free daily limit reached (2/2). Ask your university to upgrade to Premium to unlock 10 daily scans.");
        }
        setAnalyzing(false);
        return;
      }

      const extractedResumeText = await extractTextFromPDF(resumeFile);
      setExtractedText(extractedResumeText);

      const groq = new Groq({ apiKey: import.meta.env.VITE_GROQ_API_KEY, dangerouslyAllowBrowser: true });

      let prompt = "";
      if (inputMode === 'jd') {
        prompt = `You are an incredibly strict Applicant Tracking System (ATS). Evaluate this candidate against the following exact Job Description:
JOB DESCRIPTION:
${jobDescriptionText}
RESUME TEXT:
${extractedResumeText}
INSTRUCTIONS:
1. Extract the TOP 10 absolute mandatory technical and hard skills required by the pasted Job Description.
2. Evaluate the resume STRICTLY against these 10 skills. Yes (true) or No (false).
3. Suggest 4-5 "recommendedSkills" based on gaps between the resume and JD.
4. Provide 3-4 immediate "microActions" to tailor the resume better for this specific JD.
5. Evaluate formatting (0-100).
Output EXACTLY this JSON structure:
{"atsFormatScore": <Int 0-100>, "formatMessage": "<1-sentence>", "skillEvaluation": [{"skillName": "<Skill>", "foundInResume": <Bool>}], "recommendedSkills": ["<Skill>"], "microActions": ["<Action>"]}`;
      } else {
        prompt = `You are an incredibly strict Applicant Tracking System (ATS). Evaluate this candidate for the exact role of: "${finalJobTarget}".
RESUME TEXT:
${extractedResumeText}
INSTRUCTIONS:
1. Define the TOP 10 absolute mandatory technical skills required for "${finalJobTarget}". 
2. Evaluate the resume STRICTLY against these 10 skills. Yes (true) or No (false).
3. Suggest 4-5 "recommendedSkills" for future proofing.
4. Provide 3-4 immediate "microActions" to fix formatting or learn skills.
5. Evaluate formatting (0-100).
Output EXACTLY this JSON structure:
{"atsFormatScore": <Int 0-100>, "formatMessage": "<1-sentence>", "skillEvaluation": [{"skillName": "<Skill>", "foundInResume": <Bool>}], "recommendedSkills": ["<Skill>"], "microActions": ["<Action>"]}`;
      }

      const chatCompletion = await groq.chat.completions.create({ messages: [{ role: "user", content: prompt }], model: "llama-3.1-8b-instant", temperature: 0.1, response_format: { type: "json_object" } });
      const responseText = chatCompletion.choices[0]?.message?.content || "";
      let parsedData = JSON.parse(responseText);
      
      const safeFormatScore = parseInt(String(parsedData.atsFormatScore).replace(/\D/g, ''), 10) || 50;
      parsedData.atsFormatScore = safeFormatScore;

      const evaluation = Array.isArray(parsedData.skillEvaluation) ? parsedData.skillEvaluation : [];
      let extractedFound = evaluation.filter(item => item.foundInResume === true).map(item => item.skillName);
      let extractedMissing = evaluation.filter(item => item.foundInResume === false).map(item => item.skillName);
      
      parsedData.recommendedSkills = Array.isArray(parsedData.recommendedSkills) ? parsedData.recommendedSkills.slice(0, 5) : [];
      parsedData.foundSkills = extractedFound;
      parsedData.missingKeywords = extractedMissing.slice(0, 6);

      const foundCount = extractedFound.length;
      let baseMatchScore = (foundCount / 10) * 100;
      if (foundCount <= 4) baseMatchScore = Math.max(12, baseMatchScore - 25);
      baseMatchScore += Math.floor(Math.random() * 5) - 2; 
      parsedData.roleMatchScore = Math.max(12, Math.min(100, Math.round(baseMatchScore)));

      let formatBoost = (safeFormatScore / 100) * 8; 
      let calculatedProbability = (parsedData.roleMatchScore * 0.90) + formatBoost;
      if (parsedData.roleMatchScore < 40) calculatedProbability = parsedData.roleMatchScore - 5;
      
      parsedData.marketProbability = Math.max(5, Math.min(99, Math.round(calculatedProbability)));

      if (parsedData.roleMatchScore >= 80) parsedData.verdict = "Highly Likely (Strong Match)";
      else if (parsedData.roleMatchScore >= 60) parsedData.verdict = "Likely (Average Candidate)";
      else if (parsedData.roleMatchScore >= 35) parsedData.verdict = "Possible (Needs Upskilling)";
      else parsedData.verdict = "Auto-Rejected (Lacks Core Skills)";

      setAiResult(parsedData);
      setShowResults(true);

      try {
        await addDoc(collection(db, 'ats_scans'), {
          userId: auth.currentUser?.uid || 'anonymous',
          userEmail: auth.currentUser?.email || 'unknown_email',
          tenantId: tenantId, 
          targetRole: finalJobTarget,
          atsFormatScore: parsedData.atsFormatScore,
          roleMatchScore: parsedData.roleMatchScore,
          marketProbability: parsedData.marketProbability,
          score: parsedData.roleMatchScore,
          verdict: parsedData.verdict,
          foundSkills: parsedData.foundSkills,
          missingKeywords: extractedMissing, 
          recommendedSkills: parsedData.recommendedSkills,
          timestamp: serverTimestamp(),
        });
      } catch (dbError) { console.error("Firebase Error:", dbError); }

      setCooldown(60);
      localStorage.setItem('lastScanTime', Date.now().toString());
      fetchScansUsedToday();

    } catch (error) {
      console.error("System Error:", error);
      setErrorMsg("The scan failed. Please check your console.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExportClick = async () => {
    if (!isPremium) { setShowUpgradeModal(true); return; }
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#04060d' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'landscape' : 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save('SkillNova_ATS_Report.pdf');
    } catch (err) { console.error("PDF Gen Error: ", err); } 
    finally { setExporting(false); }
  };

  const handleGenerateCoverLetter = async () => {
    if (!isPremium) { setShowUpgradeModal(true); return; }

    setIsGeneratingLetter(true);
    setShowLetterModal(true);
    setCoverLetter('');
    setCopied(false);

    try {
      const finalJobTarget = inputMode === 'role' ? customJobRole : (inputMode === 'company' ? `${selectedCompanyRole} at ${selectedCompany}` : "the specified Job Description");
      if (!extractedText || extractedText.trim().length < 50) {
        setCoverLetter("⚠️ Please analyze your resume first.");
        setIsGeneratingLetter(false); return;
      }
      const groq = new Groq({ apiKey: import.meta.env.VITE_GROQ_API_KEY, dangerouslyAllowBrowser: true });
      const prompt = `Generate a professional cover letter for the role of ${finalJobTarget} based on this resume: ${extractedText}. Format strictly with [Square Brackets] for missing personal data. Keep it 150-250 words. No intro/outro remarks.`;
      const chatCompletion = await groq.chat.completions.create({ messages: [{ role: "user", content: prompt }], model: "llama-3.1-8b-instant", temperature: 0.7 });
      setCoverLetter(chatCompletion.choices[0]?.message?.content || "Failed to generate.");
    } catch (error) {
      setCoverLetter("❌ Error generating cover letter.");
    } finally { setIsGeneratingLetter(false); }
  };

  const copyToClipboard = () => { navigator.clipboard.writeText(coverLetter); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const getScoreColor = (score) => { if (score >= 75) return 'bg-emerald-500'; if (score >= 45) return 'bg-amber-500'; return 'bg-rose-500'; };
  const getScoreText = (score) => { if (score >= 75) return 'text-emerald-400'; if (score >= 45) return 'text-amber-400'; return 'text-rose-400'; };

  return (
    <div className="min-h-screen bg-[#04060d] text-slate-200 p-4 md:p-8 font-sans pb-24 relative overflow-x-hidden">
      <style>
        {`
          html { scroll-behavior: smooth; }
          .bg-grid-pattern {
            background-image: 
              linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px),
              linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
            background-size: 100px 100px, 100px 100px, 20px 20px, 20px 20px;
            transition: background-position 0.1s ease-out;
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); filter: blur(4px); }
            to { opacity: 1; transform: translateY(0); filter: blur(0); }
          }
          .animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        `}
      </style>

      <div className="fixed inset-0 pointer-events-none z-0">
        <div ref={gridRef} className="absolute inset-0 bg-grid-pattern [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-indigo-600/20 to-purple-600/10 blur-[150px] rounded-full"></div>
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        
        {/* --- NAVBAR --- */}
        <nav className="sticky top-4 md:top-6 z-50 mb-12 animate-fade-in-up">
          <div className="bg-[#0a0f1c]/70 backdrop-blur-xl border border-slate-700/50 rounded-full px-4 py-2.5 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
            <div className="flex items-center gap-3 pl-2">
              <SkillNovaLogo className="w-9 h-9 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
              <span className="text-lg font-extrabold text-white tracking-tight hidden sm:block">SkillNova</span>
            </div>
            <div className="relative">
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-3 pl-4 pr-1.5 py-1.5 bg-slate-800/40 hover:bg-slate-700/50 border border-slate-700/50 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                <span className="text-sm font-medium text-slate-300 hidden md:block">{auth.currentUser?.email || 'Student'}</span>
                <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30">
                  {auth.currentUser?.email ? auth.currentUser.email.charAt(0).toUpperCase() : <User size={16}/>}
                </div>
              </button>
              {isProfileOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-[#0a0f1c]/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl overflow-hidden py-2 animate-fade-in-up z-50">
                  <div className="px-4 py-3 border-b border-slate-700/50 mb-2 bg-slate-800/30">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Signed in as</p>
                    <p className="text-sm text-white font-medium truncate">{auth.currentUser?.email}</p>
                  </div>
                  <div className="px-4 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Account Status</span>
                      {isPremium ? (
                        <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-md flex items-center gap-1"><Crown size={12}/> Premium</span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-800 border border-slate-700 px-2 py-1 rounded-md">Free Tier</span>
                      )}
                    </div>
                  </div>
                  <div className="h-px bg-slate-700/50 my-2"></div>
                  <button onClick={() => auth.signOut()} className="w-full text-left px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors flex items-center gap-2 font-medium">
                    <LogOut size={16} /> Sign Out Securely
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">ATS Rejection Simulator</h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">See your exact hiring probability based on the skills you actually possess.</p>
        </header>

        {/* --- CONTROL PANEL GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          
          <div className={`w-full bg-[#0a0f1c]/80 backdrop-blur-md border ${isPremium ? 'border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]' : 'border-slate-700'} rounded-xl px-5 py-4 flex items-center justify-between transition-all`}>
            <div className="flex items-center gap-3">
              {isPremium ? <Crown className="text-indigo-400" size={24} /> : <Activity className="text-slate-500" size={24} />}
              <div>
                <p className="text-white font-bold text-sm md:text-base">{isPremium ? 'Premium Access' : 'Standard Free Tier'}</p>
                <p className="text-slate-400 text-xs">
                  {isTester ? 'QA Bypass Mode' : (isPublicUser ? 'Public User' : `Cohort: ${tenantId?.toUpperCase()}`)}
                </p>
              </div>
            </div>
            {(() => {
              const maxScans = isTester ? 9999 : (isPremium ? 10 : 2);
              const remaining = Math.max(0, maxScans - scansUsedToday);
              const isExhausted = remaining === 0;
              return (
                <div className={`flex flex-col items-center px-4 py-2 rounded-xl border text-center ${
                  isExhausted ? 'bg-rose-500/10 border-rose-500/25' : remaining <= 1 ? 'bg-amber-500/10 border-amber-500/25' : 'bg-emerald-500/10 border-emerald-500/25'
                }`}>
                  <span className={`text-lg md:text-xl font-extrabold leading-none ${
                    isExhausted ? 'text-rose-400' : remaining <= 1 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {isTester ? '∞' : `${remaining}/${maxScans}`}
                  </span>
                  <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Scans Left</span>
                </div>
              );
            })()}
          </div>

          {/* --- THE IRRESISTIBLE PREMIUM HUB AD --- */}
          {!isPremium ? (
            <div 
              onClick={() => setShowUpgradeModal(true)}
              className="w-full relative overflow-hidden rounded-xl border border-indigo-500/40 bg-[#0a0f1c]/90 p-4 cursor-pointer group hover:border-purple-400 transition-all shadow-[0_0_20px_rgba(99,102,241,0.15)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 opacity-50 group-hover:opacity-100 transition-opacity"></div>
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500/30 blur-2xl rounded-full"></div>
              
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30 flex items-center justify-center">
                    <Crown size={22} />
                  </div>
                  <div className="flex flex-col justify-center">
                    <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300 font-extrabold text-sm md:text-base leading-tight">
                      Enterprise Placement 
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                      <p className="text-slate-300 text-xs">14 Recruiters hiring now</p>
                    </div>
                  </div>
                </div>
                
                <button className="bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs font-bold flex items-center gap-1.5 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-lg">
                  <Lock size={12} /> Unlock
                </button>
              </div>
            </div>
          ) : (
            // The Normal Toggle for Premium Users
            <div className={`w-full bg-[#0a0f1c]/80 backdrop-blur-md border ${isOpenToOpportunities ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border-slate-700'} rounded-xl px-5 py-4 flex items-center justify-between transition-all cursor-pointer`} onClick={() => !isUpdatingProfile && handleToggleOpportunities()}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 md:p-3 rounded-full transition-colors ${isOpenToOpportunities ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                  <Network size={20} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm md:text-base flex items-center gap-2">
                    Employer Network 
                  </h3>
                  <p className="text-slate-400 text-xs mt-1 max-w-[200px] leading-tight">
                    Allow corporate partners to discover your best resume.
                  </p>
                </div>
              </div>
              <button disabled={isUpdatingProfile} className={`relative inline-flex h-6 w-11 md:h-7 md:w-14 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${isOpenToOpportunities ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                <span className={`inline-block h-4 w-4 md:h-5 md:w-5 transform rounded-full bg-white transition-transform ${isOpenToOpportunities ? 'translate-x-6 md:translate-x-8' : 'translate-x-1'}`} />
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-xl mb-6 flex items-start gap-3 animate-fade-in-up">
            <AlertTriangle size={20} className="mt-0.5 flex-shrink-0" />
            <p className="font-medium text-sm leading-relaxed">{errorMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 relative z-10">
          <div className="bg-[#0a0f1c]/60 backdrop-blur-sm border border-slate-800 p-5 md:p-6 rounded-2xl flex flex-col hover:border-slate-700 transition-colors">
            
            {/* --- THE TRIPLE-THREAT TABS --- */}
            <div className="flex flex-col sm:flex-row p-1 bg-slate-800/80 rounded-lg mb-6 border border-slate-700 shadow-inner gap-1">
              <button 
                onClick={() => setInputMode('role')} 
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs md:text-sm font-medium rounded-md transition-all ${inputMode === 'role' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Search size={14} /> General
              </button>
              
              <button 
                onClick={() => isPremium ? setInputMode('jd') : setShowUpgradeModal(true)} 
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs md:text-sm font-medium rounded-md transition-all ${inputMode === 'jd' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {isPremium ? <FileText size={14} /> : <Lock size={12} className="text-indigo-400/70" />} Paste JD
              </button>

              <button 
                onClick={() => isPremium ? setInputMode('company') : setShowUpgradeModal(true)} 
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs md:text-sm font-medium rounded-md transition-all ${inputMode === 'company' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {isPremium ? <Building2 size={14} /> : <Lock size={12} className="text-indigo-400/70" />} Partners
              </button>
            </div>

            <div className="flex-1 flex flex-col justify-center">
              {inputMode === 'role' && (
                <div className="animate-fade-in-up">
                  <h3 className="text-sm md:text-lg font-semibold text-white mb-2 flex items-center gap-2"><Briefcase className="text-indigo-400" size={18} /> Target Job Role</h3>
                  <input type="text" value={customJobRole} onChange={(e) => setCustomJobRole(e.target.value)} placeholder="e.g. Junior Web Developer" className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-3 md:p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm md:text-lg text-white font-medium shadow-inner" />
                </div>
              )}

              {inputMode === 'jd' && (
                <div className="animate-fade-in-up flex-1 flex flex-col">
                  <h3 className="text-sm md:text-lg font-semibold text-white mb-2 flex items-center gap-2"><FileText className="text-indigo-400" size={18} /> Paste Job Description</h3>
                  <div className="relative flex-1 flex flex-col mt-2">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl pointer-events-none"></div>
                    <textarea value={jobDescriptionText} onChange={(e) => setJobDescriptionText(e.target.value)} placeholder="Paste the full job description from LinkedIn, Indeed, etc..." className="w-full flex-1 min-h-[140px] bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 hover:border-indigo-500/50 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs md:text-sm text-slate-300 font-medium shadow-inner resize-none transition-colors relative z-10" />
                  </div>
                </div>
              )}

              {inputMode === 'company' && (
                <div className="animate-fade-in-up">
                  <h3 className="text-sm md:text-lg font-semibold text-white mb-2 flex items-center gap-2"><Building2 className="text-indigo-400" size={18} /> Select Partner</h3>
                  <div className="relative mb-4">
                    <button type="button" onClick={() => { setIsCompanyDropdownOpen(!isCompanyDropdownOpen); setIsRoleDropdownOpen(false); }} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-3 md:p-4 flex justify-between items-center text-white text-sm md:text-base font-medium hover:border-indigo-500/50 transition-colors shadow-inner"><span className={selectedCompany ? 'text-white' : 'text-slate-400'}>{selectedCompany || "Select a Company..."}</span><ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${isCompanyDropdownOpen ? 'rotate-180' : ''}`} /></button>
                    {isCompanyDropdownOpen && (
                      <div className="absolute z-50 w-full mt-2 bg-[#0a0f1c]/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in-up">{partnerCompanies.map((c, i) => (<div key={i} onClick={() => { setSelectedCompany(c.name); setSelectedCompanyRole(''); setIsCompanyDropdownOpen(false); }} className="px-4 py-3 cursor-pointer text-sm text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors border-b border-slate-700/50 last:border-0">{c.name}</div>))}</div>
                    )}
                  </div>
                  {selectedCompany && (
                    <div className="relative animate-fade-in-up">
                      <button type="button" onClick={() => { setIsRoleDropdownOpen(!isRoleDropdownOpen); setIsCompanyDropdownOpen(false); }} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-3 md:p-4 flex justify-between items-center text-white text-sm md:text-base font-medium hover:border-indigo-500/50 transition-colors shadow-inner"><span className={selectedCompanyRole ? 'text-white' : 'text-slate-400'}>{selectedCompanyRole || "Select Open Role..."}</span><ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${isRoleDropdownOpen ? 'rotate-180' : ''}`} /></button>
                      {isRoleDropdownOpen && (
                        <div className="absolute z-50 w-full mt-2 bg-[#0a0f1c]/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in-up">{partnerCompanies.find(c => c.name === selectedCompany)?.roles.map((r, i) => (<div key={i} onClick={() => { setSelectedCompanyRole(r); setIsRoleDropdownOpen(false); }} className="px-4 py-3 cursor-pointer text-sm text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors border-b border-slate-700/50 last:border-0">{r}</div>))}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#0a0f1c]/60 backdrop-blur-sm border border-slate-800 p-5 md:p-6 rounded-2xl flex flex-col relative z-0 hover:border-slate-700 transition-colors">
             <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><FileUp className="text-emerald-400" size={20} /> Upload Resume (PDF)</h3>
            <label className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer min-h-[140px] md:min-h-[160px] ${resumeFile ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-700 bg-slate-900/50 hover:border-emerald-500/30'}`}>
              <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
              {resumeFile ? (
                <div className="text-center animate-fade-in-up"><FileText className="text-emerald-400 w-8 h-8 mx-auto mb-2" /><p className="text-emerald-300 text-sm font-medium px-4 truncate max-w-[200px]">{resumeFile.name}</p><p className="text-xs text-emerald-500/70 mt-2">Ready to scan</p></div>
              ) : (
                <div className="text-center"><FileUp className="text-slate-400 w-8 h-8 mx-auto mb-2" /><p className="text-white text-sm font-medium">Click to browse</p></div>
              )}
            </label>
          </div>
        </div>

        <div className="flex justify-center mb-12 relative z-0">
          <button onClick={handleAnalyze} disabled={analyzing || cooldown > 0} className={`px-8 md:px-10 py-3.5 md:py-4 rounded-xl font-bold text-base md:text-lg transition-all flex items-center gap-3 shadow-lg ${cooldown > 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : analyzing ? 'bg-indigo-600/50 text-white/70 cursor-wait' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25 transform hover:-translate-y-1 hover:shadow-indigo-500/40'}`}>
            {cooldown > 0 ? <><Clock size={20} /> Cooldown: {cooldown}s</> : analyzing ? 'Analyzing Market Match...' : <><Activity size={20} /> Simulate ATS Scan</>}
          </button>
        </div>

        {/* --- RESULTS DASHBOARD --- */}
        {showResults && aiResult && (
          <div className="animate-fade-in-up relative z-0">
            <div className="flex justify-end gap-3 mb-4">
              <button onClick={handleGenerateCoverLetter} className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-lg text-sm font-medium text-indigo-300 transition-colors shadow-sm">
                 {isPremium ? <Sparkles size={16} /> : <Lock size={16} className="text-rose-400" />} Draft Cover Letter
              </button>
              
              <button onClick={handleExportClick} disabled={exporting} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm font-medium text-white transition-colors shadow-sm">
                {exporting ? (
                  <Activity size={16} className="animate-spin" />
                ) : (
                  isPremium ? <Download size={16} className="text-emerald-400" /> : <Lock size={16} className="text-rose-400" />
                )}
                {exporting ? 'Generating PDF...' : 'Download Report'}
              </button>
            </div>

            <div ref={reportRef} className="space-y-6 p-4 md:p-6 -m-4 md:-m-6 bg-[#04060d] rounded-2xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#0a0f1c]/60 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 shadow-lg shadow-black/20">
                  <div className="flex justify-between items-center mb-4"><h3 className="text-md font-bold text-white flex items-center gap-2"><LayoutTemplate className="text-blue-400" size={18} /> ATS Readability</h3><span className={`text-2xl font-bold ${getScoreText(aiResult.atsFormatScore)}`}>{aiResult.atsFormatScore}%</span></div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 mb-4"><div className={`h-2.5 rounded-full ${getScoreColor(aiResult.atsFormatScore)} transition-all duration-1000`} style={{ width: `${aiResult.atsFormatScore}%` }}></div></div>
                  <p className="text-xs text-slate-300 bg-slate-800/50 p-3 rounded-lg border border-slate-700 leading-relaxed">{aiResult.formatMessage}</p>
                </div>

                <div className="bg-[#0a0f1c]/60 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 shadow-lg shadow-black/20">
                   <div className="flex justify-between items-center mb-4"><h3 className="text-md font-bold text-white flex items-center gap-2"><Briefcase className="text-indigo-400" size={18} /> Technical Match</h3><span className={`text-2xl font-bold ${getScoreText(aiResult.roleMatchScore)}`}>{aiResult.roleMatchScore}%</span></div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 mb-4"><div className={`h-2.5 rounded-full ${getScoreColor(aiResult.roleMatchScore)} transition-all duration-1000`} style={{ width: `${aiResult.roleMatchScore}%` }}></div></div>
                  <div className="flex flex-col gap-1 mt-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700"><span className="text-xs text-slate-400">System Verdict:</span><span className={`text-sm font-bold tracking-wide ${aiResult.roleMatchScore >= 60 ? 'text-emerald-400' : 'text-rose-400'}`}>{aiResult.verdict}</span></div>
                </div>

                <div className="bg-[#0a0f1c]/60 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 relative overflow-hidden shadow-lg shadow-black/20">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-purple-500/20 to-transparent rounded-bl-full"></div>
                  <div className="flex justify-between items-center mb-4 relative z-10"><h3 className="text-md font-bold text-white flex items-center gap-2"><TrendingUp className="text-purple-400" size={18} /> Market Probability</h3><span className={`text-2xl font-bold ${getScoreText(aiResult.marketProbability)}`}>{aiResult.marketProbability}%</span></div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 mb-4 relative z-10"><div className={`h-2.5 rounded-full ${getScoreColor(aiResult.marketProbability)} transition-all duration-1000`} style={{ width: `${aiResult.marketProbability}%` }}></div></div>
                  <div className="flex items-start gap-2 mt-3 bg-purple-500/10 p-3 rounded-lg border border-purple-500/20 relative z-10"><Info size={14} className="text-purple-400 mt-0.5 flex-shrink-0" /><span className="text-xs text-purple-200 leading-tight">Your actual chance of securing an interview based on the skills you <strong>do</strong> possess.</span></div>
                </div>
              </div>

              <div className="bg-[#0a0f1c]/40 border border-slate-800 rounded-2xl p-6 md:p-8 relative overflow-hidden">
                <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 transition-all duration-500 ${!isPremium ? 'blur-[6px] opacity-30 select-none pointer-events-none' : ''}`}>
                  
                  <div className="space-y-8">
                    <div>
                      <h4 className="text-base md:text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2"><CheckCircle size={18} /> Validated Core Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {aiResult.foundSkills && aiResult.foundSkills.length > 0 ? aiResult.foundSkills.map((skill, i) => (
                          <span key={i} className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium text-emerald-400 shadow-sm">{skill}</span>
                        )) : <span className="text-slate-500 text-sm">No exact core skills matched.</span>}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-base md:text-lg font-semibold text-rose-400 mb-4 flex items-center gap-2"><AlertTriangle size={18} /> Critical Skill Gaps</h4>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {aiResult.missingKeywords && aiResult.missingKeywords.length > 0 ? aiResult.missingKeywords.map((skill, i) => (
                          <span key={i} className="bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium text-rose-400 shadow-sm">{skill}</span>
                        )) : <span className="text-emerald-400 text-sm">All major keywords detected!</span>}
                      </div>
                      {aiResult.missingKeywords && aiResult.missingKeywords.length > 0 && (
                        <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl mt-2">
                          <p className="text-xs text-rose-200"><strong>Note:</strong> These are mandatory baseline requirements for this role that you are currently missing.</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-base md:text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2"><Rocket size={18} /> Recommended Upskilling</h4>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {aiResult.recommendedSkills && aiResult.recommendedSkills.length > 0 ? aiResult.recommendedSkills.map((skill, i) => (
                          <span key={i} className="bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium text-blue-400 shadow-sm">{skill}</span>
                        )) : <span className="text-slate-500 text-sm">No new recommendations available.</span>}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base md:text-lg font-semibold text-white mb-4 flex items-center gap-2"><TrendingUp className="text-indigo-400" size={18} /> Actionable Improvement Roadmap</h4>
                    <ul className="space-y-4">
                      {aiResult.microActions && aiResult.microActions.map((action, i) => (
                        <li key={i} className="bg-slate-800/50 p-4 md:p-5 rounded-lg border border-slate-700 text-xs md:text-sm text-slate-300 flex items-start gap-3 md:gap-4 hover:border-indigo-500/50 transition-colors shadow-sm">
                          <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md mt-0.5">{i + 1}</span> 
                          <span className="leading-relaxed text-[13px] md:text-[15px]">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {!isPremium && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#04060d]/40 backdrop-blur-[2px] p-6 text-center">
                    <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                      <Lock className="text-indigo-400 w-8 h-8" />
                    </div>
                    <h4 className="text-white font-bold text-xl mb-2">Deep Insights Locked</h4>
                    <p className="text-sm text-slate-300 mb-6 leading-relaxed max-w-md">
                      {isPublicUser 
                        ? "You are currently on the SkillNova Free Tier. Upgrade to Premium to reveal your exact skill gaps, validated skills, and actionable roadmap."
                        : "Your institution is currently on the SkillNova Free Tier. Please contact your university administration and request they upgrade to Premium to reveal your exact skill gaps and actionable roadmap."
                      }
                    </p>
                    <button onClick={() => setShowUpgradeModal(true)} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl text-sm shadow-lg transition-all">
                      {isPublicUser ? "Upgrade to Premium" : "Contact Administrator"}
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* --- UPGRADE TO PREMIUM MODAL --- */}
        {showUpgradeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up">
            <div className="bg-gradient-to-b from-[#0a0f1c] to-[#04060d] border border-indigo-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col relative">
              <button onClick={() => setShowUpgradeModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"><X size={20} /></button>
              
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/30">
                  <Crown className="text-white w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Unlock Enterprise Placement</h2>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                  Stop applying in the dark. Upgrade to Premium to tailor your resume to exact job requirements and get discovered by our hiring partners.
                </p>
                
                <ul className="text-left text-sm text-slate-300 space-y-3 mb-8 bg-slate-800/50 p-5 rounded-xl border border-slate-700">
                  <li className="flex items-center gap-2"><CheckCircle className="text-emerald-400" size={16}/> Join the Employer Discovery Network</li>
                  <li className="flex items-center gap-2"><CheckCircle className="text-emerald-400" size={16}/> Match resumes against exact Job Descriptions</li>
                  <li className="flex items-center gap-2"><CheckCircle className="text-emerald-400" size={16}/> Apply directly to Partner Companies</li>
                  <li className="flex items-center gap-2"><CheckCircle className="text-emerald-400" size={16}/> 10 Daily ATS Scans</li>
                  <li className="flex items-center gap-2"><CheckCircle className="text-emerald-400" size={16}/> AI-Generated Custom Cover Letters</li>
                </ul>

                <button onClick={() => {setShowUpgradeModal(false); alert("Billing integration goes here!");}} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2">
                  {isPublicUser ? "Upgrade Now" : "Contact Sales to Upgrade"} <ArrowRight size={18}/>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- COVER LETTER MODAL --- */}
        {showLetterModal && isPremium && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up">
            <div className="bg-[#0a0f1c] border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-4 py-3 md:px-6 md:py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                   <Sparkles className="text-indigo-400" /> AI Cover Letter Draft
                </h3>
                <button onClick={() => setShowLetterModal(false)} className="text-slate-400 hover:text-rose-400 transition-colors"><X size={20} md:size={24} /></button>
              </div>
              <div className="p-4 md:p-6 overflow-y-auto flex-1">
                {isGeneratingLetter ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4"><Activity className="text-indigo-500 animate-spin w-8 h-8 md:w-10 md:h-10" /><p className="text-slate-400 animate-pulse text-sm md:text-base">Drafting your perfect response...</p></div>
                ) : (
                  <div className="space-y-4 text-slate-300 leading-relaxed whitespace-pre-wrap font-serif text-sm md:text-lg bg-[#04060d] p-4 md:p-6 rounded-xl border border-slate-800 font-mono shadow-inner">
                    {coverLetter}
                  </div>
                )}
              </div>
              {!isGeneratingLetter && (
                <div className="px-4 py-3 md:px-6 md:py-4 border-t border-slate-700 bg-slate-800/50 flex justify-end">
                  <button onClick={copyToClipboard} className={`flex items-center gap-2 px-4 py-2 md:px-6 md:py-3 rounded-xl text-sm md:text-base font-medium transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'}`}>{copied ? <CheckCircle size={16} md:size={18} /> : <Copy size={16} md:size={18} />}{copied ? 'Copied to Clipboard!' : 'Copy Letter'}</button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
