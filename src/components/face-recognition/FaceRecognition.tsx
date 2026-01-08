import { useState, useRef, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, CameraOff, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface FaceRecognitionProps {
  onFaceDetected: (faceDescriptor: Float32Array) => void;
  onVerificationComplete: (success: boolean, data?: any) => void;
  employeeId?: string;
  mode?: 'attendance' | 'registration';
}

export function FaceRecognition({ 
  onFaceDetected, 
  onVerificationComplete, 
  employeeId, 
  mode = 'attendance' 
}: FaceRecognitionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<'idle' | 'scanning' | 'detected' | 'verified' | 'failed'>('idle');
  const [confidence, setConfidence] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);
        setErrorMessage('');
        
        // Load models from public/models directory
        // In production, you need to download these models and place them in public/models/
        const MODEL_URL = '/models';
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        
        setIsModelLoaded(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading face-api models:', error);
        setErrorMessage('Gagal memuat model face recognition. Pastikan file model tersedia.');
        setIsLoading(false);
      }
    };

    loadModels();
  }, []);

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
  }, [stream]);

  // Face detection loop
  const detectFaces = useCallback(async () => {
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

      // Calculate confidence based on detection quality
      const confidenceScore = Math.min(95, detection.detection.score * 100);
      setConfidence(confidenceScore);

      if (confidenceScore > 70) {
        setDetectionStatus('detected');
        
        // Get face descriptor
        const descriptor = detection.descriptor;
        onFaceDetected(Array.from(descriptor));
        
        // Stop scanning after successful detection
        setIsScanning(false);
        
        // Simulate verification (in real app, this would compare with stored face data)
        setTimeout(() => {
          if (mode === 'attendance') {
            // For attendance, verify against registered face
            verifyFace(descriptor);
          } else {
            // For registration, just confirm detection
            onVerificationComplete(true, { descriptor: Array.from(descriptor) });
            setDetectionStatus('verified');
          }
        }, 1000);
      }
    } else {
      setConfidence(0);
      setDetectionStatus('scanning');
    }

    // Continue detection loop
    if (isScanning) {
      requestAnimationFrame(detectFaces);
    }
  }, [isModelLoaded, isScanning, onFaceDetected, onVerificationComplete, mode]);

  // Start face detection
  useEffect(() => {
    if (isScanning && isCameraActive && isModelLoaded) {
      detectFaces();
    }
  }, [isScanning, isCameraActive, isModelLoaded, detectFaces]);

  // Verify face against stored data
  const verifyFace = async (descriptor: Float32Array) => {
    try {
      // In a real implementation, you would:
      // 1. Fetch stored face descriptors from database
      // 2. Compare using face distance
      // 3. Return verification result
      
      // For demo purposes, we'll simulate verification
      const isVerified = Math.random() > 0.3; // 70% success rate for demo
      
      if (isVerified) {
        setDetectionStatus('verified');
        onVerificationComplete(true, { 
          confidence: confidence,
          timestamp: new Date().toISOString(),
          employeeId 
        });
      } else {
        setDetectionStatus('failed');
        onVerificationComplete(false, { 
          reason: 'Face not recognized',
          confidence: confidence 
        });
      }
    } catch (error) {
      console.error('Error verifying face:', error);
      setDetectionStatus('failed');
      onVerificationComplete(false, { 
        reason: 'Verification failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Start scanning
  const startScanning = () => {
    if (!isCameraActive) {
      startCamera();
    }
    setIsScanning(true);
    setDetectionStatus('scanning');
    setErrorMessage('');
  };

  // Reset
  const reset = () => {
    stopCamera();
    setDetectionStatus('idle');
    setConfidence(0);
    setErrorMessage('');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const getStatusIcon = () => {
    switch (detectionStatus) {
      case 'scanning':
        return <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />;
      case 'detected':
        return <CheckCircle className="h-6 w-6 text-yellow-500" />;
      case 'verified':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'failed':
        return <XCircle className="h-6 w-6 text-red-500" />;
      default:
        return <AlertCircle className="h-6 w-6 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (detectionStatus) {
      case 'scanning':
        return 'Mendeteksi wajah...';
      case 'detected':
        return 'Wajah terdeteksi!';
      case 'verified':
        return 'Verifikasi berhasil!';
      case 'failed':
        return 'Verifikasi gagal';
      default:
        return 'Siap untuk scan';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Face Recognition - {mode === 'attendance' ? 'Absensi' : 'Registrasi'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium">{getStatusText()}</span>
          </div>
          {confidence > 0 && (
            <Badge variant={confidence > 70 ? 'default' : 'secondary'}>
              {confidence.toFixed(1)}%
            </Badge>
          )}
        </div>

        {/* Progress */}
        {confidence > 0 && (
          <Progress value={confidence} className="w-full" />
        )}

        {/* Video Container */}
        <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full"
          />
          
          {!isCameraActive && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <div className="text-center text-white">
                <CameraOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Kamera tidak aktif</p>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {!isScanning ? (
            <Button 
              onClick={startScanning}
              disabled={isLoading || !isModelLoaded}
              className="flex-1"
            >
              <Camera className="h-4 w-4 mr-2" />
              {mode === 'attendance' ? 'Scan Wajah untuk Absensi' : 'Registrasi Wajah'}
            </Button>
          ) : (
            <Button 
              onClick={reset}
              variant="outline"
              className="flex-1"
            >
              <CameraOff className="h-4 w-4 mr-2" />
              Stop Scanning
            </Button>
          )}
          
          {isCameraActive && !isScanning && (
            <Button onClick={reset} variant="outline">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p>• Pastikan wajah terlihat jelas dan cukup cahaya</p>
          <p>• Posisikan wajah di tengah frame</p>
          <p>• Hindari penggunaan masker atau aksesoris yang menutupi wajah</p>
          {mode === 'attendance' && (
            <p>• Sistem akan memverifikasi wajah dengan data yang terdaftar</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
