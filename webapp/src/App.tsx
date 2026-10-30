import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppShell from './components/AppShell';
import OverviewPage from './pages/OverviewPage';
import ImageAnalysisPage from './pages/ImageAnalysisPage';
import HotspotMapPage from './pages/HotspotMapPage';
import AnalyticsPage from './pages/AnalyticsPage';
import HistoryPage from './pages/HistoryPage';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ReportDetailPage from './pages/ReportDetailPage';

/**
 * Redirects unauthenticated users to /login.
 * Redirects authenticated non-admins away from admin-only routes.
 */
function ProtectedRoute({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const { user, isLoading, authError } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <span className="inline-block w-8 h-8 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user && authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="card max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold text-gray-900">Unable to verify your session</h1>
          <p className="mt-2 text-sm text-gray-600">{authError}</p>
          <button className="btn-primary mt-5" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected shell */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="analysis" element={<ImageAnalysisPage />} />
        <Route path="reports/:reportId" element={<ReportDetailPage />} />
        <Route
          path="admin/reports"
          element={
            <ProtectedRoute adminOnly>
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="map"
          element={
            <ProtectedRoute adminOnly>
              <HotspotMapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="analytics"
          element={
            <ProtectedRoute adminOnly>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route path="history" element={<HistoryPage />} />
        <Route path="about" element={<AboutPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
