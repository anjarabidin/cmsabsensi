import { useState, useRef, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, CameraOff, RefreshCw, CheckCircle, XCircle, AlertCircle, Shield, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface EnhancedFaceRecognitionProps {
  onVerificationComplete: (success: boolean, data?: any) => void;
  employeeId?: string;
  mode?: 'attendance' | 'verification';
  requirePinFallback?: boolean;
}

interface FaceMatch {
  faceId: string;
  similarity: number;
  imageUrl: string;
  qualityScore: number;
  confidence: number;
}

export function EnhancedFaceRecognition({ 
  onVerificationComplete, 
  employeeId, 
  mode = 'attendance',
  requirePinFallback = true 
}: EnhancedFaceRecognitionProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<'idle' | 'scanning' | 'detected' | 'verified' | 'failed' | 'pin_required'>('idle');
  const [confidence, setConfidence] = useState(0);
  const [bestMatch, setBestMatch] = useState<FaceMatch | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [maxAttempts] = useState(3);
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [faceSettings, setFaceSettings] = useState<any>(null);

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);
        setErrorMessage('');
        
        const MODEL_URL = '/models';
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        
        setIsModelLoaded(true);
        setIsLoading(false);
        
        // Load user face settings
        await loadFaceSettings();
      } catch (error) {
        console.error('Error loading face-api models:', error);
        setErrorMessage('Gagal memuat model face recognition. Pastikan file model tersedia di /models/');
        setIsLoading(false);
      }
    };

    loadModels();
  }, []);

  // Load face settings
  const loadFaceSettings = async () => {
    const userId = employeeId || user?.id;
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .rpc('get_face_settings', { p_user_id: userId });

      if (error) {
        console.error('Error loading face settings:', error);
        // Use default settings
        setFaceSettings({
          is_enabled: true,
          confidence_threshold: 0.7,
          max_attempts: 3,
          lockout_duration_minutes: 5,
          require_liveness_check: false,
          fallback_to_pin: true
        });
      } else {
        setFaceSettings(data[0] || {});
      }
    } catch (error) {
      console.error('Error loading face settings:', error);
    }
  };

  // Check if user has face enrollment
  const hasFaceEnrollment = useCallback(async () => {
    const userId = employeeId || user?.id;
    if (!userId) return false;

    try {
      const { data } = await supabase
        .rpc('has_face_enrollment', { p_user_id: userId });

      return data || false;
    } catch (error) {
      console.error('Error checking face enrollment:', error);
      return false;
    }
  }, [employeeId, user]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setErrorMessage('');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: 'user'
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setErrorMessage('Tidak dapat mengakses kamera. Pastikan kamera diizinkan.');
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsScanning(false);
    setDetectionStatus('idle');
    setConfidence(0);
    setBestMatch(null);
  }, [stream]);

  // Face detection and matching
  const detectAndMatchFace = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isModelLoaded || !isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    
    faceapi.matchDimensions(canvas, displaySize);

    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();

    const resizedDetections = faceapi.resizeResults(detections, displaySize);

    // Clear canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (resizedDetections.length > 0) {
      const detection = resizedDetections[0];
      
      // Draw detection box
      const box = detection.detection.box;
      if (ctx) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        
        // Draw landmarks
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
      }

      // Calculate confidence
      const confidenceScore = Math.min(95, detection.detection.score * 100);
      setConfidence(confidenceScore);

      if (confidenceScore > 70) {
        setDetectionStatus('detected');
        
        // Get face descriptor
        const descriptor = Array.from(detection.descriptor);
        
        // Find best match in database
        const userId = employeeId || user?.id;
        if (userId) {
          try {
            const { data: matches } = await supabase
              .rpc('find_best_face_match', {
                p_user_id: userId,
                p_descriptor: Array.from(descriptor),
                p_threshold: faceSettings?.confidence_threshold || 0.7
              });

            if (matches && matches.length > 0) {
              const match = matches[0];
              setBestMatch({
                faceId: match.face_id,
                similarity: match.similarity,
                imageUrl: match.image_url,
                qualityScore: match.quality_score,
                confidence: confidenceScore
              });
              
              // Check if similarity is above threshold
              if (match.similarity >= (faceSettings?.confidence_threshold || 0.7)) {
                setDetectionStatus('verified');
                
                // Log successful verification
                await supabase.rpc('log_face_recognition_attempt', {
                  p_user_id: userId,
                  p_attempt_type: mode,
                  p_confidence: match.similarity,
                  p_success: true,
                  p_processing_time_ms: 0 // Calculate actual time in production
                });

                setTimeout(() => {
                  onVerificationComplete(true, {
                    confidence: match.similarity,
                    faceId: match.face_id,
                    timestamp: new Date().toISOString(),
                    employeeId: userId
                  });
                }, 1000);
              } else {
                setDetectionStatus('failed');
                handleVerificationFailed('Face not recognized', match.similarity);
              }
            } else {
              setDetectionStatus('failed');
              handleVerificationFailed('No matching face found');
            }
          } catch (error) {
            console.error('Error matching face:', error);
            setDetectionStatus('failed');
            handleVerificationFailed('Face matching failed');
          }
        }
      }
    } else {
      setConfidence(0);
      setDetectionStatus('scanning');
    }

    // Continue detection loop
    if (isScanning) {
      requestAnimationFrame(detectAndMatchFace);
    }
  }, [isModelLoaded, isScanning, onVerificationComplete, mode, employeeId, user, faceSettings]);

  // Start face detection
  useEffect(() => {
    if (isScanning && isCameraActive && isModelLoaded) {
      detectAndMatchFace();
    }
  }, [isScanning, isCameraActive, isModelLoaded, detectAndMatchFace]);

  // Handle verification failure
  const handleVerificationFailed = useCallback((reason: string, similarity?: number) => {
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    // Log failed attempt
    const userId = employeeId || user?.id;
    if (userId) {
      supabase.rpc('log_face_recognition_attempt', {
        p_user_id: userId,
        p_attempt_type: mode,
        p_confidence: similarity || 0,
        p_success: false,
        p_error_message: reason
      });
    }

    // Check if max attempts reached
    if (newAttempts >= maxAttempts) {
      // Set lockout
      const lockoutDuration = faceSettings?.lockout_duration_minutes || 5;
      const lockoutTime = new Date(Date.now() + lockoutDuration * 60 * 1000);
      setLockoutUntil(lockoutTime);
      
      setDetectionStatus('failed');
      setErrorMessage(`Too many failed attempts. Try again in ${lockoutDuration} minutes.`);
      
      // Show PIN fallback if enabled
      if (requirePinFallback && faceSettings?.fallback_to_pin) {
        setTimeout(() => {
          setShowPinInput(true);
        }, 2000);
      }
    } else {
      setDetectionStatus('failed');
      setErrorMessage(`${reason}. Attempts: ${newAttempts}/${maxAttempts}`);
    }
  }, [attempts, maxAttempts, mode, employeeId, user, requirePinFallback, faceSettings]);

  // Handle PIN verification
  const handlePinVerification = useCallback(async () => {
    if (!pinCode || pinCode.length < 4) {
      setErrorMessage('Please enter a valid PIN code');
      return;
    }

    try {
      const userId = employeeId || user?.id;
      
      // For demo purposes, accept any 4-digit PIN
      // In production, verify against user's actual PIN
      const isValidPin = pinCode.length === 4; // Simple validation
      
      if (isValidPin) {
        setDetectionStatus('verified');
        setShowPinInput(false);
        setPinCode('');
        setAttempts(0);
        
        // Log successful PIN verification
        if (userId) {
          await supabase.rpc('log_face_recognition_attempt', {
            p_user_id: userId,
            p_attempt_type: 'pin_verification',
            p_confidence: 1.0,
            p_success: true
          });
        }

        onVerificationComplete(true, {
          method: 'pin',
          timestamp: new Date().toISOString(),
          employeeId: userId
        });
      } else {
        setErrorMessage('Invalid PIN code');
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
      setErrorMessage('PIN verification failed');
    }
  }, [pinCode, employeeId, user, onVerificationComplete]);

  // Start scanning
  const startScanning = useCallback(async () => {
    // Check if user has face enrollment
    const hasEnrollment = await hasFaceEnrollment();
    
    if (!hasEnrollment) {
      setErrorMessage('No face enrollment found. Please register your face first.');
      return;
    }

    // Check lockout
    if (lockoutUntil && new Date() < lockoutUntil) {
      const remainingMinutes = Math.ceil((lockoutUntil.getTime() - new Date().getTime()) / (60 * 1000));
      setErrorMessage(`Account locked. Try again in ${remainingMinutes} minutes.`);
      return;
    }

    if (!isCameraActive) {
      startCamera();
    }
    
    setIsScanning(true);
    setDetectionStatus('scanning');
    setErrorMessage('');
    setAttempts(0);
  }, [hasFaceEnrollment, lockoutUntil, isCameraActive, startCamera]);

  // Reset
  const reset = useCallback(() => {
    stopCamera();
    setDetectionStatus('idle');
    setConfidence(0);
    setBestMatch(null);
    setErrorMessage('');
    setShowPinInput(false);
    setPinCode('');
    setAttempts(0);
  }, [stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const getStatusIcon = () => {
    switch (detectionStatus) {
      case 'scanning':
        return <RefreshCw className="h-6 w-6 animate-spin text-primary" />;
      case 'detected':
        return <CheckCircle className="h-6 w-6 text-warning" />;
      case 'verified':
        return <CheckCircle className="h-6 w-6 text-success" />;
      case 'failed':
        return <XCircle className="h-6 w-6 text-destructive" />;
      case 'pin_required':
        return <Key className="h-6 w-6 text-warning" />;
      default:
        return <AlertCircle className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (detectionStatus) {
      case 'scanning':
        return 'Memindai wajah...';
      case 'detected':
        return 'Wajah terdeteksi! Mencocokkan...';
      case 'verified':
        return 'Verifikasi Berhasil!';
      case 'failed':
        return 'Verifikasi Gagal';
      case 'pin_required':
        return 'Masukkan PIN';
      default:
        return 'Siap memindai';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto border-none shadow-md">
      <CardHeader className="bg-muted/30 pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Shield className="h-6 w-6 text-primary" />
          {mode === 'attendance' ? 'Absensi Wajah' : 'Verifikasi Identitas'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Status */}
        <div className="flex items-center justify-between bg-muted/20 p-4 rounded-xl border border-muted/50">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <span className="font-semibold text-lg">{getStatusText()}</span>
          </div>
          <div className="flex gap-2">
            {confidence > 0 && (
              <Badge variant={confidence > 70 ? 'default' : 'secondary'} className="px-3 py-1">
                Akurasi: {confidence.toFixed(1)}%
              </Badge>
            )}
          </div>
        </div>

        {/* Video Container */}
        <div className="relative bg-black rounded-2xl overflow-hidden shadow-inner ring-1 ring-border" style={{ aspectRatio: '4/3' }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover transform scale-x-[-1]" 
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
          />
          
          {/* Scanner Overlay Frame */}
          {isScanning && (
            <div className="absolute inset-0 border-[3px] border-primary/30 m-8 rounded-xl pointer-events-none">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />
                
                {/* Scan Line Animation */}
                <div className="absolute top-0 left-0 w-full h-1 bg-primary/50 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-[scan_2s_ease-in-out_infinite]" />
            </div>
          )}

          {!isCameraActive && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white">
              <div className="h-20 w-20 rounded-full bg-white/10 flex items-center justify-center mb-4">
                 <CameraOff className="h-10 w-10 opacity-70" />
              </div>
              <p className="text-lg font-medium">Kamera Nonaktif</p>
              <p className="text-sm text-white/50">Silahkan mulai pemindaian</p>
            </div>
          )}
        </div>

        {/* Best Match Display */}
        {bestMatch && detectionStatus === 'verified' && (
          <div className="bg-success/10 border border-success/20 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                    src={bestMatch.imageUrl}
                    alt="Matched face"
                    className="w-16 h-16 rounded-full object-cover border-2 border-success"
                />
                <div className="absolute -bottom-1 -right-1 bg-success text-white rounded-full p-1">
                    <CheckCircle className="w-3 h-3" />
                </div>
              </div>
              <div>
                <div className="font-bold text-success-foreground text-lg">Identitas Terverifikasi!</div>
                <div className="text-sm text-muted-foreground">
                  Kecocokan: {(bestMatch.similarity * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PIN Input */}
        {showPinInput && (
          <div className="space-y-4">
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                Face recognition failed. Please enter your PIN code for verification.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Input
                ref={pinInputRef}
                type="password"
                placeholder="Enter 4-digit PIN"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                maxLength={4}
                className="flex-1"
              />
              <Button onClick={handlePinVerification}>
                Verify
              </Button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {!isScanning && !showPinInput ? (
            <Button 
              onClick={startScanning}
              disabled={isLoading || !isModelLoaded}
              className="flex-1"
            >
              <Camera className="h-4 w-4 mr-2" />
              {mode === 'attendance' ? 'Scan Face for Attendance' : 'Verify Face'}
            </Button>
          ) : (
            <Button 
              onClick={reset}
              variant="outline"
              className="flex-1"
            >
              <CameraOff className="h-4 w-4 mr-2" />
              {showPinInput ? 'Cancel' : 'Stop Scanning'}
            </Button>
          )}
          
          {isCameraActive && !isScanning && !showPinInput && (
            <Button onClick={reset} variant="outline">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p>• Ensure your face is clearly visible and well-lit</p>
          <p>• Position your face in the center of the frame</p>
          <p>• Avoid wearing masks or accessories that cover your face</p>
          {requirePinFallback && (
            <p>• PIN code will be required if face recognition fails</p>
          )}
          <p>• System will verify against your registered face</p>
        </div>

        {/* Settings Info */}
        {faceSettings && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            <div className="flex items-center gap-4">
              <span>Threshold: {(faceSettings.confidence_threshold * 100).toFixed(0)}%</span>
              <span>Max Attempts: {faceSettings.max_attempts}</span>
              <span>Fallback: {faceSettings.fallback_to_pin ? 'PIN' : 'None'}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
