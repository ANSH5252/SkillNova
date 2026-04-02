import React, { useState } from 'react';
import { Building2, Mail, User, ShieldCheck, ArrowRight, CheckCircle, Activity, Globe, Users } from 'lucide-react';
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
      setErrorMsg("Failed to submit application. Please check your connection.");
      setStatus('idle');
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#04060d] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0a0f1c]/80 border border-emerald-500/30 p-8 rounded-3xl text-center shadow-2xl shadow-emerald-500/10 animate-fade-in-up">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CheckCircle className="text-emerald-400 w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Application Received!</h2>
          <p className="text-slate-400 mb-6 leading-relaxed">
            Your request for **{formData.companyName}** has been securely transmitted. Our partnership team will review your profile shortly.
          </p>
          
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-xl mb-8 text-left">
            <h4 className="text-emerald-300 font-bold text-sm mb-3 flex items-center gap-2">
              <Activity size={18} /> Verification Status
            </h4>
            <p className="text-sm text-emerald-200/90 leading-relaxed mb-4">
              We manually verify all hiring partners to maintain a high-quality talent pool for our students.
            </p>
            <ul className="text-xs text-emerald-300/60 space-y-3 mt-4 pt-4 border-t border-emerald-500/20">
              <li className="flex items-start gap-2">
                <ArrowRight size={14} className="mt-0.5 flex-shrink-0 text-emerald-400"/> 
                <span>You will receive an invite code at **{formData.email}**.</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight size={14} className="mt-0.5 flex-shrink-0 text-emerald-400"/> 
                <span>Use this code to activate your dashboard and post your first role.</span>
              </li>
            </ul>
          </div>
          
          <Link to="/" className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all inline-block w-full shadow-lg">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04060d] flex items-center justify-center p-4 selection:bg-indigo-500/30">
        {/* Ambient background */}
      <div className="fixed top-0 right-0 w-[800px] h-[500px] bg-emerald-500/5 blur-[150px] rounded-full pointer-events-none z-0"></div>

      <div className="w-full max-w-lg relative z-10">
        
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <Building2 className="text-emerald-400 w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">Hire with SkillNova</h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto font-medium">
            Gain access to a pre-vetted pipeline of students whose technical skills match your exact industry needs.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl space-y-5">
          
          {errorMsg && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm mb-4">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-slate-500 text-[10px] font-bold mb-2 uppercase tracking-wider">Contact Person</label>
                <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                    <input 
                        type="text" 
                        required
                        value={formData.contactName}
                        onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                        className="w-full bg-[#1e293b]/50 border border-white/10 focus:border-emerald-500 rounded-xl py-3 pl-11 pr-4 text-white text-sm outline-none transition-colors"
                        placeholder="John Smith"
                    />
                </div>
            </div>
            <div>
                <label className="block text-slate-500 text-[10px] font-bold mb-2 uppercase tracking-wider">Company Name</label>
                <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                    <input 
                        type="text" 
                        required
                        value={formData.companyName}
                        onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                        className="w-full bg-[#1e293b]/50 border border-white/10 focus:border-emerald-500 rounded-xl py-3 pl-11 pr-4 text-white text-sm outline-none transition-colors"
                        placeholder="TechCorp Inc."
                    />
                </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-500 text-[10px] font-bold mb-2 uppercase tracking-wider">Work Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
              <input 
                type="email" 
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full bg-[#1e293b]/50 border border-white/10 focus:border-emerald-500 rounded-xl py-3 pl-11 pr-4 text-white text-sm outline-none transition-colors"
                placeholder="hiring@techcorp.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-slate-500 text-[10px] font-bold mb-2 uppercase tracking-wider">Industry</label>
                <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                    <input 
                        type="text" 
                        required
                        value={formData.industry}
                        onChange={(e) => setFormData({...formData, industry: e.target.value})}
                        className="w-full bg-[#1e293b]/50 border border-white/10 focus:border-emerald-500 rounded-xl py-3 pl-11 pr-4 text-white text-sm outline-none transition-colors"
                        placeholder="Software / AI"
                    />
                </div>
            </div>
            <div>
                <label className="block text-slate-500 text-[10px] font-bold mb-2 uppercase tracking-wider">Hiring Scale (Year)</label>
                <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                    <select 
                        value={formData.hiringScale}
                        onChange={(e) => setFormData({...formData, hiringScale: e.target.value})}
                        className="w-full bg-[#1e293b]/50 border border-white/10 focus:border-emerald-500 rounded-xl py-3 pl-11 pr-4 text-white text-sm outline-none transition-colors appearance-none cursor-pointer"
                    >
                        <option value="1-10">1-10 Students</option>
                        <option value="11-50">11-50 Students</option>
                        <option value="51-200">51-200 Students</option>
                        <option value="200+">200+ Students</option>
                    </select>
                </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl mt-6">
            <ShieldCheck className="text-emerald-400 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-xs text-emerald-200/70 leading-relaxed font-medium">
              By applying, you agree to our terms of service. We maintain a secure ecosystem and verify every account for safety.
            </p>
          </div>

          <button 
            type="submit" 
            disabled={status === 'submitting'}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-70 mt-4"
          >
            {status === 'submitting' ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>Submit Partner Request <ArrowRight size={18} /></>
            )}
          </button>
          
          <div className="text-center mt-4">
            <Link to="/login" className="text-slate-500 hover:text-slate-300 text-xs font-bold uppercase tracking-wider transition-colors">
              Already have an invite? Log in
            </Link>
          </div>
        </form>

      </div>
    </div>
  );
}
