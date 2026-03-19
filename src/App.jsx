import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from './ProtectedRoute';
import AdminDashboard from './AdminDashboard';
import StudentDashboard from './StudentDashboard';
import Login from './Login';
import { Target, ShieldAlert, Building2, Activity, Zap } from 'lucide-react';

// --- CUSTOM SVG LOGO COMPONENT ---
const SkillNovaLogo = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M50 5L60.5 39.5L95 50L60.5 60.5L50 95L39.5 60.5L5 50L39.5 39.5L50 5Z" fill="url(#nova-gradient)"/>
    <circle cx="50" cy="50" r="18" fill="#0f172a"/>
    <circle cx="50" cy="50" r="8" fill="url(#nova-gradient)"/>
    <defs>
      <linearGradient id="nova-gradient" x1="5" y1="5" x2="95" y2="95" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366f1" /> {/* Indigo */}
        <stop offset="1" stopColor="#ec4899" /> {/* Pink */}
      </linearGradient>
    </defs>
  </svg>
);

function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-indigo-500/30 overflow-x-hidden relative">
      
      {/* INLINE ANIMATION STYLES */}
      <style>
        {`
          /* 1. Splash Screen Fade Out */
          @keyframes splashFade {
            0%, 60% { opacity: 1; z-index: 100; }
            100% { opacity: 0; z-index: -1; visibility: hidden; }
          }
          
          /* 2. The Star Flying Sequence */
          @keyframes starEntrance {
            0% { transform: scale(0) rotate(-135deg); opacity: 0; }
            20% { transform: scale(3.5) rotate(0deg); opacity: 1; }
            60% { transform: scale(3.5) rotate(0deg); opacity: 1; }
            100% { transform: translate(-40vw, -45vh) scale(0.5); opacity: 0; }
          }

          /* 3. Standard Cascading Fades */
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          /* Class Assignments */
          .animate-splash { animation: splashFade 1.6s cubic-bezier(0.65, 0, 0.35, 1) forwards; }
          .animate-star-entrance { animation: starEntrance 1.6s cubic-bezier(0.65, 0, 0.35, 1) forwards; }
          
          .animate-fade-in-up {
            animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;
          }
          .animate-fade-in {
            animation: fadeIn 1s ease-out forwards;
            opacity: 0;
          }

          /* Exact Timings to match the star landing */
          .delay-nav { animation-delay: 1400ms; }
          .delay-hero-1 { animation-delay: 1500ms; }
          .delay-hero-2 { animation-delay: 1600ms; }
          .delay-hero-3 { animation-delay: 1700ms; }
          .delay-hero-4 { animation-delay: 1800ms; }
          .delay-cards-1 { animation-delay: 2000ms; }
          .delay-cards-2 { animation-delay: 2150ms; }
          .delay-cards-3 { animation-delay: 2300ms; }
        `}
      </style>

      {/* --- CINEMATIC SPLASH SCREEN --- */}
      <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center animate-splash pointer-events-none">
        <SkillNovaLogo className="w-20 h-20 animate-star-entrance" />
      </div>

      {/* NAVBAR */}
      <nav className="border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-50 animate-fade-in delay-nav">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SkillNovaLogo className="w-10 h-10 animate-pulse" />
            <span className="text-2xl font-bold tracking-tight text-white">SkillNova</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-indigo-500/25">
              Enter Simulator
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <div className="relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none animate-fade-in delay-nav"></div>
        
        <div className="max-w-6xl mx-auto px-6 pt-32 pb-20 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700 text-indigo-400 text-sm font-medium mb-8 animate-fade-in-up delay-hero-1">
            <Activity size={16} /> Live ATS Engine v2.0
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tight animate-fade-in-up delay-hero-2">
            The Ultimate <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              ATS Rejection Simulator.
            </span>
          </h1>
          
          <p className="text-slate-400 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up delay-hero-3">
            Stop guessing why your resume was rejected. SkillNova's local PDF parser and ruthless AI scoring engine shows you exactly what enterprise hiring software sees.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-hero-4">
            <Link to="/login" className="w-full sm:w-auto px-8 py-4 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/10">
              <Zap size={20} /> Run Your Free Scan
            </Link>
            <Link to="/login" state={{ intendedPath: '/admin' }} className="w-full sm:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2">
              <Building2 size={20} /> Partner Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* FEATURES GRID */}
      <div className="max-w-6xl mx-auto px-6 py-20 border-t border-slate-800/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Feature 1 */}
          <div className="bg-[#1e293b]/50 border border-slate-800 p-8 rounded-2xl hover:border-indigo-500/50 transition-colors animate-fade-in-up delay-cards-1">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-6">
              <Target className="text-indigo-400 w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Ruthless AI Scoring</h3>
            <p className="text-slate-400 leading-relaxed text-sm">
              We don't sugarcoat it. Our Groq-powered Llama 3.1 engine scans for absolute mandatory technical skills and penalizes missing keywords.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-[#1e293b]/50 border border-slate-800 p-8 rounded-2xl hover:border-rose-500/50 transition-colors animate-fade-in-up delay-cards-2">
            <div className="w-12 h-12 bg-rose-500/20 rounded-xl flex items-center justify-center mb-6">
              <ShieldAlert className="text-rose-400 w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Format Validation</h3>
            <p className="text-slate-400 leading-relaxed text-sm">
              If an enterprise ATS can't read your PDF, neither can we. We test local, browser-based text extraction to ensure machine readability.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-[#1e293b]/50 border border-slate-800 p-8 rounded-2xl hover:border-emerald-500/50 transition-colors animate-fade-in-up delay-cards-3">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-6">
              <Building2 className="text-emerald-400 w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">B2B Partner Pipeline</h3>
            <p className="text-slate-400 leading-relaxed text-sm">
              Target exact open roles from our simulated partner companies. University admins track global pass/fail metrics in real-time.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin={true}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/student" element={
            <ProtectedRoute>
              <StudentDashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;