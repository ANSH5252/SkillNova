import React, { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, ShieldAlert } from 'lucide-react';
import { auth, db } from './firebase'; 
import { doc, getDoc } from 'firebase/firestore'; 
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider 
} from 'firebase/auth'; 
import { useNavigate, useLocation } from 'react-router-dom';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  const intendedPath = location.state?.intendedPath || '';
  const isAdminAttempt = intendedPath === '/admin';

  // Force isSignUp to false if they are on the admin login route
  useEffect(() => {
    if (isAdminAttempt) {
      setIsSignUp(false);
    }
  }, [isAdminAttempt]);

  const checkAdminAndRoute = async (userEmail) => {
    try {
      const adminDocRef = doc(db, "admins", userEmail);
      const adminDocSnap = await getDoc(adminDocRef);
      
      if (adminDocSnap.exists()) {
        navigate('/admin');
      } else {
        // If they log in but aren't in the database, boot them to the student portal
        navigate('/student'); 
      }
    } catch (error) {
      console.error("Routing error:", error);
      navigate('/student'); 
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      let userCredential;
      // Admins can NEVER sign up here. Only students can.
      if (isSignUp && !isAdminAttempt) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }
      
      await checkAdminAndRoute(userCredential.user.email);

    } catch (error) {
      console.error("Auth Error:", error);
      setErrorMsg("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg('');
    setLoading(true);
    const provider = new GoogleAuthProvider();
    
    try {
      const userCredential = await signInWithPopup(auth, provider);
      await checkAdminAndRoute(userCredential.user.email);
    } catch (error) {
      console.error("Google Auth Error:", error);
      setErrorMsg("Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 font-sans">
      <div className="bg-[#1e293b] border border-slate-800 rounded-2xl w-full max-w-md p-8 shadow-2xl relative overflow-hidden">
        
        <div className={`absolute top-0 left-0 w-full h-1 ${isAdminAttempt ? 'bg-gradient-to-r from-rose-500 to-orange-500' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'}`}></div>

        <div className="text-center mb-8 mt-2">
          {isAdminAttempt ? (
             <>
               <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
               <h2 className="text-3xl font-bold text-white mb-2">Admin Portal</h2>
               <p className="text-slate-400 text-sm">Strictly authorized personnel only.</p>
             </>
          ) : (
             <>
               <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                 {isSignUp ? 'Create Account' : 'Welcome Back'}
               </h2>
               <p className="text-slate-400 text-sm">
                 {isSignUp ? 'Sign up to simulate your ATS performance.' : 'Log in to access your dashboard.'}
               </p>
             </>
          )}
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg mb-6 text-sm text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-400 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@university.edu" 
                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-400 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••" 
                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className={`w-full text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg mt-2
              ${isAdminAttempt ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-purple-500/25'}`}
          >
            {loading ? (
               <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
               <><LogIn size={18} /> {isAdminAttempt ? 'Authenticate' : (isSignUp ? 'Create Account' : 'Log In')}</>
            )}
          </button>
        </form>

        {/* HIDE GOOGLE AUTH AND SIGN-UP TOGGLE IF IT'S AN ADMIN ATTEMPT */}
        {!isAdminAttempt && (
          <>
            <div className="relative flex items-center py-2 mb-6">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-sm">Or continue with</span>
              <div className="flex-grow border-t border-slate-700"></div>
            </div>

            <button 
              onClick={handleGoogleAuth}
              disabled={loading}
              type="button"
              className="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors mb-6 shadow-sm"
            >
               <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <p className="text-center text-slate-400 text-sm">
              {isSignUp ? "Already have an account? " : "Don't have an account? "}
              <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                {isSignUp ? 'Log in' : 'Sign up'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}