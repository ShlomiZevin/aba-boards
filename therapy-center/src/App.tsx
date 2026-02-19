import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TherapistContext from './contexts/TherapistContext';
import Dashboard from './pages/Dashboard';
import KidDetail from './pages/KidDetail';
import GoalsPage from './pages/GoalsPage';
import FormFill from './pages/FormFill';
import FormView from './pages/FormView';
import AllPractitioners from './pages/AllPractitioners';
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/therapy">
        <ScrollToTop />
        <Routes>
          {/* Admin routes */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/kid/:kidId" element={<KidDetail />} />
          <Route path="/kid/:kidId/goals" element={<GoalsPage />} />
          <Route path="/form/new" element={<FormFill />} />
          <Route path="/form/:formId/edit" element={<FormFill />} />
          <Route path="/form/:formId/view" element={<FormView />} />

          <Route path="/practitioners" element={<AllPractitioners />} />

          {/* Therapist routes */}
          <Route path="/t/:practitionerId/*" element={<TherapistRoutes />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
