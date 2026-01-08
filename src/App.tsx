import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/reimbursement" element={<ProtectedRoute><Reimbursement /></ProtectedRoute>} />
              <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
              <Route path="/leave" element={<ProtectedRoute><LeavePage /></ProtectedRoute>} />
              <Route path="/overtime" element={<ProtectedRoute><OvertimePage /></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
              <Route path="/corrections" element={<ProtectedRoute><Corrections /></ProtectedRoute>} />
              <Route path="/employees/:id/salary" element={<ProtectedRoute allowedRoles={['admin_hr']}><EmployeeSalary /></ProtectedRoute>} />
              <Route path="/team-map" element={<ProtectedRoute allowedRoles={['admin_hr', 'manager']}><TeamMap /></ProtectedRoute>} />
              <Route path="/locations" element={<ProtectedRoute allowedRoles={['admin_hr']}><Locations /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin_hr', 'manager']}><Reports /></ProtectedRoute>} />
              <Route path="/payroll-report" element={<ProtectedRoute allowedRoles={['admin_hr']}><PayrollReport /></ProtectedRoute>} />
              <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
              <Route path="/approval" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
              <Route path="/payroll/:id" element={<ProtectedRoute allowedRoles={['admin_hr']}><PayrollDetail /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
              <Route path="/shifts" element={<ProtectedRoute allowedRoles={['admin_hr']}><Shifts /></ProtectedRoute>} />
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
