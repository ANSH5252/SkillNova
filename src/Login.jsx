import React, { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, ShieldAlert, Building2 } from 'lucide-react';
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
  const isAdminAttempt = intendedPath === '/admin' || intendedPath === '/partner';

  // Force isSignUp to false if they are on an admin login route
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
        const adminData = adminDocSnap.data();
        // Route based on specific role
        if (adminData.role === 'superadmin') {
          navigate(intendedPath === '/admin' ? '/admin' : '/admin'); 
        } else {
          navigate('/partner'); // University Specific Portal
        }
      } else {
        // Standard student fallback
        navigate(intendedPath && !isAdminAttempt ? intendedPath : '/student');
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
      navigate('/student'); // Fallback on error
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isSignUp && !isAdminAttempt) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await checkAdminAndRoute(userCredential.user.email);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await checkAdminAndRoute(userCredential.user.email);
      }
    } catch (error) {
      setErrorMsg(error.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 selection:bg-indigo-500/30">
      <div className="w-full max-w-md">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-6 shadow-[0_0_30px_rgba(99,102,241,0.15)]">
            {isAdminAttempt ? <Building2 className="text-indigo-400 w-8 h-8" /> : <LogIn className="text-indigo-400 w-8 h-8" />}
          </div>
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
            {isAdminAttempt ? 'Partner Portal' : (isSignUp ? 'Create Account' : 'Welcome Back')}
          </h2>
          <p className="text-slate-400 text-sm">
            {isAdminAttempt 
              ? 'Sign in with your enterprise credentials.' 
              : 'Enter the SkillNova ATS Simulator.'}
          </p>
        </div>

        <div className="bg-[#1e293b]/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl mb-6 flex items-start gap-3 text-sm">
              <ShieldAlert size={18} className="mt-0.5 flex-shrink-0" />
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {!isAdminAttempt && (
            <>
              <button 
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-all mb-6 shadow-sm disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.15H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.85l2.9-2.26z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.56 0 2.96.54 4.07 1.59l3.05-3.05C17.46 2.05 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.15l3.66 2.84c.87-2.6 3.3-4.61 6.16-4.61z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-slate-800"></div>
                <span className="text-slate-500 text-sm font-medium">or continue with email</span>
                <div className="flex-1 h-px bg-slate-800"></div>
              </div>
            </>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 focus:border-indigo-500 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder-slate-600 outline-none transition-colors"
                  placeholder="name@university.edu"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 focus:border-indigo-500 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder-slate-600 outline-none transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 disabled:opacity-70 mt-4"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                isSignUp && !isAdminAttempt ? 'Create Free Account' : 'Sign In Securely'
              )}
            </button>
          </form>

          {!isAdminAttempt && (
            <p className="text-center text-slate-400 text-sm mt-8">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          )}

        </div>
      </div>
    </div>
  );
}