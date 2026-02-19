import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ClientDashboard from './pages/ClientDashboard';
import ClientLogin from './pages/ClientLogin';
import HeroPage from './pages/HeroPage';
import { useAuthStore } from './stores/useAuthStore';
import { useClientAuthStore } from './stores/useClientAuthStore';

const queryClient = new QueryClient();

/**
 * Requires admin or collaborator authentication.
 * Redirects to /login if not authenticated.
 */
const RequireStaff = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

/**
 * Requires client authentication.
 * Redirects to /client-login if not authenticated.
 */
const RequireClient = ({ children }: { children: React.ReactNode }) => {
  const token = useClientAuthStore((state) => state.token);
  if (!token) {
    return <Navigate to="/client-login" replace />;
  }
  return children;
};

/**
 * Only shows content when no staff user is logged in.
 */
const PublicOnly = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

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
        <Routes>
          {/* Public routes */}
          <Route path="/hero" element={<HeroPage />} />
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
          <Route path="/client-login" element={<ClientLogin />} />

          {/* Staff routes (admin + collaborator see same dashboard) */}
          <Route path="/dashboard" element={<RequireStaff><Dashboard /></RequireStaff>} />

          {/* Client portal (read-only) */}
          <Route path="/portal" element={<RequireClient><ClientDashboard /></RequireClient>} />

          {/* Staff viewing specific client */}
          <Route path="/client/:id" element={<RequireStaff><ClientDashboard /></RequireStaff>} />

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
