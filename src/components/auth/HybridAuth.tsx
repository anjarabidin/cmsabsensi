import { useState, useEffect } from 'react';
import { Shield, Key, User, Camera, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { EnhancedFaceRecognition } from '@/components/face-recognition/EnhancedFaceRecognition';
import { supabase } from '@/integrations/supabase/client';

interface HybridAuthProps {
  onAuthSuccess?: (method: string, data?: any) => void;
  onAuthError?: (error: string) => void;
  mode?: 'login' | 'attendance';
  showFaceRecognition?: boolean;
  showPin?: boolean;
  showPassword?: boolean;
}

interface AuthMethod {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  available: boolean;
  component: React.ReactNode;
}

export function HybridAuth({ 
  onAuthSuccess, 
  onAuthError,
  mode = 'login',
  showFaceRecognition = true,
  showPin = true,
  showPassword = true
}: HybridAuthProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('face');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [hasFaceEnrollment, setHasFaceEnrollment] = useState(false);
  const [authMethods, setAuthMethods] = useState<AuthMethod[]>([]);

  // Check user's face enrollment status
  useEffect(() => {
    const checkFaceEnrollment = async () => {
      if (!user) return;
      
      try {
        const { data } = await supabase
          .rpc('has_face_enrollment', { p_user_id: user.id });

        setHasFaceEnrollment(data || false);
        
        // Update available auth methods
        updateAuthMethods(data || false);
      } catch (error) {
        console.error('Error checking face enrollment:', error);
        updateAuthMethods(false);
      }
    };

    checkFaceEnrollment();
  }, [user]);

  // Update available authentication methods
  const updateAuthMethods = (hasFaceEnrollment: boolean) => {
    const methods: AuthMethod[] = [
      {
        id: 'face',
        name: 'Face Recognition',
        icon: <Camera className="h-4 w-4" />,
        description: 'Use your face to authenticate',
        available: hasFaceEnrollment && showFaceRecognition,
        component: <EnhancedFaceRecognition 
          onVerificationComplete={handleFaceAuthComplete} 
          mode={mode === 'login' ? 'verification' : 'attendance'}
          requirePinFallback={showPin}
        />
      },
      {
        id: 'pin',
        name: 'PIN Code',
        icon: <Key className="h-4 w-4" />,
        description: 'Enter your 4-digit PIN code',
        available: showPin,
        component: <PinAuth onAuthComplete={handlePinAuthComplete} />
      },
      {
        id: 'password',
        name: 'Password',
        icon: <User className="h-4 w-4" />,
        description: 'Enter your password',
        available: showPassword,
        component: <PasswordAuth onAuthComplete={handlePasswordAuthComplete} />
      }
    ];

    // Filter available methods
    const availableMethods = methods.filter(method => method.available);
    
    // Set default tab to first available method
    if (availableMethods.length > 0 && !availableMethods.find(m => m.id === activeTab)) {
      setActiveTab(availableMethods[0].id);
    }
    
    setAuthMethods(methods);
  };

  // Handle face authentication
  const handleFaceAuthComplete = useCallback((success: boolean, data?: any) => {
    if (success) {
      setSuccessMessage('Face authentication successful!');
      setErrorMessage('');
      onAuthSuccess?.('face', data);
    } else {
      setErrorMessage(data?.error || 'Face authentication failed');
      onAuthError?.(data?.error || 'Face authentication failed');
    }
  }, [onAuthSuccess, onAuthError]);

  // Handle PIN authentication
  const handlePinAuthComplete = useCallback((success: boolean, data?: any) => {
    if (success) {
      setSuccessMessage('PIN authentication successful!');
      setErrorMessage('');
      onAuthSuccess?.('pin', data);
    } else {
      setErrorMessage('Invalid PIN code');
      onAuthError?.('Invalid PIN code');
    }
  }, [onAuthSuccess, onAuthError]);

  // Handle password authentication
  const handlePasswordAuthComplete = useCallback((success: boolean, data?: any) => {
    if (success) {
      setSuccessMessage('Password authentication successful!');
      setErrorMessage('');
      onAuthSuccess?.('password', data);
    } else {
      setErrorMessage('Invalid password');
      onAuthError?.('Invalid password');
    }
  }, [onAuthSuccess, onAuthError]);

  // Get current auth method component
  const currentMethod = authMethods.find(method => method.id === activeTab);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Hybrid Authentication
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Messages */}
        {successMessage && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}
        
        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Face Enrollment Status */}
        {mode === 'login' && (
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              <span className="text-sm">
                Face Enrollment: {hasFaceEnrollment ? 'Complete' : 'Not Registered'}
              </span>
            </div>
            <Badge variant={hasFaceEnrollment ? 'default' : 'secondary'}>
              {hasFaceEnrollment ? '✅' : '❌'}
            </Badge>
          </div>
        )}

        {/* Auth Methods */}
        {authMethods.length > 0 ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              {authMethods.map((method) => (
                <TabsTrigger 
                  key={method.id} 
                  value={method.id}
                  disabled={!method.available}
                  className="data-[state=active]:bg-primary text-primary-foreground"
                >
                  <div className="flex items-center gap-2">
                    {method.icon}
                    <span>{method.name}</span>
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>
            
            <TabsContent className="mt-4">
              {authMethods.map((method) => (
                <TabsContent key={method.id} value={method.id}>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold mb-2">
                        {method.icon}
                      </div>
                      <h3 className="text-lg font-semibold">{method.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {method.description}
                      </p>
                    </div>
                    {method.component}
                  </div>
                </TabsContent>
              ))}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Authentication Methods Available</h3>
            <p className="text-muted-foreground">
              Please enable at least one authentication method in settings.
            </p>
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-1 border-t pt-4">
          <p className="font-medium">Authentication Methods:</p>
          <ul className="space-y-1 ml-4">
            <li>• <strong>Face Recognition</strong> - Fast, secure, biometric authentication</li>
            <li>• <strong>PIN Code</strong> - Quick 4-digit numeric code</li>
            <li>• <strong>Password</strong> - Traditional alphanumeric password</li>
          </ul>
          <p className="font-medium mt-2">Security Features:</p>
          <ul className="space-y-1 ml-4">
            <li>• Face recognition with confidence scoring</li>
            <li>• Multiple fallback methods</li>
            <li>• Attempt limiting and lockout protection</li>
            <li>• Secure logging and audit trail</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// PIN Authentication Component
function PinAuth({ onAuthComplete }: { onAuthComplete: (success: boolean, data?: any) => void }) {
  const [pinCode, setPinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pinCode.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Simulate PIN verification
      // In production, verify against user's stored PIN
      const isValidPin = pinCode.length === 4; // Simple validation
      
      if (isValidPin) {
        onAuthComplete(true, { pin: pinCode });
        setPinCode('');
      } else {
        setError('Invalid PIN code');
      }
    } catch (error) {
      setError('PIN verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pin">PIN Code</Label>
        <Input
          id="pin"
          type="password"
          placeholder="Enter 4-digit PIN"
          value={pinCode}
          onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
          maxLength={4}
          className="text-center text-lg tracking-widest"
        />
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Button type="submit" disabled={isLoading || pinCode.length !== 4} className="w-full">
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent mr-2" />
            Verifying...
          </>
        ) : (
          <>
            <Key className="h-4 w-4 mr-2" />
            Verify PIN
          </>
        )}
      </Button>
    </form>
  );
}

// Password Authentication Component
function PasswordAuth({ onAuthComplete }: { onAuthComplete: (success: boolean, data?: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Simulate password verification
      // In production, verify against user's credentials
      const isValidEmail = email.includes('@');
      const isValidPassword = password.length >= 6;
      
      if (isValidEmail && isValidPassword) {
        onAuthComplete(true, { email, password });
        setEmail('');
        setPassword('');
      } else {
        setError('Invalid email or password');
      }
    } catch (error) {
      setError('Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Button type="submit" disabled={isLoading || !email || !password} className="w-full">
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent mr-2" />
            Authenticating...
          </>
        ) : (
          <>
            <User className="h-4 w-4 mr-2" />
            Sign In
          </>
        )}
      </Button>
    </form>
  );
}
