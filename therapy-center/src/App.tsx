import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TherapistContext from './contexts/TherapistContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Dashboard from './pages/Dashboard';
import KidDetail from './pages/KidDetail';
import GoalsPage from './pages/GoalsPage';
import FormFill from './pages/FormFill';
import FormView from './pages/FormView';
import MeetingFormFill from './pages/MeetingFormFill';
import MeetingFormView from './pages/MeetingFormView';
import AllPractitioners from './pages/AllPractitioners';
import Login from './pages/Login';
import AdminManagement from './pages/AdminManagement';
import NotificationCenter from './pages/NotificationCenter';
import GoalLibraryManager from './pages/GoalLibraryManager';
import AppShell from './components/AppShell';
import { setTherapistAuth, setParentAuth } from './api/client';
import './index.css';

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function TherapistRoutes() {
  const { practitionerId } = useParams<{ practitionerId: string }>();

  // Set auth synchronously so children have it when they first render & query APIs
  setTherapistAuth(practitionerId || null);

  useEffect(() => {
    // Must also set in effect setup — React StrictMode double-invokes effects
    // (setup → cleanup → setup), so cleanup alone would leave _therapistId null.
    setTherapistAuth(practitionerId || null);
    return () => setTherapistAuth(null);
  }, [practitionerId]);

  return (
    <TherapistContext.Provider value={{ isTherapistView: true, isParentView: false, practitionerId: practitionerId || null }}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/kid/:kidId" element={<KidDetail />} />
        <Route path="/kid/:kidId/goals" element={<GoalsPage />} />
        <Route path="/form/new" element={<FormFill />} />
        <Route path="/form/:formId/edit" element={<FormFill />} />
        <Route path="/form/:formId/view" element={<FormView />} />
        <Route path="/meeting-form/:formId/view" element={<MeetingFormView />} />
        <Route path="*" element={<Navigate to={`/t/${practitionerId}`} replace />} />
      </Routes>
    </TherapistContext.Provider>
  );
}

function ParentRoutes() {
  const { kidId } = useParams<{ kidId: string }>();

  // Set auth synchronously so KidDetail queries have it on first render
  setParentAuth(kidId || null);

  useEffect(() => {
    // Must also set in effect setup — React StrictMode double-invokes effects
    // (setup → cleanup → setup), so cleanup alone would leave _parentKidId null.
    setParentAuth(kidId || null);
    return () => setParentAuth(null);
  }, [kidId]);

  return (
    <TherapistContext.Provider value={{ isTherapistView: false, isParentView: true, practitionerId: null }}>
      <Routes>
        <Route path="/" element={<KidDetail />} />
        <Route path="/form/:formId/view" element={<FormView />} />
        <Route path="/meeting-form/:formId/view" element={<MeetingFormView />} />
        <Route path="*" element={<Navigate to={`/p/${kidId}`} replace />} />
      </Routes>
    </TherapistContext.Provider>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename="/therapy">
          <ScrollToTop />
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected admin routes — wrapped in AppShell for sidebar navigation */}
            <Route path="/" element={<AdminLayout><Dashboard /></AdminLayout>} />
            <Route path="/kid/:kidId" element={<AdminLayout><KidDetail /></AdminLayout>} />
            <Route path="/kid/:kidId/goals" element={<AdminLayout><GoalsPage /></AdminLayout>} />
            <Route path="/goal-library" element={<AdminLayout><GoalLibraryManager /></AdminLayout>} />
            <Route path="/form/new" element={<AdminLayout><FormFill /></AdminLayout>} />
            <Route path="/form/:formId/edit" element={<AdminLayout><FormFill /></AdminLayout>} />
            <Route path="/form/:formId/view" element={<AdminLayout><FormView /></AdminLayout>} />
            <Route path="/meeting-form/new" element={<AdminLayout><MeetingFormFill /></AdminLayout>} />
            <Route path="/meeting-form/:formId/edit" element={<AdminLayout><MeetingFormFill /></AdminLayout>} />
            <Route path="/meeting-form/:formId/view" element={<AdminLayout><MeetingFormView /></AdminLayout>} />
            <Route path="/practitioners" element={<AdminLayout><AllPractitioners /></AdminLayout>} />
            <Route path="/notifications" element={<AdminLayout><NotificationCenter /></AdminLayout>} />
            <Route path="/admin-management" element={<AdminLayout><AdminManagement /></AdminLayout>} />

            {/* Therapist routes — no auth required, URL is the identity */}
            <Route path="/t/:practitionerId/*" element={<TherapistRoutes />} />

            {/* Parent read-only view — public, no auth */}
            <Route path="/p/:kidId/*" element={<ParentRoutes />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
