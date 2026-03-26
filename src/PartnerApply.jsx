import React, { useState } from 'react';
import { Building2, Mail, User, ShieldCheck, ArrowRight, CheckCircle } from 'lucide-react';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Link } from 'react-router-dom';

export default function PartnerApply() {
  const [formData, setFormData] = useState({
    contactName: '',
    universityName: '',
    email: ''
  });
  const [status, setStatus] = useState('idle'); // idle, submitting, success, error
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    try {
      await addDoc(collection(db, 'partner_applications'), {
        ...formData,
        status: 'pending', // Admin will change this to 'approved' later
        createdAt: serverTimestamp()
      });
      setStatus('success');
    } catch (error) {
      console.error("Application Error:", error);
      setErrorMsg("Failed to submit application. Please try again.");
      setStatus('idle');
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#1e293b]/80 border border-emerald-500/30 p-8 rounded-3xl text-center shadow-2xl shadow-emerald-500/10">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-emerald-400 w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Application Received</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Thank you for your interest in SkillNova Enterprise. Our team will review your application for <strong>{formData.universityName}</strong>. If approved, you will receive an activation link via email.
          </p>
          <Link to="/" className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-all">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 selection:bg-indigo-500/30">
      <div className="w-full max-w-lg">
        
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-6">
            <Building2 className="text-indigo-400 w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Enterprise Access</h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Partner with SkillNova to gain real-time curriculum insights and instant ATS simulation for your entire student cohort.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#1e293b]/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-5">
          
          {errorMsg && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm mb-4">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Contact Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                required
                value={formData.contactName}
                onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                className="w-full bg-slate-900/50 border border-slate-700 focus:border-indigo-500 rounded-xl py-3.5 pl-11 pr-4 text-white outline-none transition-colors"
                placeholder="Dr. Jane Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Official University Name</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                required
                value={formData.universityName}
                onChange={(e) => setFormData({...formData, universityName: e.target.value})}
                className="w-full bg-slate-900/50 border border-slate-700 focus:border-indigo-500 rounded-xl py-3.5 pl-11 pr-4 text-white outline-none transition-colors"
                placeholder="e.g., Stanford University"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Institutional Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="email" 
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full bg-slate-900/50 border border-slate-700 focus:border-indigo-500 rounded-xl py-3.5 pl-11 pr-4 text-white outline-none transition-colors"
                placeholder="dean@university.edu"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl mt-6">
            <ShieldCheck className="text-indigo-400 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-xs text-indigo-200/70 leading-relaxed">
              By applying, you request a secure Tenant ID. Your students will be able to access premium features seamlessly via email whitelisting. No passwords required for initial application.
            </p>
          </div>

          <button 
            type="submit" 
            disabled={status === 'submitting'}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 disabled:opacity-70 mt-4"
          >
            {status === 'submitting' ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>Submit Application <ArrowRight size={18} /></>
            )}
          </button>
          
          <div className="text-center mt-4">
            <Link to="/login" className="text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors">
              Already a partner? Log in here.
            </Link>
          </div>
        </form>

      </div>
    </div>
  );
}