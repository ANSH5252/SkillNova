import React, { useState, useEffect, useRef } from 'react';
import { 
  Briefcase, FileUp, AlertTriangle, CheckCircle, XCircle, Activity, 
  Clock, FileText, LayoutTemplate, Building2, Search, ChevronDown, Download, Sparkles, Copy, X, TrendingUp, Info, Rocket, Lock
} from 'lucide-react';
import { auth, db } from './firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore'; 
import Groq from "groq-sdk";

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const partnerCompanies = [
  { name: "TechFlow Solutions", roles: ["Junior React Developer", "Senior UI/UX Designer", "Product Manager"] },
  { name: "Nexus Security", roles: ["Entry-Level Cybersecurity Analyst", "Senior Cloud Engineer"] },
  { name: "InnovateEd", roles: ["Full-Stack Engineer (MERN)", "Junior Data Scientist", "Lead ML Engineer"] }
];

export default function StudentDashboard() {
  const [analyzing, setAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  const [inputMode, setInputMode] = useState('role');
  const [customJobRole, setCustomJobRole] = useState('');
  
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedCompanyRole, setSelectedCompanyRole] = useState('');
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  // --- DYNAMIC PARTNER CODE STATES ---
  const [partnerCode, setPartnerCode] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  const [resumeFile, setResumeFile] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const [extractedText, setExtractedText] = useState('');
  const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [copied, setCopied] = useState(false);

  const reportRef = useRef(null);

  // --- THE FIX: DYNAMIC DATABASE VERIFICATION ---
  useEffect(() => {
    const codeToVerify = partnerCode.trim().toUpperCase();

    if (!codeToVerify) {
      setIsPremium(false);
      setIsValidatingCode(false);
      return;
    }

    setIsValidatingCode(true);
    setIsPremium(false); // Reset while typing

    // Debounce: Wait 600ms after the user stops typing before asking the database
    const delayDebounceFn = setTimeout(async () => {
      try {
        // Ask Firestore: Does any admin have this exact tenantId?
        const q = query(collection(db, 'admins'), where('tenantId', '==', codeToVerify));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          setIsPremium(true); // Match found! Unlock premium.
        } else {
          setIsPremium(false); // No match.
        }
      } catch (error) {
        console.error("Error validating code:", error);
        setIsPremium(false);
      } finally {
        setIsValidatingCode(false);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [partnerCode]);

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
    const finalJobTarget = inputMode === 'role' 
      ? customJobRole 
      : `${selectedCompanyRole} at ${selectedCompany}`;

    if (inputMode === 'role' && !customJobRole) { setErrorMsg("Please enter your Target Job Role."); return; }
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

      const maxScans = isPremium ? 10 : 2;

      if (todaysScans.length >= maxScans) {
        setErrorMsg(isPremium
          ? "You have reached your university's daily limit of 10 scans. Please try again tomorrow."
          : "Free daily limit reached (2/2). Enter your University Partner Code above to unlock 10 daily scans and Cover Letters."
        );
        setAnalyzing(false);
        return;
      }

      const extractedResumeText = await extractTextFromPDF(resumeFile);
      setExtractedText(extractedResumeText);

      const groq = new Groq({ 
        apiKey: import.meta.env.VITE_GROQ_API_KEY, 
        dangerouslyAllowBrowser: true 
      });

      const prompt = `
You are an incredibly strict Applicant Tracking System (ATS) and an Expert Career Advisor.
Evaluate this candidate for the exact role of: "${finalJobTarget}".

RESUME TEXT:
${extractedResumeText}

INSTRUCTIONS:
1. Define the TOP 10 absolute mandatory technical skills required for "${finalJobTarget}". 
2. Evaluate the resume STRICTLY against these 10 skills. Yes (true) or No (false).
3. RUTHLESS RULE: DO NOT give credit for impressive skills irrelevant to the target role.
4. FUTURE PROOFING: Suggest 4-5 "recommendedSkills". These should be trending, highly sought-after, or advanced technologies for this specific role.
5. ACTIONABLE FEEDBACK ("microActions"): Provide 3-4 immediate, highly specific next steps. This MUST include a mix of:
   - 1-2 steps on exactly how to improve their resume's formatting, layout, or phrasing based on your scan.
   - 1-2 strategic steps on how to learn the missing/recommended skills (e.g., specific project ideas).
6. Evaluate formatting (0-100). Deduct for messiness. DO NOT output 80.

Output EXACTLY this JSON structure:
{
  "atsFormatScore": <Integer 0-100>,
  "formatMessage": "<1-sentence critique>",
  "skillEvaluation": [
    {"skillName": "<Required Skill 1>", "foundInResume": true},
    {"skillName": "<Required Skill 2>", "foundInResume": false}
  ],
  "recommendedSkills": ["<Trending Tech 1>", "<Trending Tech 2>", "<Trending Tech 3>", "<Trending Tech 4>"],
  "microActions": ["<Action 1>", "<Action 2>", "<Action 3>"]
}
`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant",
        temperature: 0.1, 
        response_format: { type: "json_object" } 
      });

      const responseText = chatCompletion.choices[0]?.message?.content || "";
      let parsedData = JSON.parse(responseText);
      
      const rawFormatScore = String(parsedData.atsFormatScore).replace(/\D/g, '');
      const safeFormatScore = parseInt(rawFormatScore, 10) || 50;
      parsedData.atsFormatScore = safeFormatScore;

      const evaluation = Array.isArray(parsedData.skillEvaluation) ? parsedData.skillEvaluation : [];
      let extractedFound = evaluation.filter(item => item.foundInResume === true).map(item => item.skillName);
      let extractedMissing = evaluation.filter(item => item.foundInResume === false).map(item => item.skillName);
      
      parsedData.recommendedSkills = Array.isArray(parsedData.recommendedSkills) ? parsedData.recommendedSkills.slice(0, 5) : [];

      parsedData.foundSkills = extractedFound;
      parsedData.missingKeywords = extractedMissing.slice(0, 6);

      const foundCount = extractedFound.length;

      let baseMatchScore = (foundCount / 10) * 100;
      if (foundCount <= 4) {
        baseMatchScore = Math.max(12, baseMatchScore - 25);
      }
      
      baseMatchScore += Math.floor(Math.random() * 5) - 2; 
      parsedData.roleMatchScore = Math.max(12, Math.min(100, Math.round(baseMatchScore)));

      let formatBoost = (safeFormatScore / 100) * 8; 
      let calculatedProbability = (parsedData.roleMatchScore * 0.90) + formatBoost;

      if (parsedData.roleMatchScore < 40) {
        calculatedProbability = parsedData.roleMatchScore - 5;
      }
      
      parsedData.marketProbability = Math.max(5, Math.min(99, Math.round(calculatedProbability)));

      if (parsedData.roleMatchScore >= 80) {
        parsedData.verdict = "Highly Likely (Strong Match)";
      } else if (parsedData.roleMatchScore >= 60) {
        parsedData.verdict = "Likely (Average Candidate)";
      } else if (parsedData.roleMatchScore >= 35) {
        parsedData.verdict = "Possible (Needs Upskilling)";
      } else {
        parsedData.verdict = "Auto-Rejected (Lacks Core Skills)";
      }

      setAiResult(parsedData);
      setShowResults(true);

      const finalTenantId = isPremium ? partnerCode.trim().toUpperCase() : 'public';

      try {
        await addDoc(collection(db, 'ats_scans'), {
          userId: auth.currentUser?.uid || 'anonymous',
          userEmail: auth.currentUser?.email || 'unknown_email',
          tenantId: finalTenantId, 
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
      } catch (dbError) {
        console.error("Firebase Error:", dbError);
      }

      setCooldown(60);
      localStorage.setItem('lastScanTime', Date.now().toString());

    } catch (error) {
      console.error("System Error:", error);
      setErrorMsg("The scan failed. Please check your console.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, backgroundColor: '#0f172a', windowWidth: reportRef.current.scrollWidth, windowHeight: reportRef.current.scrollHeight
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'landscape' : 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save('SkillNova_ATS_Report.pdf');
    } catch (err) {
      console.error("PDF Gen Error: ", err);
    } finally {
      setExporting(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!isPremium) {
      setCoverLetter("🔒 PREMIUM FEATURE\n\nCover Letter generation is strictly locked on the Free Tier.\n\nPlease enter a valid University Partner Code at the top of your dashboard to unlock AI-generated cover letters tailored perfectly to beat the ATS.");
      setShowLetterModal(true);
      return;
    }

    setIsGeneratingLetter(true);
    setShowLetterModal(true);
    setCoverLetter('');
    setCopied(false);

    try {
      const finalJobTarget = inputMode === 'role' ? customJobRole : `${selectedCompanyRole} at ${selectedCompany}`;
      if (!extractedText || extractedText.trim().length < 50) {
        setCoverLetter("⚠️ Please analyze your resume first.");
        setIsGeneratingLetter(false); return;
      }

      const groq = new Groq({ apiKey: import.meta.env.VITE_GROQ_API_KEY, dangerouslyAllowBrowser: true });
      
      const prompt = `You are a professional career assistant. Generate a complete, formal cover letter for the role of ${finalJobTarget}. 

Resume Content: ${extractedText}

RULES:
- Maintain a professional, confident tone.
- Compensate smartly for any missing core skills by highlighting adaptability or related experience.
- The body should be 150-250 words.
- You MUST format the output exactly like a traditional letter, using [Square Brackets] for placeholder data the user needs to fill in manually. Do NOT use markdown formatting (like **bolding**).

FORMAT TO FOLLOW EXACTLY:
[Your Name]
[Your Phone Number] | [Your Email] | [Your LinkedIn/Portfolio]

[Date]

Hiring Manager
[Company Name]
[Company Address/City]

Dear [Hiring Manager Name or "Hiring Team"],

(Write the body of the cover letter here)

Sincerely,

[Your Name]

RETURN ONLY THE PLAIN TEXT LETTER. No introductory or concluding remarks.`;

      const chatCompletion = await groq.chat.completions.create({ messages: [{ role: "user", content: prompt }], model: "llama-3.1-8b-instant", temperature: 0.7 });
      setCoverLetter(chatCompletion.choices[0]?.message?.content || "Failed to generate.");
    } catch (error) {
      setCoverLetter("❌ Error generating cover letter.");
    } finally {
      setIsGeneratingLetter(false);
    }
  };

  const copyToClipboard = () => { navigator.clipboard.writeText(coverLetter); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const getScoreColor = (score) => { if (score >= 75) return 'bg-emerald-500'; if (score >= 45) return 'bg-amber-500'; return 'bg-rose-500'; };
  const getScoreText = (score) => { if (score >= 75) return 'text-emerald-400'; if (score >= 45) return 'text-amber-400'; return 'text-rose-400'; };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-8 font-sans pb-24">
      <div className="max-w-5xl mx-auto">
        
        <header className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-4">
            <Activity size={16} /> SkillNova Core Engine
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">ATS Rejection Simulator</h1>
          <p className="text-slate-400 text-lg">See your exact hiring probability based on the skills you actually possess.</p>
        </header>

        {/* --- DYNAMIC COHORT KEY INPUT --- */}
        <div className="flex justify-center mb-8 relative z-0">
          <div className={`w-full max-w-lg bg-[#1e293b]/80 border ${isPremium ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border-slate-700'} rounded-xl p-2 pl-4 flex items-center gap-3 transition-all focus-within:border-indigo-500/50`}>
            
            {/* Dynamic Loading Icon */}
            {isValidatingCode ? (
              <Activity className="text-indigo-400 animate-spin" size={20} />
            ) : isPremium ? (
              <CheckCircle className="text-emerald-400" size={20} />
            ) : (
              <Building2 className="text-slate-400" size={20} />
            )}

            <input 
              type="text" 
              value={partnerCode}
              onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
              placeholder="Enter University Partner Code" 
              className="w-full bg-transparent border-none focus:outline-none text-white placeholder:text-slate-500 text-sm py-2 uppercase"
            />
            {isPremium && !isValidatingCode && <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider whitespace-nowrap mr-2">Premium Unlocked</span>}
          </div>
        </div>

        {errorMsg && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-xl mb-6 flex items-start gap-3 animate-fade-in-up">
            <AlertTriangle size={20} className="mt-0.5 flex-shrink-0" />
            <p className="font-medium text-sm leading-relaxed">{errorMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 relative z-10">
          <div className="bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl flex flex-col">
            <div className="flex p-1 bg-slate-800/50 rounded-lg mb-6 border border-slate-700">
              <button onClick={() => { setInputMode('role'); setIsCompanyDropdownOpen(false); setIsRoleDropdownOpen(false); }} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${inputMode === 'role' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}><Search size={16} /> General Industry Role</button>
              <button onClick={() => setInputMode('company')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${inputMode === 'company' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}><Building2 size={16} /> Partner Company</button>
            </div>

            <div className="flex-1 flex flex-col justify-center">
              {inputMode === 'role' ? (
                <div className="animate-fade-in-up">
                  <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2"><Briefcase className="text-indigo-400" size={20} /> Target Job Role</h3>
                  <input type="text" value={customJobRole} onChange={(e) => setCustomJobRole(e.target.value)} placeholder="e.g. Junior Web Developer, Senior ML Engineer" className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-lg text-white font-medium shadow-inner" />
                </div>
              ) : (
                <div className="animate-fade-in-up">
                  <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2"><Building2 className="text-indigo-400" size={20} /> Select Partner</h3>
                  <div className="relative mb-4">
                    <button type="button" onClick={() => { setIsCompanyDropdownOpen(!isCompanyDropdownOpen); setIsRoleDropdownOpen(false); }} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex justify-between items-center text-white font-medium hover:border-indigo-500/50 transition-colors shadow-inner"><span className={selectedCompany ? 'text-white' : 'text-slate-400'}>{selectedCompany || "Select a Company..."}</span><ChevronDown size={20} className={`text-slate-400 transition-transform duration-200 ${isCompanyDropdownOpen ? 'rotate-180' : ''}`} /></button>
                    {isCompanyDropdownOpen && (
                      <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in-up">{partnerCompanies.map((c, i) => (<div key={i} onClick={() => { setSelectedCompany(c.name); setSelectedCompanyRole(''); setIsCompanyDropdownOpen(false); }} className="px-4 py-4 cursor-pointer text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors border-b border-slate-700/50 last:border-0">{c.name}</div>))}</div>
                    )}
                  </div>
                  {selectedCompany && (
                    <div className="relative animate-fade-in-up">
                      <button type="button" onClick={() => { setIsRoleDropdownOpen(!isRoleDropdownOpen); setIsCompanyDropdownOpen(false); }} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex justify-between items-center text-white font-medium hover:border-indigo-500/50 transition-colors shadow-inner"><span className={selectedCompanyRole ? 'text-white' : 'text-slate-400'}>{selectedCompanyRole || "Select Open Role..."}</span><ChevronDown size={20} className={`text-slate-400 transition-transform duration-200 ${isRoleDropdownOpen ? 'rotate-180' : ''}`} /></button>
                      {isRoleDropdownOpen && (
                        <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in-up">{partnerCompanies.find(c => c.name === selectedCompany)?.roles.map((r, i) => (<div key={i} onClick={() => { setSelectedCompanyRole(r); setIsRoleDropdownOpen(false); }} className="px-4 py-4 cursor-pointer text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors border-b border-slate-700/50 last:border-0">{r}</div>))}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#1e293b]/40 border border-slate-800 p-6 rounded-2xl flex flex-col relative z-0">
             <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><FileUp className="text-emerald-400" size={20} /> Upload Resume (PDF)</h3>
            <label className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer min-h-[160px] ${resumeFile ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-emerald-500/30'}`}>
              <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
              {resumeFile ? (
                <div className="text-center animate-fade-in-up"><FileText className="text-emerald-400 w-8 h-8 mx-auto mb-2" /><p className="text-emerald-300 font-medium px-4">{resumeFile.name}</p><p className="text-xs text-emerald-500/70 mt-2">Ready to scan</p></div>
              ) : (
                <div className="text-center"><FileUp className="text-slate-400 w-8 h-8 mx-auto mb-2" /><p className="text-white font-medium">Click to browse</p></div>
              )}
            </label>
          </div>
        </div>

        <div className="flex justify-center mb-12 relative z-0">
          <button onClick={handleAnalyze} disabled={analyzing || cooldown > 0} className={`px-10 py-4 rounded-xl font-bold text-lg transition-all flex items-center gap-3 shadow-lg ${cooldown > 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : analyzing ? 'bg-indigo-600/50 text-white/70 cursor-wait' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25 transform hover:-translate-y-1'}`}>
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
              <button onClick={handleExportPDF} disabled={exporting} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm font-medium text-white transition-colors shadow-sm">{exporting ? <Activity size={16} className="animate-spin" /> : <Download size={16} className="text-emerald-400" />}{exporting ? 'Generating PDF...' : 'Download Report'}</button>
            </div>

            <div ref={reportRef} className="space-y-6 p-6 -m-6 bg-[#0f172a] rounded-2xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#1e293b]/60 border border-slate-700 rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-4"><h3 className="text-md font-bold text-white flex items-center gap-2"><LayoutTemplate className="text-blue-400" size={18} /> ATS Readability</h3><span className={`text-2xl font-bold ${getScoreText(aiResult.atsFormatScore)}`}>{aiResult.atsFormatScore}%</span></div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 mb-4"><div className={`h-2.5 rounded-full ${getScoreColor(aiResult.atsFormatScore)} transition-all duration-1000`} style={{ width: `${aiResult.atsFormatScore}%` }}></div></div>
                  <p className="text-xs text-slate-300 bg-slate-800/50 p-3 rounded-lg border border-slate-700 leading-relaxed">{aiResult.formatMessage}</p>
                </div>

                <div className="bg-[#1e293b]/60 border border-slate-700 rounded-2xl p-6">
                   <div className="flex justify-between items-center mb-4"><h3 className="text-md font-bold text-white flex items-center gap-2"><Briefcase className="text-indigo-400" size={18} /> Technical Match</h3><span className={`text-2xl font-bold ${getScoreText(aiResult.roleMatchScore)}`}>{aiResult.roleMatchScore}%</span></div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 mb-4"><div className={`h-2.5 rounded-full ${getScoreColor(aiResult.roleMatchScore)} transition-all duration-1000`} style={{ width: `${aiResult.roleMatchScore}%` }}></div></div>
                  <div className="flex flex-col gap-1 mt-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700"><span className="text-xs text-slate-400">System Verdict:</span><span className={`text-sm font-bold tracking-wide ${aiResult.roleMatchScore >= 60 ? 'text-emerald-400' : 'text-rose-400'}`}>{aiResult.verdict}</span></div>
                </div>

                <div className="bg-[#1e293b]/60 border border-slate-700 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-purple-500/20 to-transparent rounded-bl-full"></div>
                  <div className="flex justify-between items-center mb-4 relative z-10"><h3 className="text-md font-bold text-white flex items-center gap-2"><TrendingUp className="text-purple-400" size={18} /> Market Probability</h3><span className={`text-2xl font-bold ${getScoreText(aiResult.marketProbability)}`}>{aiResult.marketProbability}%</span></div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 mb-4 relative z-10"><div className={`h-2.5 rounded-full ${getScoreColor(aiResult.marketProbability)} transition-all duration-1000`} style={{ width: `${aiResult.marketProbability}%` }}></div></div>
                  <div className="flex items-start gap-2 mt-3 bg-purple-500/10 p-3 rounded-lg border border-purple-500/20 relative z-10"><Info size={14} className="text-purple-400 mt-0.5 flex-shrink-0" /><span className="text-xs text-purple-200 leading-tight">Your actual chance of securing an interview based on the skills you <strong>do</strong> possess.</span></div>
                </div>
              </div>

              <div className="bg-[#1e293b]/40 border border-slate-800 rounded-2xl p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  
                  <div className="space-y-8">
                    <div>
                      <h4 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2"><CheckCircle size={18} /> Validated Core Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {aiResult.foundSkills && aiResult.foundSkills.length > 0 ? aiResult.foundSkills.map((skill, i) => (
                          <span key={i} className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full text-sm font-medium text-emerald-400 shadow-sm">{skill}</span>
                        )) : <span className="text-slate-500 text-sm">No exact core skills matched.</span>}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-rose-400 mb-4 flex items-center gap-2"><AlertTriangle size={18} /> Critical Skill Gaps</h4>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {aiResult.missingKeywords && aiResult.missingKeywords.length > 0 ? aiResult.missingKeywords.map((skill, i) => (
                          <span key={i} className="bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-full text-sm font-medium text-rose-400 shadow-sm">{skill}</span>
                        )) : <span className="text-emerald-400 text-sm">All major keywords detected!</span>}
                      </div>
                      {aiResult.missingKeywords && aiResult.missingKeywords.length > 0 && (
                        <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl mt-2">
                          <p className="text-xs text-rose-200"><strong>Note:</strong> These are mandatory baseline requirements for this role that you are currently missing.</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2"><Rocket size={18} /> Recommended Upskilling</h4>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {aiResult.recommendedSkills && aiResult.recommendedSkills.length > 0 ? aiResult.recommendedSkills.map((skill, i) => (
                          <span key={i} className="bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-full text-sm font-medium text-blue-400 shadow-sm">{skill}</span>
                        )) : <span className="text-slate-500 text-sm">No new recommendations available.</span>}
                      </div>
                      <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl mt-2 animate-fade-in-up">
                        <p className="text-sm text-indigo-200 flex items-start gap-2 leading-relaxed"><Sparkles size={16} className="text-indigo-400 mt-0.5 flex-shrink-0" /><span><strong>Career Growth:</strong> Mastering these trending technologies will significantly elevate your market value and set you apart from other candidates in this role.</span></p>
                      </div>
                    </div>

                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><TrendingUp className="text-indigo-400" size={18} /> Actionable Feedback & Roadmap</h4>
                    <ul className="space-y-4">
                      {aiResult.microActions && aiResult.microActions.map((action, i) => (
                        <li key={i} className="bg-slate-800/50 p-5 rounded-lg border border-slate-700 text-sm text-slate-300 flex items-start gap-4 hover:border-indigo-500/50 transition-colors">
                          <span className="font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-md mt-0.5">{i + 1}</span> 
                          <span className="leading-relaxed text-[15px]">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* --- COVER LETTER MODAL --- */}
        {showLetterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up">
            <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                   {isPremium ? <Sparkles className="text-indigo-400" /> : <Lock className="text-rose-400" />} 
                   {isPremium ? 'AI Cover Letter Draft' : 'Premium Locked'}
                </h3>
                <button onClick={() => setShowLetterModal(false)} className="text-slate-400 hover:text-rose-400 transition-colors"><X size={24} /></button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                {isGeneratingLetter ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4"><Activity className="text-indigo-500 animate-spin w-10 h-10" /><p className="text-slate-400 animate-pulse">Drafting your perfect response...</p></div>
                ) : (
                  <div className={`space-y-4 text-slate-300 leading-relaxed whitespace-pre-wrap ${isPremium ? 'font-serif text-lg bg-[#0f172a] p-6 rounded-xl border border-slate-800 font-mono' : 'text-center py-10'}`}>
                    {coverLetter}
                  </div>
                )}
              </div>
              {!isGeneratingLetter && isPremium && (
                <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/50 flex justify-end">
                  <button onClick={copyToClipboard} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>{copied ? <CheckCircle size={18} /> : <Copy size={18} />}{copied ? 'Copied to Clipboard!' : 'Copy Letter'}</button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}