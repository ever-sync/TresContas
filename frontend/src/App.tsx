import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import AppErrorBoundary from './components/AppErrorBoundary';
import { queryClient } from './lib/queryClient';
import { useAuthStore } from './stores/useAuthStore';
import { useClientAuthStore } from './stores/useClientAuthStore';
import { bootstrapAuthSessions } from './lib/authSession';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));
const ClientLogin = lazy(() => import('./pages/ClientLogin'));
const HeroPage = lazy(() => import('./pages/HeroPage'));

const AuthSessionBootstrap = () => {
  const didBootstrapRef = useRef(false);

  useEffect(() => {
    if (didBootstrapRef.current) {
      return;
    }

    didBootstrapRef.current = true;
    void bootstrapAuthSessions();
  }, []);

  return null;
};

/**
 * Requires admin or collaborator authentication.
 * Redirects to /login if not authenticated.
 */
const RequireStaff = ({ children }: { children: React.ReactNode }) => {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === 'unknown') {
    return <RouteLoadingScreen />;
  }

  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

/**
 * Requires client authentication.
 * Redirects to /client-login if not authenticated.
 */
const RequireClient = ({ children }: { children: React.ReactNode }) => {
  const status = useClientAuthStore((state) => state.status);
  const client = useClientAuthStore((state) => state.client);

  if (status === 'unknown') {
    return <RouteLoadingScreen />;
  }

  if (status !== 'authenticated' || !client) {
    return <Navigate to="/client-login" replace />;
  }
  return children;
};

/**
 * Only shows content when no staff user is logged in.
 */
const PublicOnly = ({ children }: { children: React.ReactNode }) => {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === 'unknown') {
    return <RouteLoadingScreen />;
  }

  if (status === 'authenticated' && user) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const PublicClientOnly = ({ children }: { children: React.ReactNode }) => {
  const status = useClientAuthStore((state) => state.status);
  const client = useClientAuthStore((state) => state.client);

  if (status === 'unknown') {
    return <RouteLoadingScreen />;
  }

  if (status === 'authenticated' && client) {
    return <Navigate to="/portal" replace />;
  }

  return children;
};

const RouteLoadingScreen = () => (
  <div className="min-h-screen bg-[#08111f] text-slate-200 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-400" />
      <p className="text-sm tracking-[0.18em] uppercase text-slate-400">Carregando modulo</p>
    </div>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0f172a',
            color: '#e2e8f0',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
          },
          success: {
            iconTheme: { primary: '#06b6d4', secondary: '#0f172a' },
          },
          error: {
            iconTheme: { primary: '#f43f5e', secondary: '#0f172a' },
          },
        }}
      />
      <Router>
        <AuthSessionBootstrap />
        <Suspense fallback={<RouteLoadingScreen />}>
          <AppErrorBoundary>
            <Routes>
              {/* Public routes */}
              <Route path="/hero" element={<HeroPage />} />
              <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
              <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
              <Route path="/client-login" element={<PublicClientOnly><ClientLogin /></PublicClientOnly>} />

              {/* Staff routes (admin + collaborator see same dashboard) */}
              <Route path="/dashboard" element={<RequireStaff><Dashboard /></RequireStaff>} />

              {/* Client portal (read-only) */}
              <Route path="/portal" element={<RequireClient><ClientDashboard /></RequireClient>} />

              {/* Staff viewing specific client */}
              <Route path="/client/:id" element={<RequireStaff><ClientDashboard /></RequireStaff>} />

              <Route path="/" element={<Navigate to="/login" replace />} />
            </Routes>
          </AppErrorBoundary>
        </Suspense>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
