import { lazy } from 'react';

// Lazy load pages for code splitting
export const LazyAuth = lazy(() => import('@/pages/Auth'));
export const LazyDashboard = lazy(() => import('@/pages/Dashboard'));
export const LazyAttendance = lazy(() => import('@/pages/Attendance'));
export const LazyHistory = lazy(() => import('@/pages/History'));
export const LazyLeave = lazy(() => import('@/pages/Leave'));
export const LazyOvertime = lazy(() => import('@/pages/Overtime'));
export const LazyEmployees = lazy(() => import('@/pages/Employees'));
export const LazyApprovals = lazy(() => import('@/pages/Approvals'));
export const LazyLocations = lazy(() => import('@/pages/Locations'));
export const LazyProfile = lazy(() => import('@/pages/Profile'));
export const LazyCorrections = lazy(() => import('@/pages/Corrections'));
export const LazyReports = lazy(() => import('@/pages/Reports'));
export const LazySettings = lazy(() => import('@/pages/Settings'));
export const LazyPayroll = lazy(() => import('@/pages/Payroll'));
export const LazyPayrollDetail = lazy(() => import('@/pages/PayrollDetail'));
export const LazyEmployeeSalary = lazy(() => import('@/pages/EmployeeSalary'));
export const LazyPayrollReport = lazy(() => import('@/pages/PayrollReport'));
export const LazyNotFound = lazy(() => import('@/pages/NotFound'));

// Lazy load feature-specific components
export const LazyFaceRecognition = lazy(() => import('@/components/face-recognition/FaceRecognition'));
export const LazyAdvancedSearch = lazy(() => import('@/components/search/AdvancedSearch'));
export const LazyFilterPresets = lazy(() => import('@/components/filters/FilterPresets'));
export const LazyVirtualTable = lazy(() => import('@/components/table/VirtualTable'));

// Lazy load chart components
export const LazyAttendanceTrendChart = lazy(() => import('@/components/charts/AttendanceTrendChart'));
export const LazyLeaveUsageChart = lazy(() => import('@/components/charts/LeaveUsageChart'));
export const LazyOvertimeChart = lazy(() => import('@/components/charts/OvertimeChart'));
export const LazyDashboardCharts = lazy(() => import('@/components/charts/DashboardCharts'));

// Lazy load heavy utilities
export const LazyPdfGenerator = lazy(() => import('@/lib/pdfGenerator'));

// Preload critical components
export const preloadCriticalComponents = () => {
  // Preload dashboard (most critical)
  import('@/pages/Dashboard');
  
  // Preload auth (for login flow)
  import('@/pages/Auth');
  
  // Preload attendance (most used feature)
  import('@/pages/Attendance');
};

// Preload components based on user role
export const preloadComponentsByRole = (role: string) => {
  switch (role) {
    case 'admin_hr':
      import('@/pages/Employees');
      import('@/pages/Payroll');
      import('@/pages/Approvals');
      break;
    case 'manager':
      import('@/pages/Approvals');
      import('@/pages/Reports');
      break;
    case 'employee':
      import('@/pages/Leave');
      import('@/pages/Overtime');
      break;
  }
};

// Preload components based on route
export const preloadComponentsByRoute = (path: string) => {
  const routeMap: Record<string, () => Promise<any>> = {
    '/dashboard': () => import('@/pages/Dashboard'),
    '/attendance': () => import('@/pages/Attendance'),
    '/history': () => import('@/pages/History'),
    '/leave': () => import('@/pages/Leave'),
    '/overtime': () => import('@/pages/Overtime'),
    '/employees': () => import('@/pages/Employees'),
    '/approvals': () => import('@/pages/Approvals'),
    '/payroll': () => import('@/pages/Payroll'),
    '/reports': () => import('@/pages/Reports'),
    '/settings': () => import('@/pages/Settings'),
    '/profile': () => import('@/pages/Profile'),
  };

  const preloadFn = routeMap[path];
  if (preloadFn) {
    preloadFn();
  }
};

// Intersection Observer for lazy loading
export const createIntersectionObserver = (callback: () => void, options?: IntersectionObserverInit) => {
  return new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        callback();
      }
    });
  }, options);
};

// Preload on hover
export const preloadOnHover = (preloadFn: () => Promise<any>) => {
  let timeoutId: NodeJS.Timeout;
  
  return () => {
    timeoutId = setTimeout(() => {
      preloadFn();
    }, 200); // 200ms delay
    
    return () => {
      clearTimeout(timeoutId);
    };
  };
};

// Bundle size monitoring
export const getBundleSizeInfo = () => {
  // In production, you would use webpack-bundle-analyzer or similar
  // This is a placeholder for demonstration
  return {
    estimatedSize: '2.5MB',
    chunks: [
      { name: 'main', size: '1.2MB' },
      { name: 'vendor', size: '800KB' },
      { name: 'charts', size: '300KB' },
      { name: 'face-api', size: '500KB' },
    ]
  };
};

// Performance monitoring
export const measurePerformance = (name: string, fn: () => void) => {
  const start = performance.now();
  fn();
  const end = performance.now();
  
  console.log(`${name} took ${end - start} milliseconds`);
  
  return end - start;
};

// Memory usage monitoring
export const getMemoryUsage = () => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: Math.round(memory.usedJSHeapSize / 1048576), // MB
      total: Math.round(memory.totalJSHeapSize / 1048576), // MB
      limit: Math.round(memory.jsHeapSizeLimit / 1048576) // MB
    };
  }
  return null;
};
