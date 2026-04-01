import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Activity, Zap, Briefcase, Search, 
  Globe, ShieldCheck, Sparkles, Building2, ChevronRight, Lock, 
  Network, User, CheckCircle, Target, Mail, ArrowUpRight, Github, Linkedin, Twitter, LogIn
} from 'lucide-react';

// --- CUSTOM SVG LOGO COMPONENT ---
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

export default function LandingPage() {
  const [persona, setPersona] = useState('student');
  const [activeSection, setActiveSection] = useState('portals');
  
  // Refs for high-performance animation tracking
  const gridRef = useRef(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const timeOffset = useRef({ x: 0, y: 0 });

  // --- SCROLLSPY LOGIC FOR NAVBAR HIGHLIGHTING ---
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['portals', 'features', 'about'];
      const scrollPosition = window.scrollY + window.innerHeight / 3; 

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element && element.offsetTop <= scrollPosition && (element.offsetTop + element.offsetHeight) > scrollPosition) {
          setActiveSection(section);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  const heroContent = {
    student: {
      id: 'student',
      headline: <>Automated ATS <br className="hidden md:block" />Rejection Simulator.</>,
      subhead: "Upload your resume and let our Llama 3.1 engine ruthlessly penalize missing keywords, identify your exact skill gaps, and generate a customized upskilling roadmap.",
      gradient: "from-indigo-400 via-purple-400 to-pink-400",
      glow: "from-indigo-600/20 to-purple-600/10",
      btnText: "Run Free Scan",
      btnIcon: <Zap size={18} className="fill-white" />,
      btnClass: "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-[0_0_30px_rgba(99,102,241,0.4)] border border-indigo-400/20",
      link: "/login",
      state: { intendedPath: '/student' }
    },
    university: {
      id: 'university',
      headline: <>Real-Time Cohort <br className="hidden md:block" />Intelligence Dashboard.</>,
      subhead: "Securely provision student accounts and gain deep, real-time analytics on curriculum skill gaps, at-risk students, and overall placement probability.",
      gradient: "from-amber-300 via-orange-400 to-rose-400",  // Swapped to Amber
      glow: "from-amber-500/20 to-orange-600/10",
      btnText: "Apply for Enterprise",
      btnIcon: <Building2 size={18} />,
      btnClass: "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-[0_0_30px_rgba(245,158,11,0.4)] border border-amber-400/20",
      link: "/apply",
      state: null
    },
    employer: {
      id: 'employer',
      headline: <>Pre-Vetted Technical <br className="hidden md:block" />Talent Pipeline.</>,
      subhead: "Bypass the resume spam. Access a curated dashboard of verified candidates whose technical skills have already been validated against your exact open roles.",
      gradient: "from-emerald-300 via-teal-400 to-cyan-400", // Swapped to Emerald
      glow: "from-emerald-600/20 to-teal-600/10",
      btnText: "Enter Talent Hub",
      btnIcon: <Network size={18} />,
      btnClass: "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-[0_0_30px_rgba(16,185,129,0.4)] border border-emerald-400/20",
      link: "/login",
      state: { intendedPath: '/employer' }
    }
  };

  const activeContent = heroContent[persona];

  // Updated logic to match the new Student -> University -> Employer order
  const getSliderTranslate = () => {
    if (persona === 'student') return 'translate-x-0';
    if (persona === 'university') return 'translate-x-[100%]';
    if (persona === 'employer') return 'translate-x-[200%]';
  };

  const getSliderColor = () => {
    if (persona === 'student') return 'bg-indigo-500/20 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.3)]';
    if (persona === 'university') return 'bg-amber-500/20 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)]';
    if (persona === 'employer') return 'bg-emerald-500/20 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
  };

  return (
    <div className="min-h-screen bg-[#04060d] text-slate-200 font-sans selection:bg-indigo-500/30 overflow-x-hidden flex flex-col relative">
      <style>
        {`
          html { scroll-behavior: smooth; }
          @keyframes splashFade {
            0%, 60% { opacity: 1; z-index: 100; }
            100% { opacity: 0; z-index: -1; visibility: hidden; }
          }
          @keyframes starEntrance {
            0% { transform: scale(0) rotate(-135deg); opacity: 0; }
            20% { transform: scale(3.5) rotate(0deg); opacity: 1; }
            60% { transform: scale(3.5) rotate(0deg); opacity: 1; }
            100% { transform: translate(-40vw, -45vh) scale(0.5); opacity: 0; }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); filter: blur(4px); }
            to { opacity: 1; transform: translateY(0); filter: blur(0); }
          }
          @keyframes tabSwitch {
            from { opacity: 0; transform: translateY(10px); filter: blur(2px); }
            to { opacity: 1; transform: translateY(0); filter: blur(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .animate-splash { animation: splashFade 1.6s cubic-bezier(0.65, 0, 0.35, 1) forwards; }
          .animate-star-entrance { animation: starEntrance 1.6s cubic-bezier(0.65, 0, 0.35, 1) forwards; }
          .animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
          .animate-tab-switch { animation: tabSwitch 0.4s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
          .animate-fade-in { animation: fadeIn 1s ease-out forwards; opacity: 0; }
          .delay-nav { animation-delay: 1400ms; }
          .delay-100 { animation-delay: 1500ms; }
          
          /* UPGRADED DUAL-LAYERED GRID */
          .bg-grid-pattern {
            background-image: 
              linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px),
              linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
            background-size: 100px 100px, 100px 100px, 20px 20px, 20px 20px;
            transition: background-position 0.1s ease-out;
          }
        `}
      </style>

      {/* --- CINEMATIC SPLASH SCREEN --- */}
      <div className="fixed inset-0 bg-[#04060d] flex items-center justify-center animate-splash pointer-events-none z-[100]">
        <SkillNovaLogo className="w-24 h-24 animate-star-entrance" />
      </div>

      {/* --- EQUI-SPACED, PERFECTLY CENTERED NAVBAR --- */}
      <div className="fixed top-4 md:top-6 w-full z-50 px-4 md:px-8 flex justify-center animate-fade-in delay-nav transition-all pointer-events-none">
        <nav className="w-full max-w-4xl bg-[#0a0f1c]/80 backdrop-blur-2xl border border-white/10 rounded-full px-6 py-3 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.5)] pointer-events-auto transition-all hover:bg-[#0a0f1c]/95">
          
          {/* 1. Left - Logo */}
          <div className="flex items-center gap-3 w-1/4">
            <SkillNovaLogo className="w-8 h-8 drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]" />
            <span className="text-xl font-black text-white tracking-tight hidden sm:block">SkillNova</span>
          </div>
          
          {/* 2. Center - Navigation Links */}
          <div className="flex-1 flex justify-center items-center">
            <div className="flex items-center gap-6 md:gap-10">
              {[
                { id: 'portals', label: 'Portals' },
                { id: 'features', label: 'Features' },
                { id: 'about', label: 'About' }
              ].map(item => (
                <a 
                  key={item.id}
                  href={`#${item.id}`}
                  className={`text-[13px] md:text-sm font-bold transition-all px-4 py-2 rounded-full flex items-center
                    ${activeSection === item.id 
                      ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          {/* 3. Right - Action Icon */}
          <div className="flex justify-end w-1/4">
            <Link 
              to="/login" 
              className="group flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all shadow-sm"
              title="Sign In / Access Portals"
            >
              <LogIn size={18} className="text-slate-300 group-hover:text-white transition-colors" />
            </Link>
          </div>

        </nav>
      </div>

      {/* --- DYNAMIC HERO SECTION (PORTALS) --- */}
      <section id="portals" className="relative pt-48 pb-20 px-6 flex-grow flex flex-col items-center justify-center min-h-[90vh]">
        {/* GRID REF ATTACHED HERE */}
        <div ref={gridRef} className="absolute inset-0 bg-grid-pattern [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)] pointer-events-none"></div>
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b ${activeContent.glow} blur-[150px] rounded-full pointer-events-none transition-colors duration-1000`}></div>
        
        <div className="max-w-5xl mx-auto text-center relative z-10 w-full animate-fade-in-up delay-100">

          {/* REORDERED TABS */}
          <div className="relative flex items-center p-1.5 bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-full mb-12 mx-auto w-full max-w-[360px] md:max-w-[500px] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(33.333%-4px)] rounded-full border transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${getSliderTranslate()} ${getSliderColor()}`}></div>
            
            {/* Student Tab */}
            <button onClick={() => setPersona('student')} className={`relative z-10 flex-1 py-2.5 rounded-full text-sm font-bold transition-colors duration-300 flex items-center justify-center gap-2 ${persona === 'student' ? 'text-white drop-shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
              <User size={16} className={persona === 'student' ? 'text-indigo-300' : ''} /> <span className="hidden sm:inline">Students</span><span className="sm:hidden">Student</span>
            </button>

            {/* University Tab (Now in the middle) */}
            <button onClick={() => setPersona('university')} className={`relative z-10 flex-1 py-2.5 rounded-full text-sm font-bold transition-colors duration-300 flex items-center justify-center gap-2 ${persona === 'university' ? 'text-white drop-shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
              <Building2 size={16} className={persona === 'university' ? 'text-amber-300' : ''} /> <span className="hidden sm:inline">Universities</span><span className="sm:hidden">Uni</span>
            </button>

            {/* Employer Tab (Now on the right) */}
            <button onClick={() => setPersona('employer')} className={`relative z-10 flex-1 py-2.5 rounded-full text-sm font-bold transition-colors duration-300 flex items-center justify-center gap-2 ${persona === 'employer' ? 'text-white drop-shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
              <Briefcase size={16} className={persona === 'employer' ? 'text-emerald-300' : ''} /> <span className="hidden sm:inline">Employers</span><span className="sm:hidden">Employer</span>
            </button>
            
          </div>
          
          <div key={persona} className="animate-tab-switch min-h-[220px]">
            <h1 className="text-6xl md:text-[5rem] font-black text-white tracking-tighter leading-[1.05] mb-6 drop-shadow-[0_2px_20px_rgba(255,255,255,0.1)]">
              {activeContent.headline.props.children[0]} <br className="hidden md:block" />
              <span className={`text-transparent bg-clip-text bg-gradient-to-br ${activeContent.gradient} drop-shadow-sm`}>
                {activeContent.headline.props.children[2]}
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">{activeContent.subhead}</p>
            <div className="flex justify-center">
              <Link to={activeContent.link} state={activeContent.state} className={`px-8 py-4 text-white rounded-2xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2 hover:scale-105 ${activeContent.btnClass}`}>
                {activeContent.btnText} {activeContent.btnIcon}
              </Link>
            </div>
          </div>

          <div className="mt-28 flex justify-center opacity-90 animate-fade-in-up delay-400">
            <div className="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-24">
              <div className="text-center group flex flex-col items-center">
                <div className="flex items-center gap-2 mb-1"><Activity size={24} className="text-indigo-400 group-hover:scale-110 transition-transform"/><h4 className="text-3xl md:text-4xl font-black text-white">&lt; 1s</h4></div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-2">Inference Speed</p>
              </div>
              <div className="hidden md:block w-px h-12 bg-gradient-to-b from-transparent via-slate-700 to-transparent"></div>
              <div className="md:hidden w-16 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
              <div className="text-center group flex flex-col items-center">
                <div className="flex items-center gap-2 mb-1"><Target size={24} className="text-purple-400 group-hover:scale-110 transition-transform"/><h4 className="text-3xl md:text-4xl font-black text-white">99%</h4></div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-2">Skill Extraction Acc.</p>
              </div>
              <div className="hidden md:block w-px h-12 bg-gradient-to-b from-transparent via-slate-700 to-transparent"></div>
              <div className="md:hidden w-16 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
              <div className="text-center group flex flex-col items-center">
                <div className="flex items-center gap-2 mb-1"><ShieldCheck size={24} className="text-emerald-400 group-hover:scale-110 transition-transform"/><h4 className="text-3xl md:text-4xl font-black text-white">Local</h4></div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-2">PDF Parsing Engine</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* --- FEATURES GRID --- */}
      <section id="features" className="relative z-10 py-32 px-6 bg-[#04060d]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6">A Complete Talent Ecosystem.</h2>
            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-medium">Everything you need to analyze skills, match with exact roles, and connect top talent with enterprise teams.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-8 bg-gradient-to-br from-[#0f172a] to-[#04060d] border border-white/[0.08] p-8 md:p-12 rounded-3xl hover:border-indigo-500/50 hover:shadow-[0_0_40px_rgba(99,102,241,0.1)] transition-all duration-500 relative overflow-hidden group">
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] group-hover:bg-indigo-500/20 transition-all duration-700 pointer-events-none"></div>
              <div className="hidden sm:flex absolute top-8 right-8 items-center gap-2 px-3 py-1.5 bg-[#0a0f1c]/80 backdrop-blur-md border border-white/10 rounded-lg shadow-xl transform group-hover:-translate-y-1 transition-transform duration-500"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span className="text-xs font-bold text-slate-300">ATS Score: 94%</span></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mb-8 shadow-inner"><Activity className="text-indigo-400" size={32} /></div>
                <h3 className="text-3xl font-bold text-white mb-4 tracking-tight">Ruthless Llama 3.1 Simulator</h3>
                <p className="text-slate-400 leading-relaxed text-lg max-w-lg mb-8">We don't sugarcoat it. Upload your PDF and let our ultra-fast Groq engine brutally penalize missing keywords, calculate your Market Probability, and map out your exact technical gaps.</p>
                <div className="flex gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold bg-[#1e293b] border border-slate-700 text-slate-300 px-4 py-2 rounded-full shadow-sm"><CheckCircle size={14} className="text-indigo-400"/> Format Scoring</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold bg-[#1e293b] border border-slate-700 text-slate-300 px-4 py-2 rounded-full shadow-sm"><Sparkles size={14} className="text-indigo-400"/> Cover Letter Gen</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-4 bg-gradient-to-bl from-[#0f172a] to-[#04060d] border border-white/[0.08] p-8 md:p-10 rounded-3xl hover:border-purple-500/50 hover:shadow-[0_0_40px_rgba(168,85,247,0.1)] transition-all duration-500 relative overflow-hidden group flex flex-col justify-between">
              <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/10 rounded-full blur-[80px] group-hover:bg-purple-500/20 transition-all duration-700 pointer-events-none"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center mb-6 shadow-inner"><Search className="text-purple-400" size={28} /></div>
                <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">Exact JD Matcher</h3>
                <p className="text-slate-400 leading-relaxed text-base">Paste any job description from LinkedIn or Indeed. The AI extracts core requirements and scores your resume specifically against that exact role.</p>
              </div>
              <div className="relative z-10 mt-8 flex items-center gap-2 text-xs font-medium text-slate-500 bg-[#0a0f1c] w-fit px-3 py-1.5 rounded-lg border border-slate-800"><span className="text-purple-400 font-bold">10/10</span> Keywords Matched</div>
            </div>

             <div className="md:col-span-5 bg-gradient-to-tr from-[#0f172a] to-[#04060d] border border-white/[0.08] p-8 md:p-10 rounded-3xl hover:border-emerald-500/50 hover:shadow-[0_0_40px_rgba(16,185,129,0.1)] transition-all duration-500 relative overflow-hidden group">
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] group-hover:bg-emerald-500/20 transition-all duration-700 pointer-events-none"></div>
               <div className="absolute top-8 right-8 flex -space-x-3 opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                 <div className="w-10 h-10 rounded-full border-2 border-[#04060d] bg-indigo-500 flex items-center justify-center shadow-lg"><User size={16} className="text-white"/></div>
                 <div className="w-10 h-10 rounded-full border-2 border-[#04060d] bg-emerald-500 flex items-center justify-center shadow-lg"><User size={16} className="text-white"/></div>
                 <div className="w-10 h-10 rounded-full border-2 border-[#04060d] bg-purple-500 flex items-center justify-center shadow-lg"><User size={16} className="text-white"/></div>
               </div>
               <div className="relative z-10">
                <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-6 shadow-inner"><Network className="text-emerald-400" size={28} /></div>
                <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">Talent Discovery Hub</h3>
                <p className="text-slate-400 leading-relaxed text-base mb-8 pr-12">Verified high-match candidates who opt-in are pushed directly to the dashboard of enterprise hiring partners looking for exact skills.</p>
                <Link to="/login" state={{ intendedPath: '/employer' }} className="text-sm font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors w-fit group-hover:translate-x-1 duration-300">Explore Employer Portal <ChevronRight size={16}/></Link>
              </div>
            </div>

            <div className="md:col-span-7 bg-gradient-to-tl from-[#0f172a] to-[#04060d] border border-white/[0.08] p-8 md:p-12 rounded-3xl hover:border-amber-500/50 hover:shadow-[0_0_40px_rgba(245,158,11,0.1)] transition-all duration-500 relative overflow-hidden group">
              <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] group-hover:bg-amber-500/20 transition-all duration-700 pointer-events-none"></div>
              <div className="hidden sm:flex absolute top-10 right-10 items-end gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity duration-500">
                 <div className="w-3 h-6 bg-amber-500/20 rounded-t-sm"></div><div className="w-3 h-10 bg-amber-500/40 rounded-t-sm"></div><div className="w-3 h-14 bg-amber-500/60 rounded-t-sm"></div><div className="w-3 h-20 bg-amber-500/80 rounded-t-sm group-hover:bg-amber-400 transition-colors"></div>
              </div>
              <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-widest mb-6 shadow-sm"><Building2 size={12} /> University Partners</div>
                <h3 className="text-3xl font-bold text-white mb-4 tracking-tight">Cohort Intelligence Dashboard</h3>
                <p className="text-slate-400 leading-relaxed text-lg max-w-lg mb-8">Universities can securely provision student accounts via CSV bulk-upload. Admins receive real-time analytics on curriculum skill gaps, at-risk students, and overall placement probability.</p>
                <Link to="/apply" className="px-6 py-3 bg-[#0a0f1c] hover:bg-slate-900 border border-slate-800 text-white rounded-xl font-bold text-sm transition-all inline-flex items-center gap-2 shadow-lg group-hover:-translate-y-1 duration-300">Partner with SkillNova</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- PROFESSIONAL PRE-FOOTER CTA & FOOTER --- */}
      <footer id="about" className="relative z-10 bg-[#020308] pt-24 pb-10 mt-auto border-t border-white/5 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[300px] bg-gradient-to-b from-indigo-500/5 to-transparent blur-[100px] rounded-full pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          
          <div className="mb-24 flex flex-col md:flex-row items-center justify-between gap-10 bg-gradient-to-r from-slate-900 to-[#0a0f1c] border border-white/10 p-10 md:p-14 rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAzNHYtNGgtdjRoLTh2NGgtdjRoLTh2NGgtdjRoLTh2NGgtdjRoOHY0aDR2NGg4djRoNHY0aDh2NGg0di00aDR2LTRoNHYtNGg0di00aDR2LTRoNHYtNGgtNHYtNGgtNHYtNGgtNHYtNGgtOHptLTggMTR2LTRoLTh2NGg4em0tMTYtOHYtNGgtOHY0aDh6IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDMiLz48L2c+PC9zdmc+')] opacity-50"></div>
            <div className="relative z-10 text-center md:text-left">
              <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">Ready to bridge the gap?</h2>
              <p className="text-slate-400 text-lg max-w-xl">Join thousands of students, enterprise teams, and top universities utilizing the next generation of technical hiring.</p>
            </div>
            <div className="relative z-10 flex-shrink-0">
               <Link to="/login" className="px-10 py-5 bg-white text-[#04060d] hover:bg-slate-200 rounded-full font-black text-lg transition-transform hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.15)] flex items-center gap-2">Get Started Now <ArrowUpRight size={20} /></Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-8 mb-16">
            <div className="md:col-span-4 lg:col-span-5">
              <div className="flex items-center gap-3 mb-6">
                <SkillNovaLogo className="w-8 h-8 opacity-90 drop-shadow-md" />
                <span className="text-2xl font-black text-white tracking-tight">SkillNova</span>
              </div>
              <p className="text-slate-400 text-base leading-relaxed mb-8 max-w-sm">
                The enterprise-grade skill gap analyzer. Securely built on Firebase, powered by the incredible speed of Groq & Llama 3.1.
              </p>
              <div className="flex items-center gap-2 max-w-sm">
                <div className="relative flex-grow">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input type="email" placeholder="Subscribe to updates" className="w-full bg-[#0a0f1c] border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors">Join</button>
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-2">
              <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-wider">Product</h4>
              <ul className="space-y-4 text-sm text-slate-400 font-medium">
                <li><a href="#features" className="hover:text-indigo-400 transition-colors flex items-center gap-2">ATS Simulator</a></li>
                <li><a href="#features" className="hover:text-indigo-400 transition-colors flex items-center gap-2">JD Matcher</a></li>
                <li><a href="#features" className="hover:text-indigo-400 transition-colors flex items-center gap-2">Employer Hub</a></li>
              </ul>
            </div>

            <div className="md:col-span-3 lg:col-span-2">
              <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-wider">Portals</h4>
              <ul className="space-y-4 text-sm text-slate-400 font-medium">
                <li><Link to="/login" state={{ intendedPath: '/student' }} className="hover:text-indigo-400 transition-colors">Student Login</Link></li>
                <li><Link to="/login" state={{ intendedPath: '/employer' }} className="hover:text-indigo-400 transition-colors">Employer Login</Link></li>
                <li><Link to="/login" state={{ intendedPath: '/partner' }} className="hover:text-indigo-400 transition-colors">University Admin</Link></li>
              </ul>
            </div>

            <div className="md:col-span-3 lg:col-span-3">
              <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-wider">Company</h4>
              <ul className="space-y-4 text-sm text-slate-400 font-medium">
                <li><Link to="/apply" className="hover:text-indigo-400 transition-colors">Partner With Us</Link></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Terms of Service</a></li>
              </ul>
              <div className="flex gap-4 mt-8">
                <a href="#" className="w-10 h-10 rounded-full bg-[#0a0f1c] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-indigo-500 transition-all"><Twitter size={18} /></a>
                <a href="#" className="w-10 h-10 rounded-full bg-[#0a0f1c] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-indigo-500 transition-all"><Linkedin size={18} /></a>
                <a href="#" className="w-10 h-10 rounded-full bg-[#0a0f1c] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-indigo-500 transition-all"><Github size={18} /></a>
              </div>
            </div>
            
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500 font-medium">
            <p>© 2026 SkillNova AI. All rights reserved. Designed for scale.</p>
            <div className="flex items-center gap-4">
              <p className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-emerald-400"/> Secured by <span className="text-white">Firebase</span></p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}