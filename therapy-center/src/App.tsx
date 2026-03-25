import { useEffect, useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
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
import Signup from './pages/Signup';
import SubscriptionSuccess from './pages/SubscriptionSuccess';
import SubscriptionCancel from './pages/SubscriptionCancel';
import AdminManagement from './pages/AdminManagement';
import NotificationCenter from './pages/NotificationCenter';
import GoalLibraryManager from './pages/GoalLibraryManager';
import FormsOverview from './pages/FormsOverview';
import TherapistNotifications from './pages/TherapistNotifications';
import BoardBuilder from './pages/BoardBuilder';
import ChatCenter from './pages/ChatCenter';
import LandingPage from './pages/LandingPage';
import LandingPageV2 from './pages/LandingPageV2';
import LandingPageV3 from './pages/LandingPageV3';
import AppShell from './components/AppShell';
import SubscriptionGate from './components/SubscriptionGate';
import TherapistShell from './components/TherapistShell';
import { setTherapistAuth, setParentAuth } from './api/client';
import './index.css';

// Scroll to top on route change — aggressive multi-strategy for iOS
function scrollToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function ScrollToTop() {
  const { pathname } = useLocation();

  // Before paint
  useLayoutEffect(() => {
    scrollToTop();
  }, [pathname]);

  // After paint + delayed fallback for iOS
  useEffect(() => {
    scrollToTop();
    requestAnimationFrame(scrollToTop);
    const t = setTimeout(scrollToTop, 50);
    return () => clearTimeout(t);
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
      <TherapistShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/kid/:kidId" element={<KidDetail />} />
          <Route path="/kid/:kidId/goals" element={<GoalsPage />} />
          <Route path="/forms" element={<FormsOverview />} />
          <Route path="/notifications" element={<TherapistNotifications />} />
          <Route path="/chat" element={<ChatCenter />} />
          <Route path="/form/new" element={<FormFill />} />
          <Route path="/form/:formId/edit" element={<FormFill />} />
          <Route path="/form/:formId/view" element={<FormView />} />
          <Route path="/meeting-form/:formId/view" element={<MeetingFormView />} />
          <Route path="*" element={<Navigate to={`/t/${practitionerId}`} replace />} />
        </Routes>
      </TherapistShell>
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
    <TherapistContext.Provider value={{ isTherapistView: false, isParentView: true, practitionerId: null, parentKidId: kidId || null }}>
      <Routes>
        <Route path="/" element={<KidDetail />} />
        <Route path="/chat" element={<ChatCenter />} />
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
      <AppShell>
        <SubscriptionGate>
          {children}
        </SubscriptionGate>
      </AppShell>
    </AuthGuard>
  );
}

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';

function App() {
  return (
    <PayPalScriptProvider options={{
      clientId: PAYPAL_CLIENT_ID,
      vault: true,
      intent: 'subscription',
      currency: 'ILS',
    }}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename="/therapy">
          <ScrollToTop />
          <Routes>
            {/* Public */}
            <Route path="/welcome" element={<LandingPage />} />
            <Route path="/welcome-v2" element={<LandingPageV2 />} />
            <Route path="/welcome-v3" element={<LandingPageV3 />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/subscription/success" element={<SubscriptionSuccess />} />
            <Route path="/subscription/cancel" element={<SubscriptionCancel />} />

            {/* Protected admin routes — wrapped in AppShell for sidebar navigation */}
            <Route path="/" element={<AdminLayout><Dashboard /></AdminLayout>} />
            <Route path="/kid/:kidId" element={<AdminLayout><KidDetail /></AdminLayout>} />
            <Route path="/kid/:kidId/goals" element={<AdminLayout><GoalsPage /></AdminLayout>} />
            <Route path="/forms" element={<AdminLayout><FormsOverview /></AdminLayout>} />
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
            <Route path="/chat" element={<AdminLayout><ChatCenter /></AdminLayout>} />
            <Route path="/board-builder" element={<AdminLayout><BoardBuilder /></AdminLayout>} />
            <Route path="/board-builder/:kidId" element={<AdminLayout><BoardBuilder /></AdminLayout>} />

            {/* Public board builder — PIN-protected, no admin auth */}
            <Route path="/build/:kidId" element={<BoardBuilder isPublic />} />

            {/* Therapist routes — no auth required, URL is the identity */}
            <Route path="/t/:practitionerId/*" element={<TherapistRoutes />} />

            {/* Parent read-only view — public, no auth */}
            <Route path="/p/:kidId/*" element={<ParentRoutes />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
    </PayPalScriptProvider>
  );
}

export default App;
