import React, { useState, useEffect, useRef } from 'react';
import { Building2, Mail, User, ShieldCheck, ArrowRight, CheckCircle, Activity, Briefcase, Zap, Network, ArrowLeft, Gem } from 'lucide-react';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Link } from 'react-router-dom';

export default function PartnerApply() {
  const [formData, setFormData] = useState({
    contactName: '',
    organizationName: '',
    email: ''
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
      await addDoc(collection(db, 'partner_applications'), {
        contactName: formData.contactName,
        universityName: formData.organizationName, // Preserve backward compatibility with Firestore
        email: formData.email,
        status: 'pending', 
        createdAt: serverTimestamp()
      });
      setStatus('success');
    } catch (error) {
      console.error("Application Error:", error);
      setErrorMsg("Failed to submit application. Please try again.");
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-[#04060d] flex flex-col relative selection:bg-amber-500/30 overflow-x-hidden font-sans">
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
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-amber-500/20 to-orange-500/10 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-gradient-to-tl from-emerald-500/20 to-teal-500/10 blur-[150px] rounded-full pointer-events-none"></div>

      {/* Back to Home Header */}
      <div className="relative z-20 pt-8 px-8 lg:px-16 w-full max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <ArrowLeft size={16} /> Back to Home
        </Link>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#0a0f1c]/80 backdrop-blur-md border border-white/10 rounded-full shadow-lg">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span className="text-xs font-bold text-slate-300">Enterprise Secure Channel</span>
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
              <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Access Requested!</h2>
              <p className="text-slate-400 mb-8 text-lg leading-relaxed">
                Thank you for choosing SkillNova. The enterprise profile for <strong className="text-white">{formData.organizationName}</strong> has been successfully received.
              </p>
              
              <div className="bg-[#1e293b]/50 border border-emerald-500/20 p-6 md:p-8 rounded-2xl mb-10 text-left backdrop-blur-md">
                <h4 className="text-emerald-400 font-bold text-sm mb-4 flex items-center gap-2 uppercase tracking-widest">
                  <Activity size={16} /> Onboarding Timeline
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed mb-6">
                  Our security team manually verifies all enterprise accounts to ensure platform integrity. <strong>It will take a maximum of 24 hours to review your details and provision your secure tenant dashboard.</strong>
                </p>
                <ul className="text-sm text-slate-400 space-y-4 pt-6 border-t border-emerald-500/10">
                  <li className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0"><ArrowRight size={12} className="text-emerald-400"/></div>
                    <span>Approval notification will be sent to <strong>{formData.email}</strong>.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0"><ArrowRight size={12} className="text-emerald-400"/></div>
                    <span>Secure instructions inside to activate your global dashboard.</span>
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
                <Gem size={14} className="text-amber-400" /> Premium Access
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter leading-[1.1] mb-6 drop-shadow-[0_2px_20px_rgba(255,255,255,0.1)]">
                Unleash the <br className="hidden lg:block"/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-emerald-400">Power of Talent.</span>
              </h1>
              <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-lg">
                Exclusive, secure portal access for top-tier university partners and verified enterprise employers. Start tracking real-time skill insights instantly.
              </p>

              <div className="space-y-6 max-w-lg">
                <div className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
                  <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Building2 className="text-amber-400" size={24}/>
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg mb-1">University Cohorts</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">Instantly provision 10,000+ student accounts securely. Analyze curriculum gaps via our Llama 3.1 driven dashboard.</p>
                  </div>
                </div>
                
                <div className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Briefcase className="text-emerald-400" size={24}/>
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg mb-1">Employer Hub</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">Bypass generalized spam. Tap directly into pre-vetted, high-match technical candidates scored entirely against your JDs.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* FORM COLUMN */}
            <div className="lg:col-span-7 relative">
              <div className="absolute -inset-1 bg-gradient-to-br from-amber-500/30 to-emerald-500/30 blur-2xl opacity-50 rounded-[2rem] pointer-events-none"></div>
              
              <div className="relative bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 p-8 md:p-12 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                <div className="mb-10 text-center">
                  <h3 className="text-2xl md:text-3xl font-black text-white mb-2">Request Tenant Access</h3>
                  <p className="text-sm text-slate-400">Secure whitelisting application for organizations.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  
                  {errorMsg && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm text-center font-bold">
                      {errorMsg}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Contact Name</label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-400 transition-colors" size={18} />
                        <input 
                          type="text" required value={formData.contactName} onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                          className="w-full bg-slate-900/40 border border-slate-700/50 focus:border-amber-500/50 rounded-xl py-4 pl-12 pr-4 text-white hover:bg-slate-900/60 transition-colors outline-none shadow-inner"
                          placeholder="Dr. Jane Doe / John Smith"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Organization / University Name</label>
                      <div className="relative group">
                        <Network className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
                        <input 
                          type="text" required value={formData.organizationName} onChange={(e) => setFormData({...formData, organizationName: e.target.value})}
                          className="w-full bg-slate-900/40 border border-slate-700/50 focus:border-emerald-500/50 rounded-xl py-4 pl-12 pr-4 text-white hover:bg-slate-900/60 transition-colors outline-none shadow-inner"
                          placeholder="e.g., Stanford University OR TechCorp"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Official Work / Institutional Email</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-400 transition-colors" size={18} />
                        <input 
                          type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="w-full bg-slate-900/40 border border-slate-700/50 focus:border-amber-500/50 rounded-xl py-4 pl-12 pr-4 text-white hover:bg-slate-900/60 transition-colors outline-none shadow-inner"
                          placeholder="hr@company.com OR dean@univ.edu"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-5 bg-gradient-to-r from-amber-500/5 to-emerald-500/5 border border-white/5 rounded-xl mt-4">
                    <ShieldCheck className="text-emerald-400 flex-shrink-0 mt-0.5" size={20} />
                    <p className="text-xs text-slate-300 leading-relaxed">
                      By submitting this form, you request a secure Tenant ID. Your organization will be whitelisted post-verification, ensuring top-level platform integrity.
                    </p>
                  </div>

                  <button 
                    type="submit" disabled={status === 'submitting'}
                    className="w-full bg-white hover:bg-slate-200 text-[#04060d] font-black py-4 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.15)] disabled:opacity-70 mt-6 hover:scale-[1.02]"
                  >
                    {status === 'submitting' ? (
                      <div className="w-5 h-5 border-2 border-slate-400 border-t-[#04060d] rounded-full animate-spin"></div>
                    ) : (
                      <>Submit Secure Request <ArrowRight size={18} /></>
                    )}
                  </button>
                  
                  <div className="text-center mt-6">
                    <Link to="/login" className="text-slate-500 hover:text-slate-300 text-sm font-bold transition-colors underline underline-offset-4">
                      Already have access? Log in here.
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