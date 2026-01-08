import { Suspense, ComponentType, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface LazyComponentProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function LazyComponent({ children, fallback }: LazyComponentProps) {
  const defaultFallback = (
    <Card className="w-full">
      <CardContent className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading...</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Suspense fallback={fallback || defaultFallback}>
      {children}
    </Suspense>
  );
}

// Higher-order component for lazy loading
export function withLazyLoading<P extends object>(
  Component: ComponentType<P>,
  fallback?: ReactNode
) {
  const LazyWrappedComponent = (props: P) => (
    <LazyComponent fallback={fallback}>
      <Component {...props} />
    </LazyComponent>
  );

  return LazyWrappedComponent;
}

// Predefined lazy components
export const LazyDashboardCharts = withLazyLoading(
  lazy(() => import('@/components/charts/DashboardCharts')),
  (
    <Card className="w-full">
      <CardContent className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading charts...</p>
        </div>
      </CardContent>
    </Card>
  )
);

export const LazyLeaveBalanceCard = withLazyLoading(
  lazy(() => import('@/components/LeaveBalanceCard')),
  (
    <Card className="w-full">
      <CardContent className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading leave balance...</p>
        </div>
      </CardContent>
    </Card>
  )
);

export const LazyNotificationBell = withLazyLoading(
  lazy(() => import('@/components/notifications/NotificationBell')),
  (
    <div className="p-2">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  )
);

export const LazyBulkActionsBar = withLazyLoading(
  lazy(() => import('@/components/bulk/BulkActionsBar')),
  (
    <Card className="w-full">
      <CardContent className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  )
);

export const LazyFaceRecognition = withLazyLoading(
  lazy(() => import('@/components/face-recognition/FaceRecognition')),
  (
    <Card className="w-full">
      <CardContent className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading face recognition...</p>
        </div>
      </CardContent>
    </Card>
  )
);

// Import React lazy
import { lazy } from 'react';
