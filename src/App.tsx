import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Reimbursement from "./pages/Reimbursement";
import TeamMap from "./pages/TeamMap";
import Attendance from "./pages/Attendance";
import History from "./pages/History";
import Locations from "./pages/Locations";
import Profile from "./pages/Profile";
import Corrections from "./pages/Corrections";
import Reports from "./pages/Reports";
import PayrollReport from "./pages/PayrollReport";
import EmployeeSalary from "./pages/EmployeeSalary";
import Payroll from "./pages/Payroll";
import PayrollDetail from "./pages/PayrollDetail";
import Employees from "./pages/Employees";
import Approvals from "./pages/Approvals";
import NotFound from "./pages/NotFound";
import OnboardingPage from "./pages/Onboarding";
import Shifts from "./pages/Shifts";
import ComingSoon from "./pages/ComingSoon";
import LeavePage from "./pages/Leave";
import OvertimePage from "./pages/Overtime";
import SalarySlips from "./pages/SalarySlips";
import FaceRegistrationPage from "./pages/FaceRegistration";
import QuickAttendancePage from "./pages/QuickAttendance";
import InformationPage from "./pages/Information";
import NotificationsPage from "./pages/Notifications";
import AgendaPage from "./pages/Agenda";
import Notes from "./pages/Notes";

const queryClient = new QueryClient();

import { App as CapacitorApp } from '@capacitor/app';

// Handle Hardware Back Button
const BackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleBackButton = async () => {
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        const currentPath = location.pathname;

        // Screens where back button should likely exit app or ask confirmation
        if (currentPath === '/dashboard' || currentPath === '/auth') {
          CapacitorApp.exitApp();
        } else {
          // Go back if possible
          navigate(-1);
        }
      });
    };

    handleBackButton();

    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, [navigate, location]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <BackButtonHandler />
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
              <Route path="/information" element={<ProtectedRoute><InformationPage /></ProtectedRoute>} />
              <Route path="/reimbursement" element={<ProtectedRoute><Reimbursement /></ProtectedRoute>} />
              <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
              <Route path="/quick-attendance" element={<ProtectedRoute><QuickAttendancePage /></ProtectedRoute>} />
              <Route path="/face-registration" element={<ProtectedRoute><FaceRegistrationPage /></ProtectedRoute>} />
              <Route path="/leave" element={<ProtectedRoute><LeavePage /></ProtectedRoute>} />
              <Route path="/overtime" element={<ProtectedRoute><OvertimePage /></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
              <Route path="/corrections" element={<ProtectedRoute><Corrections /></ProtectedRoute>} />
              <Route path="/salary-slips" element={<ProtectedRoute><SalarySlips /></ProtectedRoute>} />
              <Route path="/employees/:id/salary" element={<ProtectedRoute allowedRoles={['admin_hr']}><EmployeeSalary /></ProtectedRoute>} />
              <Route path="/team-map" element={<ProtectedRoute allowedRoles={['admin_hr', 'manager']}><TeamMap /></ProtectedRoute>} />
              <Route path="/locations" element={<ProtectedRoute allowedRoles={['admin_hr']}><Locations /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin_hr', 'manager']}><Reports /></ProtectedRoute>} />
              <Route path="/payroll-report" element={<ProtectedRoute allowedRoles={['admin_hr']}><PayrollReport /></ProtectedRoute>} />
              <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
              <Route path="/approvals" element={<ProtectedRoute allowedRoles={['admin_hr', 'manager']}><Approvals /></ProtectedRoute>} />
              <Route path="/payroll/:id" element={<ProtectedRoute allowedRoles={['admin_hr']}><PayrollDetail /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
              <Route path="/shifts" element={<ProtectedRoute allowedRoles={['admin_hr']}><Shifts /></ProtectedRoute>} />
              <Route path="/agenda" element={<ProtectedRoute><AgendaPage /></ProtectedRoute>} />
              <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
              <Route path="/coming-soon" element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
