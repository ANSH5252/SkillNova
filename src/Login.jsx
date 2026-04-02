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
  Mail, 
  Lock, 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  XCircle, 
  Activity, 
  Building2, 
  Eye, 
  EyeOff, 
  Briefcase,
  User,
  ArrowLeft
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
  const [partnerStep, setPartnerStep] = useState(1); 
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
    } catch (error) {
      console.error("Routing Error:", error);
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
    } catch (error) {
      setErrorMsg(error.message.replace('Firebase: ', ''));
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
    } catch (error) {
      setErrorMsg(error.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerEmailCheck = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const adminDoc = await getDoc(doc(db, 'admins', email.toLowerCase()));
      if (adminDoc.exists()) {
        setPartnerStep(2);
        setLoading(false);
        return;
      }

      const q = query(collection(db, 'partner_applications'), where('email', '==', email.toLowerCase()));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const appStatus = snap.docs[0].data().status;
        if (appStatus === 'pending') setPartnerStatus('pending');
        else if (appStatus === 'rejected') setPartnerStatus('rejected');
        else setPartnerStep(2); 
      } else {
        setPartnerStep(2); 
      }
    } catch (error) {
      console.error(error);
      setPartnerStep(2); 
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerFinalSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await checkAdminAndRoute(userCredential.user.email);
    } catch (error) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          try {
            const newUser = await createUserWithEmailAndPassword(auth, email, password);
            await checkAdminAndRoute(newUser.user.email);
          } catch (createError) {
            setErrorMsg(createError.code === 'auth/email-already-in-use' ? "Incorrect password." : "Access Denied.");
          }
      } else {
          setErrorMsg("Invalid credentials. Accounts must be pre-approved.");
      }
    } finally {
      setLoading(false);
    }
  };

  // --- SHARED UI ---
  const GoogleButton = () => (
    <button 
      type="button" onClick={handleGoogleSignIn} disabled={loading}
      className="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-sm mt-4 disabled:opacity-50"
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

  return (
    <div className="min-h-screen bg-[#04060d] flex flex-col relative selection:bg-indigo-500/30 overflow-hidden">
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
      
      {/* Dynamic Background Glow */}
      <div ref={gridRef} className="absolute inset-0 bg-grid-pattern [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)] pointer-events-none"></div>
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b ${getGlowColor()} blur-[150px] rounded-full pointer-events-none transition-colors duration-1000`}></div>

      {/* Back to Home Button */}
      <div className="relative z-10 pt-8 px-8">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <ArrowLeft size={16} /> Back to Home
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-[420px]">
          
          {/* HEADER SECTION */}
          <div className="text-center mb-8 animate-fade-in">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl border mb-6 shadow-2xl transition-all duration-500 
              ${activeTab === 'partner' ? 'bg-amber-500/10 border-amber-500/20 shadow-amber-500/10' : 
                activeTab === 'employer' ? 'bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10' : 
                'bg-indigo-500/10 border-indigo-500/20 shadow-indigo-500/10'}`}>
              {activeTab === 'partner' && <Building2 className="text-amber-400 w-8 h-8" />}
              {activeTab === 'employer' && <Briefcase className="text-emerald-400 w-8 h-8" />}
              {activeTab === 'student' && <User className="text-indigo-400 w-8 h-8" />}
            </div>

            {/* PILL SWITCHER */}
            <div className="relative flex items-center p-1.5 bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-full mb-8 mx-auto w-full max-w-[360px] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
              <div className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(33.333%-4px)] rounded-full border transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${getSliderTranslate()} ${getSliderColor()}`}></div>
              
              <button type="button" onClick={() => { setActiveTab('student'); setErrorMsg(''); setPartnerStep(1); }} className={`relative z-10 flex-1 py-1.5 rounded-full text-xs font-bold transition-colors duration-300 flex items-center justify-center gap-1.5 ${activeTab === 'student' ? 'text-white drop-shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
                <span className="truncate">Student</span>
              </button>

              <button type="button" onClick={() => { setActiveTab('partner'); setErrorMsg(''); setPartnerStep(1); }} className={`relative z-10 flex-1 py-1.5 rounded-full text-xs font-bold transition-colors duration-300 flex items-center justify-center gap-1.5 ${activeTab === 'partner' ? 'text-white drop-shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
                <span className="truncate">University</span>
              </button>

              <button type="button" onClick={() => { setActiveTab('employer'); setErrorMsg(''); setPartnerStep(1); }} className={`relative z-10 flex-1 py-1.5 rounded-full text-xs font-bold transition-colors duration-300 flex items-center justify-center gap-1.5 ${activeTab === 'employer' ? 'text-white drop-shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
                <span className="truncate">Employer</span>
              </button>
            </div>

            <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
              {activeTab === 'partner' ? 'Enterprise Portal' : 
               activeTab === 'employer' ? 'Talent Discovery Hub' : 
               'Student Access'}
            </h2>
            <p className="text-slate-400 text-sm px-4">
              {activeTab === 'partner' ? 'Log in to manage your university partnership.' : 
               activeTab === 'employer' ? 'Log in to find pre-vetted, high-match candidates.' : 
               'Log in to run your ATS resume simulations.'}
            </p>
          </div>

        {/* MAIN CARD */}
        <div className="bg-[#1e293b]/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold mb-6 text-center">
              {errorMsg}
            </div>
          )}

          {/* STATUS SCREENS */}
          {partnerStatus === 'pending' && (
            <div className="text-center animate-fade-in">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><Clock className="text-amber-400 w-8 h-8" /></div>
              <h3 className="text-xl font-bold text-white mb-2">Review in Progress</h3>
              <p className="text-sm text-slate-400 mb-6">Your application for <strong className="text-slate-200">{email}</strong> is under review.</p>
              <button onClick={() => {setPartnerStatus(null); setPartnerStep(1); setEmail('');}} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl">Use a different account</button>
            </div>
          )}

          {partnerStatus === 'rejected' && (
            <div className="text-center animate-fade-in">
              <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><XCircle className="text-rose-400 w-8 h-8" /></div>
              <h3 className="text-xl font-bold text-white mb-2">Access Declined</h3>
              <p className="text-sm text-slate-400 mb-6">Your application for access could not be verified at this time.</p>
              <button onClick={() => {setPartnerStatus(null); setPartnerStep(1); setEmail('');}} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl">Return to Login</button>
            </div>
          )}

          {/* HUB / ENTERPRISE LOGIN FLOW */}
          {(activeTab === 'partner' || activeTab === 'employer') && partnerStatus === null && (
            <div className="animate-fade-in">
              {partnerStep === 1 ? (
                <form onSubmit={handlePartnerEmailCheck}>
                  <div>
                    <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">
                        {activeTab === 'employer' ? 'Work Email Address' : 'Institutional Email'}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input 
                        type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
                        className={`w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3.5 pl-11 pr-4 text-white outline-none transition-colors 
                          ${activeTab === 'employer' ? 'focus:border-emerald-500' : 'focus:border-amber-500'}`}
                        placeholder={activeTab === 'employer' ? "hr@company.com" : "admin@university.edu"}
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" disabled={loading || !email} 
                    className={`w-full text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg mt-5 transition-all 
                      ${activeTab === 'employer' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/25' : 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/25'}`}
                  >
                    {loading ? <Activity size={18} className="animate-spin" /> : <>Continue <ArrowRight size={18} /></>}
                  </button>
                  <Divider />
                  <GoogleButton />
                </form>
              ) : (
                <form onSubmit={handlePartnerFinalSubmit} className="animate-fade-in">
                  <div className="flex items-center justify-between bg-slate-900/50 border border-slate-700 p-3 rounded-xl mb-6">
                    <span className="text-sm text-slate-300 truncate max-w-[200px]">{email}</span>
                    <button type="button" onClick={() => setPartnerStep(1)} className={`text-xs font-bold transition-colors ${activeTab === 'employer' ? 'text-emerald-400 hover:text-emerald-300' : 'text-amber-400 hover:text-amber-300'}`}>Edit</button>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input 
                        type={showPassword ? 'text' : 'password'} required autoFocus value={password} onChange={(e) => setPassword(e.target.value)}
                        className={`w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3.5 pl-11 pr-11 text-white outline-none transition-colors 
                          ${activeTab === 'employer' ? 'focus:border-emerald-500' : 'focus:border-amber-500'}`} 
                        placeholder="••••••••"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <button 
                    type="submit" disabled={loading || !password} 
                    className={`w-full text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center mt-5 shadow-lg transition-all 
                      ${activeTab === 'employer' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/25' : 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/25'}`}
                  >
                    {loading ? <Activity size={18} className="animate-spin" /> : <><ShieldCheck size={18} className="mr-2"/> Secure Login</>}
                  </button>
                  <Divider />
                  <GoogleButton />
                </form>
              )}
            </div>
          )}

          {/* STUDENT LOGIN FLOW */}
          {activeTab === 'student' && (
            <div className="animate-fade-in">
              <form onSubmit={handleStudentSubmit} className="space-y-5">
                <div>
                  <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-700 focus:border-indigo-500 rounded-xl py-3.5 pl-11 pr-4 text-white outline-none transition-colors" 
                      placeholder="name@email.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-700 focus:border-indigo-500 rounded-xl py-3.5 pl-11 pr-11 text-white outline-none transition-colors" 
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25 disabled:opacity-50">
                  {loading ? <Activity size={18} className="animate-spin" /> : (isStudentSignUp ? 'Create Free Account' : 'Sign In')}
                </button>
              </form>
              <Divider />
              <GoogleButton />
              <div className="text-center mt-6">
                <span className="text-slate-500 text-sm">{isStudentSignUp ? 'Already have an account?' : "Don't have an account?"} </span>
                <button onClick={() => setIsStudentSignUp(!isStudentSignUp)} className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors">
                  {isStudentSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}