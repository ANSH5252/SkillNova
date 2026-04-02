import React, { useState, useEffect, useRef } from 'react';
import { Building2, Mail, User, ShieldCheck, ArrowRight, CheckCircle, Activity, Briefcase, Globe, Users, ArrowLeft, Target } from 'lucide-react';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Link } from 'react-router-dom';

export default function EmployerApply() {
  const [formData, setFormData] = useState({
    contactName: '',
    companyName: '',
    email: '',
    industry: '',
    hiringScale: '1-10'
  });
  const [status, setStatus] = useState('idle'); // idle, submitting, success, error
  const [errorMsg, setErrorMsg] = useState('');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    try {
      await addDoc(collection(db, 'employer_applications'), {
        ...formData,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setStatus('success');
    } catch (error) {
      console.error("Application Error:", error);
      // EXPLICIT ERROR HANDLING FOR EASIER DEBUGGING
      setErrorMsg(
        error.message.includes('permission')
          ? "Permission Denied: Please ensure you published the updated Firestore rules in your Firebase Console."
          : `Failed to submit: ${error.message}`
      );
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-[#04060d] flex flex-col relative selection:bg-emerald-500/30 overflow-x-hidden font-sans">
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
      <div className="fixed top-0 right-1/4 w-[600px] h-[600px] bg-gradient-to-bl from-emerald-500/20 to-teal-500/10 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="fixed bottom-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-tr from-indigo-500/10 to-blue-500/10 blur-[150px] rounded-full pointer-events-none"></div>

      {/* Back to Home Header */}
      <div className="relative z-20 pt-8 px-8 lg:px-16 w-full max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <ArrowLeft size={16} /> Back to Home
        </Link>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#0a0f1c]/80 backdrop-blur-md border border-white/10 rounded-full shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-bold text-slate-300">Employer Discovery Network</span>
        </div>
      </div>

      <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 lg:py-20 relative z-10 flex items-center justify-center">

        {status === 'success' ? (
          /* SUCCESS SCREEN */
          <div className="max-w-xl w-full bg-[#0a0f1c]/90 backdrop-blur-2xl border border-emerald-500/30 p-10 md:p-14 rounded-[2rem] text-center shadow-[0_0_80px_rgba(16,185,129,0.15)] relative overflow-hidden animate-fade-in-up">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

            <div className="relative z-10">
              <div className="w-24 h-24 bg-emerald-500/10 border-4 border-[#04060d] rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <CheckCircle className="text-emerald-400 w-12 h-12" />
              </div>
              <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Application Received!</h2>
              <p className="text-slate-400 mb-8 text-lg leading-relaxed">
                Thank you for choosing SkillNova. The enterprise profile for <strong className="text-white">{formData.companyName}</strong> has been successfully transmitted.
              </p>

              <div className="bg-[#1e293b]/50 border border-emerald-500/20 p-6 md:p-8 rounded-2xl mb-10 text-left backdrop-blur-md">
                <h4 className="text-emerald-400 font-bold text-sm mb-4 flex items-center gap-2 uppercase tracking-widest">
                  <Activity size={16} /> Verification Status
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed mb-6">
                  We manually verify all hiring partners to maintain a high-quality, secure talent pool for our students. Our partnership team will review your profile shortly.
                </p>
                <ul className="text-sm text-slate-400 space-y-4 pt-6 border-t border-emerald-500/10">
                  <li className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0"><ArrowRight size={12} className="text-emerald-400" /></div>
                    <span>You will receive an invite code at <strong>{formData.email}</strong>.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0"><ArrowRight size={12} className="text-emerald-400" /></div>
                    <span>Use this code to activate your dashboard and post your first role.</span>
                  </li>
                </ul>
              </div>

              <Link to="/login" className="px-8 py-4 bg-white text-[#04060d] hover:bg-slate-200 font-black rounded-xl transition-all inline-block w-full shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:scale-[1.02]">
                Return to Login Portal
              </Link>
            </div>
          </div>

        ) : (

          /* THE SPLIT LAYOUT */
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

            {/* VALUE PROP COLUMN */}
            <div className="lg:col-span-5 flex flex-col justify-center animate-fade-in pr-0 lg:pr-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-300 w-fit mb-8 shadow-sm">
                <Briefcase size={14} className="text-emerald-400" /> Hiring Partners
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter leading-[1.1] mb-6 drop-shadow-[0_2px_20px_rgba(255,255,255,0.1)]">
                Scale your <br className="hidden lg:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Engineering Team.</span>
              </h1>
              <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-lg">
                Bypass the resume spam. Tap into a curated pipeline of verified candidates whose technical skills have already been validated against your exact open roles.
              </p>

              <div className="space-y-6 max-w-lg">
                <div className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Target className="text-emerald-400" size={24} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg mb-1">Pre-Vetted Talent</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">Stop wasting time on unqualified applicants. View only students who match 80%+ of your required technical stack.</p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Building2 className="text-emerald-400" size={24} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg mb-1">University Networks</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">Source directly from verified cohorts at our partner universities before candidates hit the open market.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* FORM COLUMN */}
            <div className="lg:col-span-7 relative">
              <div className="absolute -inset-1 bg-gradient-to-bl from-emerald-500/30 to-teal-500/30 blur-2xl opacity-50 rounded-[2rem] pointer-events-none"></div>

              <div className="relative bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 p-8 md:p-12 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                <div className="mb-10 text-center">
                  <h3 className="text-2xl md:text-3xl font-black text-white mb-2">Join the Discovery Hub</h3>
                  <p className="text-sm text-slate-400">Apply for a secure employer dashboard.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">

                  {errorMsg && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm text-center font-bold">
                      {errorMsg}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-1">
                      <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Contact Person</label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
                        <input
                          type="text" required value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                          className="w-full bg-slate-900/40 border border-slate-700/50 focus:border-emerald-500/50 rounded-xl py-4 pl-12 pr-4 text-white hover:bg-slate-900/60 transition-colors outline-none shadow-inner"
                          placeholder="John Smith"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Company Name</label>
                      <div className="relative group">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
                        <input
                          type="text" required value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                          className="w-full bg-slate-900/40 border border-slate-700/50 focus:border-emerald-500/50 rounded-xl py-4 pl-12 pr-4 text-white hover:bg-slate-900/60 transition-colors outline-none shadow-inner"
                          placeholder="TechCorp Inc."
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Work Email Address</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
                        <input
                          type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full bg-slate-900/40 border border-slate-700/50 focus:border-emerald-500/50 rounded-xl py-4 pl-12 pr-4 text-white hover:bg-slate-900/60 transition-colors outline-none shadow-inner"
                          placeholder="hiring@techcorp.com"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Industry</label>
                      <div className="relative group">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
                        <input
                          type="text" required value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                          className="w-full bg-slate-900/40 border border-slate-700/50 focus:border-emerald-500/50 rounded-xl py-4 pl-12 pr-4 text-white hover:bg-slate-900/60 transition-colors outline-none shadow-inner"
                          placeholder="Software / AI"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Hiring Scale (Year)</label>
                      <div className="relative group">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
                        <select
                          value={formData.hiringScale} onChange={(e) => setFormData({ ...formData, hiringScale: e.target.value })}
                          className="w-full bg-slate-900/40 border border-slate-700/50 focus:border-emerald-500/50 rounded-xl py-4 pl-12 pr-4 text-white hover:bg-slate-900/60 transition-colors outline-none shadow-inner appearance-none cursor-pointer"
                        >
                          <option value="1-10">1-10 Students</option>
                          <option value="11-50">11-50 Students</option>
                          <option value="51-200">51-200 Students</option>
                          <option value="200+">200+ Students</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl mt-4">
                    <ShieldCheck className="text-emerald-400 flex-shrink-0 mt-0.5" size={20} />
                    <p className="text-xs text-slate-300 leading-relaxed">
                      By submitting this form, you agree to our terms of service. We maintain a secure ecosystem and manually verify every employer account for student safety.
                    </p>
                  </div>

                  <button
                    type="submit" disabled={status === 'submitting'}
                    className="w-full bg-white hover:bg-slate-200 text-[#04060d] font-black py-4 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.15)] disabled:opacity-70 mt-6 hover:scale-[1.02]"
                  >
                    {status === 'submitting' ? (
                      <div className="w-5 h-5 border-2 border-slate-400 border-t-[#04060d] rounded-full animate-spin"></div>
                    ) : (
                      <>Submit Partner Request <ArrowRight size={18} /></>
                    )}
                  </button>

                  <div className="text-center mt-6">
                    <Link to="/login" className="text-slate-500 hover:text-slate-300 text-sm font-bold transition-colors underline underline-offset-4">
                      Already have an invite? Log in here.
                    </Link>
                  </div>
                </form>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}