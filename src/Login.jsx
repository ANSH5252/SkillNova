import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Mail, Lock, ArrowRight, ShieldCheck, Clock, XCircle, 
  Activity, Building2, Eye, EyeOff, Briefcase, User, 
  ArrowLeft, Target, Gem, Network
} from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const intendedPath = location.state?.intendedPath || '';

  // --- UI STATES ---
  const [activeTab, setActiveTab] = useState(() => {
    if (intendedPath === '/employer') return 'employer';
    if (intendedPath === '/admin' || intendedPath === '/partner') return 'partner';
    return 'student';
  });
  
  const [isStudentSignUp, setIsStudentSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [partnerStatus, setPartnerStatus] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // --- PARALLAX GRID LOGIC ---
  const gridRef = useRef(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const timeOffset = useRef({ x: 0, y: 0 });

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

  // --- CORE ROUTING ENGINE ---
  const checkAdminAndRoute = async (userEmail) => {
    try {
      const adminDocRef = doc(db, "admins", userEmail.toLowerCase());
      const adminDocSnap = await getDoc(adminDocRef);
      
      if (adminDocSnap.exists()) {
        const adminData = adminDocSnap.data();
        
        if (adminData.role === 'superadmin') {
          navigate('/admin'); 
        } else if (adminData.role === 'employer') {
          navigate('/employer'); 
        } else {
          navigate('/partner'); 
        }
      } else {
        navigate('/student'); 
      }
    } catch (err) {
      console.error("Routing Error:", err);
      navigate('/student'); 
    }
  };

  // --- AUTH HANDLERS ---
  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await checkAdminAndRoute(result.user.email);
    } catch (err) {
      setErrorMsg(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      let userCredential;
      if (isStudentSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }
      await checkAdminAndRoute(userCredential.user.email);
    } catch (err) {
      setErrorMsg(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerCombinedSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    let proceedToAuth = true;

    try {
      const adminDoc = await getDoc(doc(db, 'admins', email.toLowerCase()));
      if (!adminDoc.exists()) {
        const q = query(collection(db, 'partner_applications'), where('email', '==', email.toLowerCase()));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const appStatus = snap.docs[0].data().status;
          if (appStatus === 'pending') {
             setPartnerStatus('pending');
             proceedToAuth = false;
          }
          else if (appStatus === 'rejected') {
             setPartnerStatus('rejected');
             proceedToAuth = false;
          }
        }
      }
    } catch (err) {
      console.error("Error checking application status:", err);
      // Ignore Firestore permission errors before login, fallback to login attempt.
      proceedToAuth = true;
    }

    if (proceedToAuth) {
       try {
         const userCredential = await signInWithEmailAndPassword(auth, email, password);
         await checkAdminAndRoute(userCredential.user.email);
       } catch (err) {
         if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
             try {
               const newUser = await createUserWithEmailAndPassword(auth, email, password);
               await checkAdminAndRoute(newUser.user.email);
             } catch (createError) {
               setErrorMsg(createError.code === 'auth/email-already-in-use' ? "Incorrect password." : "Access Denied.");
             }
         } else {
             setErrorMsg("Invalid credentials. Accounts must be pre-approved.");
         }
       }
    }
    
    setLoading(false);
  };

  // --- DYNAMIC CONTENT BUILDERS ---
  const getPillarContent = () => {
    switch(activeTab) {
      case 'student': return {
        tagText: 'Open Access', tagIcon: <Activity size={14} className="text-indigo-400" />, themeColor: 'indigo',
        headline: <>Ace Your Next <br className="hidden lg:block"/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Application.</span></>,
        desc: "Upload your resume and let our local-first Llama engine calculate your true ATS odds against real Job Descriptions.",
        features: [
          { icon: <Target className="text-indigo-400" size={24}/>, title: "Local Simulator", desc: "Private API analysis guarantees 100% data retention." },
          { icon: <Activity className="text-indigo-400" size={24}/>, title: "Instant Feedback", desc: "Receive automated cover letters and skill-gap maps." }
        ]
      };
      case 'partner': return {
        tagText: 'University Network', tagIcon: <Gem size={14} className="text-amber-400" />, themeColor: 'amber',
        headline: <>Bridge The <br className="hidden lg:block"/><span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Curriculum Gap.</span></>,
        desc: "Manage 10,000+ student cohorts. Securely provision accounts and pinpoint at-risk patterns.",
        features: [
          { icon: <Building2 className="text-amber-400" size={24}/>, title: "Bulk Provisioning", desc: "Add students en-masse securely via our CSV integrations." },
          { icon: <ShieldCheck className="text-amber-400" size={24}/>, title: "Compliance First", desc: "Enterprise-grade sandboxes that protect student data." }
        ]
      };
      case 'employer': return {
        tagText: 'Talent Hub', tagIcon: <Network size={14} className="text-emerald-400" />, themeColor: 'emerald',
        headline: <>Find Verified <br className="hidden lg:block"/><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Technical Talent.</span></>,
        desc: "Access a curated pipeline of candidates whose exact technical skills match your JD requirements.",
        features: [
          { icon: <Briefcase className="text-emerald-400" size={24}/>, title: "Bypass Spam", desc: "View only pre-screened talent mathematically aligned to your roles." },
          { icon: <User className="text-emerald-400" size={24}/>, title: "Instant Contact", desc: "Connect with high-intent candidates in just one click." }
        ]
      };
      default: return null;
    }
  };

  const pillar = getPillarContent();

  const getSliderTranslate = () => {
    if (activeTab === 'student') return 'translate-x-0';
    if (activeTab === 'partner') return 'translate-x-[100%]';
    if (activeTab === 'employer') return 'translate-x-[200%]';
  };

  const getSliderColor = () => {
    if (activeTab === 'student') return 'bg-indigo-500/20 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.3)]';
    if (activeTab === 'partner') return 'bg-amber-500/20 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)]';
    if (activeTab === 'employer') return 'bg-emerald-500/20 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
  };

  const getGlowColor = () => {
    if (activeTab === 'student') return 'from-indigo-600/20 to-purple-600/10';
    if (activeTab === 'partner') return 'from-amber-500/20 to-orange-600/10';
    if (activeTab === 'employer') return 'from-emerald-600/20 to-teal-600/10';
  };

  // --- SHARED UI COMPONENT ---
  const GoogleButton = () => (
    <button 
      type="button" onClick={handleGoogleSignIn} disabled={loading}
      className="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] mt-4 hover:scale-[1.01] disabled:opacity-50"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.15H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.85l2.9-2.26z" fill="#FBBC05"/>
        <path d="M12 5.38c1.56 0 2.96.54 4.07 1.59l3.05-3.05C17.46 2.05 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.15l3.66 2.84c.87-2.6 3.3-4.61 6.16-4.61z" fill="#EA4335"/>
      </svg>
      Continue with Google
    </button>
  );

  const Divider = () => (
    <div className="flex items-center gap-4 my-5 text-slate-500 uppercase text-[10px] font-bold tracking-widest">
      <div className="flex-1 h-px bg-slate-700/50"></div>
      Or
      <div className="flex-1 h-px bg-slate-700/50"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#04060d] flex flex-col relative selection:bg-white/20 overflow-x-hidden font-sans">
      <style>
        {`
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

      {/* Dynamic Background Glows */}
      <div ref={gridRef} className="fixed inset-0 bg-grid-pattern [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)] pointer-events-none"></div>
      <div className={`fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b ${getGlowColor()} blur-[150px] rounded-full pointer-events-none transition-colors duration-1000`}></div>

      {/* Back to Home Header */}
      <div className="relative z-20 pt-8 px-8 lg:px-16 w-full max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <ArrowLeft size={16} /> Back to Home
        </Link>
      </div>

      <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 lg:py-20 relative z-10 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* THE VALUE PROPOSITION LEFT PILLAR */}
          <div className="lg:col-span-6 flex flex-col justify-center animate-fade-in pr-0 lg:pr-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-300 w-fit mb-8 shadow-sm">
              {pillar.tagIcon} {pillar.tagText}
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter leading-[1.1] mb-6 drop-shadow-[0_2px_20px_rgba(255,255,255,0.1)] transition-all">
              {pillar.headline}
            </h1>
            
            <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-lg transition-colors">
              {pillar.desc}
            </p>

            <div className="space-y-6 max-w-lg">
              {pillar.features.map((feature, idx) => (
                <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
                  <div className={`w-12 h-12 bg-${feature.color}-500/10 border border-${feature.color}-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                    {feature.icon}
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg mb-1">{feature.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* THE AUTHENTICATION RIGHT PILLAR */}
          <div className="lg:col-span-6 relative">
            
            {/* Dynamic Card Glow Layer */}
            <div className={`absolute -inset-1 blur-2xl opacity-50 rounded-[2rem] pointer-events-none transition-colors duration-1000 ${
              activeTab === 'student' ? 'bg-gradient-to-br from-indigo-500/30 to-purple-500/30' :
              activeTab === 'partner' ? 'bg-gradient-to-br from-amber-500/30 to-orange-500/30' :
              'bg-gradient-to-br from-emerald-500/30 to-teal-500/30'
            }`}></div>

            <div className="relative bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 p-8 md:p-10 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
              
              {/* PILL SWITCHER INSIDE HEADER */}
              <div className="relative flex items-center p-1.5 bg-black/40 border border-white/10 rounded-full mb-8 w-full shadow-inner overflow-hidden">
                <div className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(33.333%-4px)] rounded-full border transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${getSliderTranslate()} ${getSliderColor()}`}></div>
                
                <button type="button" onClick={() => { setActiveTab('student'); setErrorMsg(''); }} className={`relative z-10 flex-1 py-2 rounded-full text-xs font-bold transition-colors duration-300 flex items-center justify-center gap-1.5 ${activeTab === 'student' ? 'text-white drop-shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
                  <span className="truncate">Student</span>
                </button>

                <button type="button" onClick={() => { setActiveTab('partner'); setErrorMsg(''); }} className={`relative z-10 flex-1 py-2 rounded-full text-xs font-bold transition-colors duration-300 flex items-center justify-center gap-1.5 ${activeTab === 'partner' ? 'text-white drop-shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
                  <span className="truncate">University</span>
                </button>

                <button type="button" onClick={() => { setActiveTab('employer'); setErrorMsg(''); }} className={`relative z-10 flex-1 py-2 rounded-full text-xs font-bold transition-colors duration-300 flex items-center justify-center gap-1.5 ${activeTab === 'employer' ? 'text-white drop-shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
                  <span className="truncate">Employer</span>
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold mb-6 text-center shadow-inner">
                  {errorMsg}
                </div>
              )}

              {/* ENTERPRISE / EMPLOYER STATUS SCREENS */}
              {partnerStatus === 'pending' && (
                <div className="text-center animate-fade-in py-8">
                  <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4"><Clock className="text-amber-400 w-8 h-8" /></div>
                  <h3 className="text-xl font-bold text-white mb-2">Review in Progress</h3>
                  <p className="text-sm text-slate-400 mb-6 px-4">Your application for <strong className="text-slate-200">{email}</strong> is securely under review by administrators.</p>
                  <button onClick={() => {setPartnerStatus(null); setEmail(''); setPassword('');}} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-colors">Use a different account</button>
                </div>
              )}

              {partnerStatus === 'rejected' && (
                <div className="text-center animate-fade-in py-8">
                  <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4"><XCircle className="text-rose-400 w-8 h-8" /></div>
                  <h3 className="text-xl font-bold text-white mb-2">Access Declined</h3>
                  <p className="text-sm text-slate-400 mb-6 px-4">Your application for access could not be verified at this time.</p>
                  <button onClick={() => {setPartnerStatus(null); setEmail(''); setPassword('');}} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-colors">Return to Login</button>
                </div>
              )}

              {/* ENTERPRISE / EMPLOYER LOGIN FLOW */}
              {(activeTab === 'partner' || activeTab === 'employer') && partnerStatus === null && (
                <div className="animate-fade-in">
                  <form onSubmit={handlePartnerCombinedSubmit} className="space-y-5">
                    <div>
                      <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">
                        {activeTab === 'employer' ? 'Work Email Address' : 'Institutional Email'}
                      </label>
                      <div className="relative group">
                        <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors ${activeTab === 'employer' ? 'group-focus-within:text-emerald-400' : 'group-focus-within:text-amber-400'}`} size={18} />
                        <input 
                          type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
                          className={`w-full bg-slate-900/40 border border-slate-700/50 rounded-xl py-3.5 pl-11 pr-4 text-white outline-none transition-colors shadow-inner
                            ${activeTab === 'employer' ? 'focus:border-emerald-500/50 hover:bg-slate-900/60' : 'focus:border-amber-500/50 hover:bg-slate-900/60'}`}
                          placeholder={activeTab === 'employer' ? "hr@company.com" : "admin@university.edu"}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Password</label>
                      <div className="relative group">
                        <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors ${activeTab === 'employer' ? 'group-focus-within:text-emerald-400' : 'group-focus-within:text-amber-400'}`} size={18} />
                        <input 
                          type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                          className={`w-full bg-slate-900/40 border border-slate-700/50 rounded-xl py-3.5 pl-11 pr-11 text-white outline-none transition-colors shadow-inner
                            ${activeTab === 'employer' ? 'focus:border-emerald-500/50 hover:bg-slate-900/60' : 'focus:border-amber-500/50 hover:bg-slate-900/60'}`} 
                          placeholder="••••••••"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <button 
                      type="submit" disabled={loading || !email || !password} 
                      className={`w-full text-white font-black py-4 px-4 rounded-xl flex items-center justify-center mt-5 shadow-lg transition-all hover:scale-[1.01] disabled:opacity-50
                        ${activeTab === 'employer' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/25' : 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/25'}`}
                    >
                      {loading ? <Activity size={18} className="animate-spin" /> : <><ShieldCheck size={18} className="mr-2"/> Secure Login</>}
                    </button>
                    
                    <Divider />
                    <GoogleButton />

                    <div className="text-center mt-6 space-y-3 flex flex-col">
                      {activeTab === 'partner' && (
                         <Link to="/apply" className="text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors underline underline-offset-4">Join our network? Apply as a University</Link>
                      )}
                      {activeTab === 'employer' && (
                         <Link to="/apply" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors underline underline-offset-4">Looking to hire? Apply for an Employer Account</Link>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {/* STUDENT LOGIN FLOW */}
              {activeTab === 'student' && (
                <div className="animate-fade-in">
                  <form onSubmit={handleStudentSubmit} className="space-y-5">
                    <div>
                      <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Email Address</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                        <input 
                          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-slate-900/40 border border-slate-700/50 focus:border-indigo-500/50 rounded-xl py-3.5 pl-11 pr-4 text-white outline-none transition-colors hover:bg-slate-900/60 shadow-inner" 
                          placeholder="name@email.com"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Password</label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                        <input 
                          type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-slate-900/40 border border-slate-700/50 focus:border-indigo-500/50 rounded-xl py-3.5 pl-11 pr-11 text-white outline-none transition-colors hover:bg-slate-900/60 shadow-inner" 
                          placeholder="••••••••"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    
                    <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 px-4 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.01] disabled:opacity-50 mt-2">
                      {loading ? <Activity size={18} className="animate-spin" /> : (isStudentSignUp ? 'Create Free Account' : 'Sign In')}
                    </button>
                  </form>
                  
                  <Divider />
                  <GoogleButton />
                  
                  <div className="text-center mt-6">
                    <span className="text-slate-500 text-sm">{isStudentSignUp ? 'Already have an account?' : "Don't have an account?"} </span>
                    <button onClick={() => setIsStudentSignUp(!isStudentSignUp)} className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors underline underline-offset-4">
                      {isStudentSignUp ? 'Sign In' : 'Sign Up'}
                    </button>
                  </div>
                </div>
              )}
              
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}