import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import { login as apiLogin, signup as apiSignup } from '../api/client';
import { supabase, signInWithGoogle } from '../api/supabase';
import useAuthStore from '../store/authStore';

type Mode = 'signin' | 'signup';

function GoogleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2s.7 5.5 1.9 7.9l3.7-2.9z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
      />
    </svg>
  );
}

export default function Auth() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  // Explicitly do not auto-redirect so the user is always presented with the authentication prompt

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize Google Sign-in');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      if (mode === 'signup') {
        try {
          await apiSignup(email, password);
        } catch (apiErr) {
          // Direct Supabase sign up fallback if backend is starting up
          const { error: supaErr } = await supabase.auth.signUp({ email, password });
          if (supaErr) throw supaErr;
        }
        setSuccess('Account created successfully! Please sign in with your email and password.');
        setPassword('');
        setMode('signin');
      } else {
        try {
          const res = await apiLogin(email, password);
          setAuth({ id: res.data.user_id, email }, res.data.access_token);
          navigate('/workspace');
        } catch (apiErr) {
          // Direct Supabase sign in fallback if backend is offline/starting up
          const { data: supaData, error: supaErr } = await supabase.auth.signInWithPassword({ email, password });
          if (supaErr || !supaData.session) throw apiErr;
          setAuth(
            {
              id: supaData.user.id,
              email: supaData.user.email || email,
              user_metadata: supaData.user.user_metadata,
            },
            supaData.session.access_token
          );
          navigate('/workspace');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0806] flex flex-col items-center justify-center px-4 relative overflow-hidden font-sans">
      {/* Background Peach radial glows */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 55% at 50% 40%, rgba(242, 122, 82, 0.12) 0%, transparent 70%)',
        }}
      />

      {/* Back to home Logo */}
      <Link
        to="/"
        className="relative z-10 flex items-center gap-3 mb-8 text-slate-300 hover:text-peach-300 transition-colors group"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-peach-400 to-peach-700 flex items-center justify-center shadow-lg shadow-peach-950/60 group-hover:scale-105 transition-transform">
          <Scale size={18} className="text-slate-950" />
        </div>
        <span className="font-display font-bold text-xl tracking-wide text-slate-100">
          LexiAudit <span className="text-peach-400 text-sm font-sans font-medium">AI</span>
        </span>
      </Link>

      {/* Auth Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 rounded-3xl p-8 w-full max-w-md border border-[#F27A52]/25 bg-gradient-to-b from-[#18110D]/95 to-[#100B08]/95 backdrop-blur-2xl shadow-2xl shadow-black/80"
      >
        {/* Mode Toggle */}
        <div className="flex rounded-2xl bg-[#100B08] p-1.5 mb-6 border border-[#F27A52]/15">
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setSuccess(''); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                mode === m
                  ? 'bg-gradient-to-r from-[#F27A52] to-[#D95D34] text-[#080504] shadow-md shadow-[#330F04]/70'
                  : 'text-[#A0785D] hover:text-[#FFFDF9]'
              }`}
            >
              {m === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: mode === 'signin' ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === 'signin' ? 10 : -10 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="text-2xl font-bold text-[#FFFDF9] mb-1 font-display">
              {mode === 'signin' ? 'Welcome back' : 'Get started'}
            </h1>
            <p className="text-xs text-[#A0785D] mb-6 font-sans">
              {mode === 'signin'
                ? 'Sign in to access your audited contract portfolios.'
                : 'Autonomous legal tree reasoning with verified citations.'}
            </p>

            {/* Google Sign-in Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-3 bg-[#1A120D] hover:bg-[#251B13] text-[#FFFDF9] border border-[#F27A52]/20 hover:border-[#F27A52]/50 font-medium py-3.5 px-4 rounded-xl transition-all shadow-md hover:shadow-[#330F04]/40 cursor-pointer disabled:opacity-60"
            >
              {googleLoading ? (
                <Loader2 size={18} className="animate-spin text-[#FFAF8E]" />
              ) : (
                <GoogleIcon className="w-4 h-4 shrink-0" />
              )}
              <span className="text-xs sm:text-sm font-semibold">
                {googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
              </span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[#F27A52]/15" />
              <span className="text-[10px] font-semibold text-[#A0785D] uppercase tracking-wider">
                or continue with email
              </span>
              <div className="flex-1 h-px bg-[#F27A52]/15" />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              {/* Email */}
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0785D] pointer-events-none" />
                <input
                  type="email"
                  placeholder="name@organization.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl text-xs sm:text-sm bg-[#120C08] text-[#FFFDF9] placeholder-[#755541] outline-none border border-[#F27A52]/20 focus:border-[#F27A52]/70 transition-colors"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0785D] pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3.5 rounded-xl text-xs sm:text-sm bg-[#120C08] text-[#FFFDF9] placeholder-[#755541] outline-none border border-[#F27A52]/20 focus:border-[#F27A52]/70 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A0785D] hover:text-[#FFFDF9] transition-colors cursor-pointer"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Feedback messages */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2.5 text-red-400 text-xs bg-red-500/10 border border-red-500/25 rounded-xl p-3"
                  >
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2.5 text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3"
                  >
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                    <span>{success}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#F27A52] to-[#D95D34] hover:from-[#FFAF8E] hover:to-[#F27A52] disabled:opacity-60 text-[#080504] font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#330F04]/80 mt-1 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[#080504]/30 border-t-[#080504] rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{mode === 'signin' ? 'Sign In with Email' : 'Create Free Account'}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-[#F27A52]/15 flex items-center justify-center gap-2 text-[11px] text-[#A0785D]">
              <ShieldCheck size={13} className="text-[#FFAF8E]" />
              <span>Vectorless Tree Search · Enterprise Auth Security</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
