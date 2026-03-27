import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ShieldCheck, Clock, XCircle, Activity, Building2, LogIn, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const intendedPath = location.state?.intendedPath || '';

  // --- UI STATES ---
  const [activeTab, setActiveTab] = useState((intendedPath === '/admin' || intendedPath === '/partner' || intendedPath === '/employer') ? 'partner' : 'student');
  const [isStudentSignUp, setIsStudentSignUp] = useState(false);
  
  // --- FORM STATES ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [partnerStep, setPartnerStep] = useState(1); // 1: Email Check, 2: Password
  const [partnerStatus, setPartnerStatus] = useState(null); // 'pending' | 'rejected' | null
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // --- CORE ROUTING ENGINE ---
  const checkAdminAndRoute = async (userEmail) => {
    try {
      const adminDocRef = doc(db, "admins", userEmail.toLowerCase());
      const adminDocSnap = await getDoc(adminDocRef);
      
      if (adminDocSnap.exists()) {
        const adminData = adminDocSnap.data();
        
        // Dynamic Routing based on exact role
        if (adminData.role === 'superadmin') {
          navigate('/admin'); 
        } else if (adminData.role === 'employer') {
          navigate('/employer'); 
        } else {
          navigate('/partner'); // University Partner fallback
        }
      } else {
        navigate('/student'); // Standard student fallback
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
      navigate('/student'); 
    }
  };

  // --- GOOGLE AUTH ---
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

  // --- STUDENT SUBMIT ---
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

  // --- PARTNER: STEP 1 (Check Email) ---
  const handlePartnerEmailCheck = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      // 1. Check if already an admin in firestore
      const adminDoc = await getDoc(doc(db, 'admins', email.toLowerCase()));
      if (adminDoc.exists()) {
        setPartnerStep(2);
        setLoading(false);
        return;
      }

      // 2. Check if pending/rejected application
      const q = query(collection(db, 'partner_applications'), where('email', '==', email.toLowerCase()));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const appStatus = snap.docs[0].data().status;
        if (appStatus === 'pending') setPartnerStatus('pending');
        else if (appStatus === 'rejected') setPartnerStatus('rejected');
        else setPartnerStep(2); 
      } else {
        // 3. Not found anywhere. Failsafe to password step to obscure existence
        setPartnerStep(2);
      }
    } catch (error) {
      console.error(error);
      setPartnerStep(2); 
    } finally {
      setLoading(false);
    }
  };

  // --- PARTNER: STEP 2 (Final Login & Seamless Auth Hand-off) ---
  const handlePartnerFinalSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      // Attempt 1: Try to log them in normally
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await checkAdminAndRoute(userCredential.user.email);
    } catch (error) {
      // THE FIX: If they fail because they don't have an Auth account yet, we seamlessly create it!
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
         try {
           // Create the account using the password they just typed
           const newUser = await createUserWithEmailAndPassword(auth, email, password);
           await checkAdminAndRoute(newUser.user.email);
         } catch (createError) {
           if (createError.code === 'auth/email-already-in-use') {
             // If they actually DO exist but typed the wrong password, show a normal error.
             setErrorMsg("Incorrect password. Please try again.");
           } else {
             setErrorMsg(createError.message.replace('Firebase: ', ''));
           }
         }
      } else {
         setErrorMsg("Invalid credentials. Enterprise accounts must be pre-approved.");
      }
    } finally {
      setLoading(false);
    }
  };

  // --- SHARED UI COMPONENTS ---
  const GoogleButton = () => (
    <button 
      type="button"
      onClick={handleGoogleSignIn}
      disabled={loading}
      className="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-sm disabled:opacity-50 mt-4"
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
    <div className="flex items-center gap-4 my-5">
      <div className="flex-1 h-px bg-slate-700/50"></div>
      <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Or</span>
      <div className="flex-1 h-px bg-slate-700/50"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 selection:bg-indigo-500/30">
      <div className="w-full max-w-[420px]">
        
        {/* DYNAMIC LOGO HEADER */}
        <div className="text-center mb-8 animate-fade-in">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl border mb-6 shadow-2xl transition-colors duration-500 ${activeTab === 'partner' ? 'bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10' : 'bg-indigo-500/10 border-indigo-500/20 shadow-indigo-500/10'}`}>
            {activeTab === 'partner' ? <Building2 className="text-emerald-400 w-8 h-8" /> : <LogIn className="text-indigo-400 w-8 h-8" />}
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
            {activeTab === 'partner' ? 'Enterprise Portal' : 'Student Access'}
          </h2>
          <p className="text-slate-400 text-sm">
            {activeTab === 'partner' ? 'Log in to manage cohorts or discover talent.' : 'Log in to run your ATS resume simulations.'}
          </p>
        </div>

        {/* MAIN CARD */}
        <div className="bg-[#1e293b]/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          
          {/* ERROR DISPLAY */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold mb-6 text-center animate-fade-in">
              {errorMsg}
            </div>
          )}

          {/* --- PARTNER STATUS SCREENS --- */}
          {partnerStatus === 'pending' && (
            <div className="text-center animate-fade-in">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><Clock className="text-amber-400 w-8 h-8" /></div>
              <h3 className="text-xl font-bold text-white mb-2">Review in Progress</h3>
              <p className="text-sm text-slate-400 mb-6">Your Enterprise application for <strong className="text-slate-200">{email}</strong> is under review. Standard review times are 24 hours.</p>
              <button onClick={() => {setPartnerStatus(null); setPartnerStep(1); setEmail('');}} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl">Use a different account</button>
            </div>
          )}

          {partnerStatus === 'rejected' && (
            <div className="text-center animate-fade-in">
              <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><XCircle className="text-rose-400 w-8 h-8" /></div>
              <h3 className="text-xl font-bold text-white mb-2">Access Declined</h3>
              <p className="text-sm text-slate-400 mb-6">Unfortunately, your application for Enterprise access could not be verified at this time.</p>
              <button onClick={() => {setPartnerStatus(null); setPartnerStep(1); setEmail('');}} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl">Return to Login</button>
            </div>
          )}

          {/* --- ENTERPRISE FLOW --- */}
          {activeTab === 'partner' && partnerStatus === null && (
            <div className="animate-fade-in">
              {partnerStep === 1 ? (
                <form onSubmit={handlePartnerEmailCheck}>
                  <div>
                    <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Institutional Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input 
                        type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 focus:border-emerald-500 rounded-xl py-3.5 pl-11 pr-4 text-white outline-none transition-colors"
                        placeholder="admin@company.com"
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={loading || !email} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50 mt-5">
                    {loading ? <Activity size={18} className="animate-spin" /> : <>Continue <ArrowRight size={18} /></>}
                  </button>
                  <Divider />
                  <GoogleButton />
                </form>
              ) : (
                <form onSubmit={handlePartnerFinalSubmit} className="animate-fade-in">
                  <div className="flex items-center justify-between bg-slate-900/50 border border-slate-700 p-3 rounded-xl mb-6">
                    <span className="text-sm text-slate-300 truncate max-w-[200px]">{email}</span>
                    <button type="button" onClick={() => setPartnerStep(1)} className="text-xs font-bold text-emerald-400 hover:text-emerald-300">Edit</button>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input 
                        type={showPassword ? 'text' : 'password'} required autoFocus value={password} onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 focus:border-emerald-500 rounded-xl py-3.5 pl-11 pr-11 text-white outline-none transition-colors" placeholder="••••••••"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={loading || !password} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center mt-5 shadow-lg shadow-emerald-500/25 disabled:opacity-50">
                    {loading ? <Activity size={18} className="animate-spin" /> : <><ShieldCheck size={18} className="mr-2"/> Secure Login</>}
                  </button>
                  <Divider />
                  <GoogleButton />
                </form>
              )}
            </div>
          )}

          {/* --- STUDENT FLOW --- */}
          {activeTab === 'student' && (
            <div className="animate-fade-in">
              <form onSubmit={handleStudentSubmit} className="space-y-5">
                <div>
                  <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-700 focus:border-indigo-500 rounded-xl py-3.5 pl-11 pr-4 text-white outline-none transition-colors" placeholder="name@email.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-700 focus:border-indigo-500 rounded-xl py-3.5 pl-11 pr-11 text-white outline-none transition-colors" placeholder="••••••••"
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
                <span className="text-slate-500 text-sm">
                  {isStudentSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                </span>
                <button onClick={() => setIsStudentSignUp(!isStudentSignUp)} className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors">
                  {isStudentSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* SUBTLE SWITCHER */}
        <div className="text-center mt-6">
          <button 
            onClick={() => {
              setActiveTab(activeTab === 'student' ? 'partner' : 'student');
              setErrorMsg('');
              setPartnerStep(1);
            }} 
            className="text-slate-500 hover:text-slate-300 text-xs font-medium transition-colors"
          >
            {activeTab === 'student' ? 'Are you an Enterprise Partner? Login here.' : 'Are you a Student? Login here.'}
          </button>
        </div>

      </div>
    </div>
  );
}