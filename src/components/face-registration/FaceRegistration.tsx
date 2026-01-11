import { useState, useRef, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, CameraOff, RefreshCw, CheckCircle, XCircle, AlertCircle, Upload, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface FaceRegistrationProps {
  onComplete?: (success: boolean, data?: any) => void;
  employeeId?: string;
}

interface CapturedFace {
  id: string;
  descriptor: number[];
  imageUrl: string;
  qualityScore: number;
  angle: number;
}

export function FaceRegistration({ onComplete, employeeId }: FaceRegistrationProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedFaces, setCapturedFaces] = useState<CapturedFace[]>([]);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [qualityScore, setQualityScore] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [registrationMode, setRegistrationMode] = useState<'camera' | 'upload'>('camera');
  const requiredCaptures = 3;

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
      } catch (error) {
        console.error('Error loading face-api models:', error);
        setErrorMessage('Gagal memuat model face recognition. Pastikan file model tersedia di /models/');
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
          width: { ideal: 1280 },
          height: { ideal: 720 },
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
    setIsCapturing(false);
  }, [stream]);

  // Capture face from camera
  const captureFace = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isModelLoaded) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const displaySize = { width: video.videoWidth, height: video.videoHeight };

    faceapi.matchDimensions(canvas, displaySize);

    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      setErrorMessage('Tidak ada wajah terdeteksi. Pastikan wajah terlihat jelas.');
      return;
    }

    if (detections.length > 1) {
      setErrorMessage('Hanya satu wajah yang terdeteksi. Pastikan hanya satu orang di frame.');
      return;
    }

    const detection = detections[0];

    // Calculate quality score based on detection confidence and face size
    const faceSize = detection.detection.box.width * detection.detection.box.height;
    const maxFaceSize = displaySize.width * displaySize.height * 0.5; // Max 50% of frame
    const sizeScore = Math.min(1, faceSize / maxFaceSize);
    const qualityScore = Math.min(1, (detection.detection.score + sizeScore) / 2);

    setQualityScore(qualityScore);

    if (qualityScore < 0.6) {
      setErrorMessage('Kualitas wajah terlalu rendah. Pastikan pencahayaan cukup dan wajah terlihat jelas.');
      return;
    }

    // Draw capture
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Captured image should be natural (not mirrored)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Draw detection UI on top of the photo
      const box = detection.detection.box;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      faceapi.draw.drawFaceLandmarks(canvas, [detection]);
    }

    // Capture image
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const imageUrl = URL.createObjectURL(blob);
      const descriptor = Array.from(detection.descriptor);

      const newFace: CapturedFace = {
        id: `face_${Date.now()}`,
        descriptor: Array.from(descriptor),
        imageUrl,
        qualityScore,
        angle: currentAngle
      };

      setCapturedFaces(prev => [...prev, newFace]);

      // Move to next angle
      if (currentAngle < 270) {
        setCurrentAngle(prev => prev + 90);
        setTimeout(() => {
          // Auto capture next angle after 2 seconds
          if (isCapturing) {
            captureFace();
          }
        }, 2000);
      } else {
        setIsCapturing(false);
      }
    }, 'image/jpeg', 0.95);
  }, [videoRef, canvasRef, isModelLoaded, currentAngle, isCapturing]);

  // Start capturing process
  const startCapturing = () => {
    if (!isCameraActive) {
      startCamera();
    }
    setIsCapturing(true);
    setCurrentAngle(0);
    setCapturedFaces([]);
    setErrorMessage('');
  };

  // Handle file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setErrorMessage('');

      // Create image element
      const img = new Image();
      img.onload = async () => {
        // Create canvas for processing
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(img, 0, 0);

          // Detect face
          const detections = await faceapi
            .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

          if (detections.length === 0) {
            setErrorMessage('Tidak ada wajah terdeteksi di gambar.');
            setIsLoading(false);
            return;
          }

          if (detections.length > 1) {
            setErrorMessage('Gambar harus hanya mengandung satu wajah.');
            setIsLoading(false);
            return;
          }

          const detection = detections[0];
          const qualityScore = Math.min(1, detection.detection.score);

          if (qualityScore < 0.6) {
            setErrorMessage('Kualitas wajah dalam gambar terlalu rendah.');
            setIsLoading(false);
            return;
          }

          const descriptor = Array.from(detection.descriptor);
          const imageUrl = URL.createObjectURL(file);

          const newFace: CapturedFace = {
            id: `face_${Date.now()}`,
            descriptor: Array.from(descriptor),
            imageUrl,
            qualityScore,
            angle: 0
          };

          setCapturedFaces([newFace]);
          setIsLoading(false);
        }
      };

      img.src = URL.createObjectURL(file);
    } catch (error) {
      console.error('Error processing uploaded image:', error);
      setErrorMessage('Gagal memproses gambar. Pastikan gambar valid.');
      setIsLoading(false);
    }
  }, []);

  // Submit registration
  const submitRegistration = useCallback(async () => {
    if (capturedFaces.length === 0) {
      setErrorMessage('Tidak ada wajah yang terdaftar.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const userId = employeeId || user?.id;
      if (!userId) {
        throw new Error('User ID tidak ditemukan');
      }

      // Upload face images to storage
      const uploadedFaces = [];

      for (const face of capturedFaces) {
        // Convert blob URL to file
        const response = await fetch(face.imageUrl);
        const blob = await response.blob();
        const file = new File([blob], `face_${face.id}.jpg`, { type: 'image/jpeg' });

        // Upload to Supabase Storage
        const filePath = `face-images/${userId}/${face.id}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('face-images')
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('face-images')
          .getPublicUrl(filePath);

        uploadedFaces.push({
          ...face,
          imageUrl: publicUrl
        });
      }

      // Save face descriptors to database
      const { error: dbError } = await supabase
        .from('face_descriptors')
        .insert(
          uploadedFaces.map(face => ({
            user_id: userId,
            descriptor: Array.from(face.descriptor),
            image_url: face.imageUrl,
            quality_score: face.qualityScore,
            capture_angle: face.angle,
            device_info: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              timestamp: new Date().toISOString()
            }
          }))
        );

      if (dbError) {
        throw dbError;
      }

      // Clean up blob URLs
      capturedFaces.forEach(face => URL.revokeObjectURL(face.imageUrl));

      onComplete?.(true, {
        message: 'Face registration successful',
        facesCount: uploadedFaces.length
      });

    } catch (error) {
      console.error('Error submitting registration:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Gagal menyimpan data wajah.');
    } finally {
      setIsSubmitting(false);
    }
  }, [capturedFaces, employeeId, user, onComplete]);

  // Reset
  const reset = () => {
    stopCamera();
    setCapturedFaces([]);
    setCurrentAngle(0);
    setQualityScore(0);
    setErrorMessage('');
    setRegistrationMode('camera');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      capturedFaces.forEach(face => URL.revokeObjectURL(face.imageUrl));
    };
  }, [stopCamera, capturedFaces]);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Face Registration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Registration Mode Selector */}
        <div className="flex gap-2">
          <Button
            variant={registrationMode === 'camera' ? 'default' : 'outline'}
            onClick={() => setRegistrationMode('camera')}
            className="flex-1"
          >
            <Camera className="h-4 w-4 mr-2" />
            Camera Capture
          </Button>
          <Button
            variant={registrationMode === 'upload' ? 'default' : 'outline'}
            onClick={() => setRegistrationMode('upload')}
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Image
          </Button>
        </div>

        {/* Camera Mode */}
        {registrationMode === 'camera' && (
          <>
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Progress: {capturedFaces.length}/{requiredCaptures} faces
                </span>
                <Badge variant={capturedFaces.length >= requiredCaptures ? 'default' : 'secondary'}>
                  {capturedFaces.length}/{requiredCaptures}
                </Badge>
              </div>
              <Progress value={(capturedFaces.length / requiredCaptures) * 100} />
              <div className="text-xs text-muted-foreground">
                Capturing angles: {capturedFaces.map(f => f.angle).join(', ') || 'None'}
              </div>
            </div>

            {/* Video Container */}
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ filter: 'brightness(1.08) contrast(1.05) saturate(1.1)' }}
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
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

            {/* Quality Score */}
            {qualityScore > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Quality Score:</span>
                <Badge variant={qualityScore > 0.8 ? 'default' : qualityScore > 0.6 ? 'secondary' : 'destructive'}>
                  {(qualityScore * 100).toFixed(1)}%
                </Badge>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-2">
              {!isCapturing ? (
                <Button
                  onClick={startCapturing}
                  disabled={isLoading || !isModelLoaded || capturedFaces.length >= requiredCaptures}
                  className="flex-1"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Start Capture
                </Button>
              ) : (
                <Button
                  onClick={reset}
                  variant="outline"
                  className="flex-1"
                >
                  <CameraOff className="h-4 w-4 mr-2" />
                  Stop Capturing
                </Button>
              )}

              {isCameraActive && !isCapturing && (
                <Button onClick={reset} variant="outline">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        )}

        {/* Upload Mode */}
        {registrationMode === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">Upload Face Image</p>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a clear front-facing photo of yourself
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                Choose File
              </Button>
            </div>

            {/* Preview uploaded image */}
            {capturedFaces.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Uploaded Image:</h4>
                <div className="relative w-full max-w-xs mx-auto">
                  <img
                    src={capturedFaces[0].imageUrl}
                    alt="Uploaded face"
                    className="w-full rounded-lg"
                  />
                  <div className="mt-2 text-center">
                    <Badge variant={capturedFaces[0].qualityScore > 0.8 ? 'default' : 'secondary'}>
                      Quality: {(capturedFaces[0].qualityScore * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Captured Faces Preview */}
        {capturedFaces.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Captured Faces:</h4>
            <div className="grid grid-cols-3 gap-2">
              {capturedFaces.map((face, index) => (
                <div key={face.id} className="relative">
                  <img
                    src={face.imageUrl}
                    alt={`Face ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  <div className="absolute top-1 right-1">
                    <Badge variant="secondary" className="text-xs">
                      {face.angle}°
                    </Badge>
                  </div>
                  <div className="absolute bottom-1 left-1">
                    <Badge variant={face.qualityScore > 0.8 ? 'default' : 'secondary'} className="text-xs">
                      {(face.qualityScore * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              ))}
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

        {/* Submit Button */}
        <div className="flex gap-2">
          <Button
            onClick={submitRegistration}
            disabled={capturedFaces.length === 0 || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Register Face
              </>
            )}
          </Button>

          <Button variant="outline" onClick={reset}>
            Reset
          </Button>
        </div>

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p>• {registrationMode === 'camera' ? 'Capture 3 face angles (0°, 90°, 180°, 270°)' : 'Upload a clear front-facing photo'}</p>
          <p>• Ensure good lighting and clear visibility</p>
          <p>• Remove glasses and accessories if possible</p>
          <p>• Face should be centered and clearly visible</p>
          <p>• Quality score must be above 60%</p>
        </div>
      </CardContent>
    </Card>
  );
}
