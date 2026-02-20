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
import AllPractitioners from './pages/AllPractitioners';
import Login from './pages/Login';
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

  return (
    <TherapistContext.Provider value={{ isTherapistView: true, practitionerId: practitionerId || null }}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/kid/:kidId" element={<KidDetail />} />
        <Route path="/kid/:kidId/goals" element={<GoalsPage />} />
        <Route path="/form/new" element={<FormFill />} />
        <Route path="/form/:formId/edit" element={<FormFill />} />
        <Route path="/form/:formId/view" element={<FormView />} />
        <Route path="*" element={<Navigate to={`/t/${practitionerId}`} replace />} />
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename="/therapy">
          <ScrollToTop />
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected admin routes */}
            <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/kid/:kidId" element={<AuthGuard><KidDetail /></AuthGuard>} />
            <Route path="/kid/:kidId/goals" element={<AuthGuard><GoalsPage /></AuthGuard>} />
            <Route path="/form/new" element={<AuthGuard><FormFill /></AuthGuard>} />
            <Route path="/form/:formId/edit" element={<AuthGuard><FormFill /></AuthGuard>} />
            <Route path="/form/:formId/view" element={<AuthGuard><FormView /></AuthGuard>} />
            <Route path="/practitioners" element={<AuthGuard><AllPractitioners /></AuthGuard>} />

            {/* Therapist routes */}
            <Route path="/t/:practitionerId/*" element={<AuthGuard><TherapistRoutes /></AuthGuard>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
