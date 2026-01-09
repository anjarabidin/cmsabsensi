import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FaceRegistration } from '@/components/face-registration/FaceRegistration';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, User, CheckCircle, AlertCircle, Camera, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function FaceRegistrationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hasFaceEnrollment, setHasFaceEnrollment] = useState(false);
  const [faceSettings, setFaceSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkFaceEnrollment();
  }, [user]);

  const checkFaceEnrollment = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Check if user has face enrollment
      const { data } = await supabase
        .rpc('has_face_enrollment', { p_user_id: user.id });

      setHasFaceEnrollment(data || false);

      // Load face settings
      const { data: settings } = await supabase
        .rpc('get_face_settings', { p_user_id: user.id });

      setFaceSettings(settings?.[0] || {
        is_enabled: true,
        confidence_threshold: 0.7,
        max_attempts: 3,
        lockout_duration_minutes: 5,
        require_liveness_check: false,
        fallback_to_pin: true
      });

    } catch (error) {
      console.error('Error checking face enrollment:', error);
      setError('Failed to load face enrollment status');
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrationComplete = (success: boolean, data?: any) => {
    if (success) {
      setRegistrationComplete(true);
      setHasFaceEnrollment(true);
      setError('');
    } else {
      setError(data?.message || 'Face registration failed');
    }
  };

  const handleGoToSettings = () => {
    navigate('/settings?tab=face-recognition');
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading face registration status...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pt-[calc(1.5rem+env(safe-area-inset-top))] md:pt-0 pb-10 px-4 md:px-0">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Face Registration</h1>
            <p className="text-muted-foreground">
              Register your face for biometric authentication
            </p>
          </div>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Face Enrollment Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${hasFaceEnrollment ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <div>
                  <div className="font-medium">
                    {hasFaceEnrollment ? 'Face Registered' : 'No Face Registration'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {hasFaceEnrollment
                      ? 'Your face is registered for biometric authentication'
                      : 'Register your face to enable face recognition authentication'
                    }
                  </div>
                </div>
              </div>
              <Badge variant={hasFaceEnrollment ? 'default' : 'secondary'}>
                {hasFaceEnrollment ? '✅ Complete' : '⏳ Pending'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Face Registration Component */}
        {!hasFaceEnrollment && !registrationComplete && (
          <FaceRegistration onComplete={handleRegistrationComplete} />
        )}

        {/* Registration Complete */}
        {registrationComplete && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-green-800">Face Registration Complete!</h3>
                  <p className="text-green-600 mt-1">
                    Your face has been successfully registered for biometric authentication.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    You can now use face recognition for:
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Badge variant="outline">Clock In</Badge>
                    <Badge variant="outline">Clock Out</Badge>
                    <Badge variant="outline">Secure Login</Badge>
                    <Badge variant="outline">Quick Verification</Badge>
                  </div>
                </div>

                <div className="flex gap-2 justify-center">
                  <Button onClick={handleGoToSettings}>
                    <Settings className="h-4 w-4 mr-2" />
                    Face Settings
                  </Button>
                  <Button variant="outline" onClick={handleGoToDashboard}>
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Already Registered */}
        {hasFaceEnrollment && !registrationComplete && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Camera className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-blue-800">Face Already Registered</h3>
                  <p className="text-blue-600 mt-1">
                    Your face is already registered for biometric authentication.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Current settings:
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Badge variant="outline">
                      Threshold: {(faceSettings?.confidence_threshold * 100).toFixed(0)}%
                    </Badge>
                    <Badge variant="outline">
                      Max Attempts: {faceSettings?.max_attempts}
                    </Badge>
                    <Badge variant="outline">
                      Fallback: {faceSettings?.fallback_to_pin ? 'PIN' : 'None'}
                    </Badge>
                  </div>
                </div>

                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={handleGoToSettings}>
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Settings
                  </Button>
                  <Button onClick={handleGoToDashboard}>
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Face Recognition Benefits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Fast & Convenient
                </h4>
                <p className="text-sm text-muted-foreground">
                  Clock in/out instantly with just your face
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Highly Secure
                </h4>
                <p className="text-sm text-muted-foreground">
                  Biometric authentication with confidence scoring
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Fallback Options
                </h4>
                <p className="text-sm text-muted-foreground">
                  PIN and password options if face recognition fails
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Audit Trail
                </h4>
                <p className="text-sm text-muted-foreground">
                  Complete logging of all authentication attempts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
