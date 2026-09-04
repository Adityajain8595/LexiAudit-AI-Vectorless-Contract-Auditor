import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Scale, AlertCircle } from 'lucide-react';
import { supabase } from '../api/supabase';
import useAuthStore from '../store/authStore';

function parseHashParams(): Record<string, string> {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.substring(1)
    : window.location.hash;
  if (!hash) return {};
  const params: Record<string, string> = {};
  hash.split('&').forEach((part) => {
    const [k, v] = part.split('=');
    if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
  });
  return params;
}

export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function handleAuth() {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');
        const hashParams = parseHashParams();

        // 1. Check for explicit error parameters in URL
        const errorDesc =
          searchParams.get('error_description') ||
          searchParams.get('error') ||
          hashParams.error_description ||
          hashParams.error;
        const errorCode = searchParams.get('error_code') || hashParams.error_code;

        if (errorDesc) {
          if (mounted) {
            setError(errorCode ? `[${errorCode}] ${errorDesc}` : errorDesc);
            setDebugInfo(`URL: ${window.location.href}`);
          }
          return;
        }

        // Helper to complete sign-in and redirect
        const completeSignIn = (user: any, token: string) => {
          if (!mounted) return;
          sessionStorage.setItem('lexiaudit_token', token);
          setAuth(
            {
              id: user.id,
              email: user.email || '',
              user_metadata: user.user_metadata,
            },
            token
          );
          setTimeout(() => {
            if (mounted) {
              navigate('/workspace', { replace: true });
            }
          }, 100);
        };

        // 2. Check if Supabase already has a valid session
        const { data: currentSessionData } = await supabase.auth.getSession();
        if (currentSessionData?.session?.user && currentSessionData?.session?.access_token) {
          completeSignIn(currentSessionData.session.user, currentSessionData.session.access_token);
          return;
        }

        // 3. Handle Implicit Hash Flow (#access_token=...)
        if (hashParams.access_token) {
          const { data, error: setSessionErr } = await supabase.auth.setSession({
            access_token: hashParams.access_token,
            refresh_token: hashParams.refresh_token || '',
          });
          if (!setSessionErr && data?.user && data?.session?.access_token) {
            completeSignIn(data.user, data.session.access_token);
            return;
          }
        }

        // 4. Handle PKCE Code Flow (?code=...)
        if (code) {
          try {
            const { data, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
            if (!exchangeErr && data?.session?.user && data?.session?.access_token) {
              completeSignIn(data.session.user, data.session.access_token);
              return;
            } else if (exchangeErr) {
              console.warn('PKCE exchange error (may be handled by client listener):', exchangeErr.message);
            }
          } catch (e) {
            console.warn('exchangeCodeForSession caught exception:', e);
          }
        }

        // 5. Subscribe to onAuthStateChange as a reliable fallback
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session?.user && session?.access_token && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
            completeSignIn(session.user, session.access_token);
          }
        });

        // 6. Safety timeout if no session can be found
        const timer = setTimeout(async () => {
          if (!mounted) return;
          subscription.unsubscribe();

          // Final check on localStorage or session
          const { data: finalCheck } = await supabase.auth.getSession();
          if (finalCheck?.session?.user && finalCheck?.session?.access_token) {
            completeSignIn(finalCheck.session.user, finalCheck.session.access_token);
            return;
          }

          const existingToken = sessionStorage.getItem('lexiaudit_token');
          if (existingToken) {
            navigate('/workspace', { replace: true });
            return;
          }

          setError('Authentication timed out. Please verify your Supabase OAuth and redirect URL configurations.');
          setDebugInfo(`URL: ${window.location.href}`);
        }, 5000);

        return () => {
          clearTimeout(timer);
          subscription.unsubscribe();
        };
      } catch (err: any) {
        console.error('OAuth Callback Exception:', err);
        if (mounted) {
          setError(err.message || 'Authentication error occurred.');
          setDebugInfo(`Exception: ${err.message || String(err)}`);
        }
      }
    }

    const cleanupPromise = handleAuth();

    return () => {
      mounted = false;
      cleanupPromise.then((cleanup) => {
        if (typeof cleanup === 'function') cleanup();
      });
    };
  }, [navigate, setAuth]);

  return (
    <div className="min-h-screen bg-[#0C0806] flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-peach-400 to-peach-700 flex items-center justify-center shadow-lg shadow-peach-950/60 mb-6">
        <Scale size={24} className="text-slate-950" />
      </div>

      {error ? (
        <div className="glass-card rounded-2xl p-6 max-w-md border-red-500/30 flex flex-col items-center gap-3">
          <AlertCircle size={32} className="text-red-400" />
          <h2 className="text-sm font-bold text-slate-100">Sign-in Verification Failed</h2>
          <p className="text-xs text-red-300 leading-relaxed font-medium">{error}</p>
          {debugInfo && (
            <p className="text-[10px] text-slate-500 font-mono bg-black/40 p-2 rounded-lg break-all max-w-full text-left">
              {debugInfo}
            </p>
          )}
          <button
            onClick={() => navigate('/auth')}
            className="mt-2 px-4 py-2 rounded-xl bg-peach-500/20 text-peach-300 border border-peach-500/30 text-xs font-semibold hover:bg-peach-500/30 transition-all cursor-pointer"
          >
            Back to Sign In
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="text-peach-400 animate-spin" />
          <h2 className="text-sm font-bold text-slate-200">Authenticating with Google...</h2>
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
            Finalizing your secure session and setting up your contract audit workspace.
          </p>
        </div>
      )}
    </div>
  );
}
