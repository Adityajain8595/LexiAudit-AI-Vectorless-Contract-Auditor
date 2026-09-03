import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import AuthCallback from './pages/AuthCallback';
import Workspace from './pages/Workspace';
import useAuthStore from './store/authStore';
import { supabase } from './api/supabase';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated() ? <>{children}</> : <Navigate to="/auth" replace />;
}

export default function App() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);

  // Sync auth events during this active session
  useEffect(() => {
    // Clean up any legacy localStorage remnants from older versions
    try {
      localStorage.removeItem('lexiaudit_token');
      localStorage.removeItem('lexiaudit-auth');
    } catch (_) {}

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only set auth if there is an active session and token in this browser session
      if (session && session.user && session.access_token && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        setAuth(
          {
            id: session.user.id,
            email: session.user.email || '',
            user_metadata: session.user.user_metadata,
          },
          session.access_token
        );
      } else if (event === 'SIGNED_OUT') {
        logout();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setAuth, logout]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/workspace"
        element={
          <ProtectedRoute>
            <Workspace />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
