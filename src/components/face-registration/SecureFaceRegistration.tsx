import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera as CameraIcon, CheckCircle, XCircle, RefreshCw, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as faceapi from 'face-api.js';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { BlinkDetector } from '@/utils/blinkDetection';

interface SecureFaceRegistrationProps {
    onComplete?: (success: boolean, data?: any) => void;
    employeeId?: string;
}

type Step = 'intro' | 'loading' | 'capture' | 'blink-challenge' | 'processing' | 'success' | 'error';

export function SecureFaceRegistration({ onComplete, employeeId }: SecureFaceRegistrationProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const blinkDetectorRef = useRef<BlinkDetector>(new BlinkDetector());

    const [step, setStep] = useState<Step>('intro');
    const [faceImage, setFaceImage] = useState<string | null>(null);
    const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [blinkCount, setBlinkCount] = useState(0);
    const [requiredBlinks] = useState(2); // Harus kedip 2x
    const [detectedFace, setDetectedFace] = useState(false);

    const targetUserId = employeeId || user?.id;
    const { loadModels, modelsLoaded, error: biometricError } = useFaceRecognition();

    // Start Camera
    const startCamera = async () => {
        try {
            setStep('loading');

            // Add a safety timeout for model loading
            const loadPromise = loadModels();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Pemuatan model biometrik timeout. Periksa koneksi internet Anda.')), 15000)
            );

            const success = await Promise.race([loadPromise, timeoutPromise]) as boolean;

            if (!success) {
                // Try to get more specific error from state if possible
                setErrorMessage(biometricError || 'Gagal memuat model biometrik. Pastikan file model tersedia di folder public/models.');
                setStep('error');
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: false
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();
                    setStep('capture');
                };
            }
        } catch (error) {
            console.error('Camera access error:', error);
            setErrorMessage('Gagal mengakses kamera. Pastikan izin diberikan.');
            setStep('error');
        }
    };

    // Stop Camera
    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    // Capture Face
    const captureface = async () => {
        if (!videoRef.current || !modelsLoaded) return;

        try {
            const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 });
            const detection = await faceapi.detectSingleFace(videoRef.current, options)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                toast({ title: 'Wajah tidak terdeteksi', description: 'Pastikan wajah terlihat jelas', variant: 'destructive' });
                return;
            }

            // Capture image
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');

            if (ctx) {
                // Mirror image
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(videoRef.current, 0, 0);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                setFaceImage(dataUrl);
                setFaceDescriptor(detection.descriptor);

                // Reset blink detector
                blinkDetectorRef.current.reset();
                setBlinkCount(0);

                // Go to blink challenge
                setStep('blink-challenge');
            }
        } catch (error) {
            console.error('Capture error:', error);
            toast({ title: 'Gagal mengambil foto', variant: 'destructive' });
        }
    };

    // Blink Detection Loop
    useEffect(() => {
        let animationFrameId: number;

        const detectBlinks = async () => {
            if (step !== 'blink-challenge' || !videoRef.current || !modelsLoaded) {
                return;
            }

            try {
                const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 });
                const detection = await faceapi.detectSingleFace(videoRef.current, options)
                    .withFaceLandmarks();

                if (detection) {
                    setDetectedFace(true);
                    blinkDetectorRef.current.processFrame(detection.landmarks);
                    const currentBlinks = blinkDetectorRef.current.getBlinkCount();
                    setBlinkCount(currentBlinks);

                    // Check if enough blinks
                    if (currentBlinks >= requiredBlinks) {
                        // Success! Save enrollment
                        await saveEnrollment();
                        return; // Stop detection loop
                    }
                } else {
                    setDetectedFace(false);
                }
            } catch (error) {
                console.warn('Detection error:', error);
            }

            animationFrameId = requestAnimationFrame(detectBlinks);
        };

        if (step === 'blink-challenge' && modelsLoaded) {
            animationFrameId = requestAnimationFrame(detectBlinks);
        }

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [step, modelsLoaded]);

    // Save Enrollment
    const saveEnrollment = async () => {
        if (!faceImage || !faceDescriptor || !targetUserId) {
            setErrorMessage('Data tidak lengkap');
            setStep('error');
            return;
        }

        setStep('processing');

        try {
            // Upload image
            const base64Data = faceImage.split(',')[1];
            const blob = await fetch(faceImage).then(r => r.blob());
            const fileName = `${targetUserId}/enrollment_${Date.now()}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('face-enrollments')
                .upload(fileName, blob);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('face-enrollments')
                .getPublicUrl(fileName);

            // Save to database
            const { error: dbError } = await supabase
                .from('face_enrollments')
                .upsert({
                    user_id: targetUserId,
                    face_descriptor: Array.from(faceDescriptor),
                    face_image_url: publicUrl,
                    is_active: true,
                    enrolled_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });

            if (dbError) throw dbError;

            setStep('success');
            toast({ title: 'Registrasi wajah berhasil!', className: 'bg-green-600 text-white' });

            setTimeout(() => {
                stopCamera();
                onComplete?.(true, { face_image_url: publicUrl });
            }, 2000);

        } catch (error: any) {
            console.error('Save error:', error);
            setErrorMessage(error.message || 'Gagal menyimpan data');
            setStep('error');
            toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
        }
    };

    // Cleanup
    useEffect(() => {
        return () => stopCamera();
    }, []);

    return (
        <div className="max-w-md mx-auto p-4">
            <Card className="border-none shadow-2xl rounded-[32px] overflow-hidden bg-white">
                <CardContent className="p-6 space-y-6">

                    {/* Intro */}
                    {step === 'intro' && (
                        <div className="text-center space-y-6 py-8">
                            <div className="mx-auto w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                                <CameraIcon className="h-10 w-10 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800">Registrasi Wajah</h2>
                                <p className="text-sm text-slate-500 mt-2">Tingkatkan keamanan absensi dengan verifikasi biometrik</p>
                            </div>

                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-left space-y-2">
                                <p className="text-xs font-bold text-blue-900">⚡ Proses Cepat & Aman:</p>
                                <ul className="text-xs text-blue-700 space-y-1.5 ml-4 list-disc">
                                    <li>Ambil foto wajah Anda</li>
                                    <li>Kedipkan mata <strong>2 kali</strong> untuk verifikasi</li>
                                    <li>Data terenkripsi dan aman</li>
                                </ul>
                            </div>

                            <Button
                                onClick={startCamera}
                                className="w-full h-12 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-base shadow-lg"
                            >
                                <CameraIcon className="mr-2 h-5 w-5" />
                                Mulai Registrasi
                            </Button>
                        </div>
                    )}

                    {/* Loading Models */}
                    {step === 'loading' && (
                        <div className="text-center py-12 space-y-4">
                            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
                            <p className="text-sm font-bold text-slate-600">Mempersiapkan sistem biometrik...</p>
                        </div>
                    )}

                    {/* Capture Step */}
                    {step === 'capture' && (
                        <div className="space-y-4">
                            <div className="relative aspect-[3/4] bg-slate-100 rounded-2xl overflow-hidden">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    style={{ transform: 'scaleX(-1)' }}
                                    className="w-full h-full object-cover"
                                />

                                {/* Overlay Guide */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-64 h-80 border-4 border-dashed border-white/50 rounded-[60px]" />
                                </div>

                                <div className="absolute top-4 left-0 right-0 text-center">
                                    <Badge className="bg-white/90 text-slate-700 backdrop-blur-sm px-4 py-2 text-xs font-bold">
                                        <Eye className="h-3 w-3 mr-1.5" />
                                        Posisikan wajah di tengah
                                    </Badge>
                                </div>
                            </div>

                            <Button
                                onClick={captureface}
                                className="w-full h-12 bg-green-600 hover:bg-green-700 rounded-xl font-bold shadow-lg"
                            >
                                <CheckCircle className="mr-2 h-5 w-5" />
                                Ambil Foto
                            </Button>

                            <Button
                                onClick={() => { stopCamera(); setStep('intro'); }}
                                variant="ghost"
                                className="w-full"
                            >
                                Batal
                            </Button>
                        </div>
                    )}

                    {/* Blink Challenge */}
                    {step === 'blink-challenge' && (
                        <div className="space-y-4">
                            <div className="relative aspect-[3/4] bg-slate-100 rounded-2xl overflow-hidden">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    style={{ transform: 'scaleX(-1)' }}
                                    className="w-full h-full object-cover"
                                />

                                {/* Blink Counter */}
                                <div className="absolute top-4 left-0 right-0 flex flex-col items-center gap-2">
                                    <Badge className="bg-blue-600/90 text-white backdrop-blur-sm px-4 py-2 text-sm font-black">
                                        {detectedFace ? '👁️ Wajah Terdeteksi' : '⚠️ Mencari Wajah...'}
                                    </Badge>

                                    <div className="text-center bg-white/95 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-lg">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Kedipkan Mata</p>
                                        <p className="text-3xl font-black text-blue-600">{blinkCount} / {requiredBlinks}</p>
                                    </div>
                                </div>

                                {/* Animated Eye Icon */}
                                <div className="absolute bottom-16 left-0 right-0 flex justify-center">
                                    <div className="bg-white/90 backdrop-blur-sm p-4 rounded-full animate-pulse">
                                        {blinkDetectorRef.current.areEyesClosed() ? (
                                            <EyeOff className="h-8 w-8 text-blue-600" />
                                        ) : (
                                            <Eye className="h-8 w-8 text-blue-600" />
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                                <p className="text-xs font-bold text-blue-800">
                                    💡 Kedipkan mata Anda secara natural untuk melanjutkan
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Processing */}
                    {step === 'processing' && (
                        <div className="text-center py-12 space-y-4">
                            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
                            <div>
                                <p className="font-bold text-slate-800">Menyimpan data biometrik...</p>
                                <p className="text-xs text-slate-500 mt-1">Mohon tunggu sebentar</p>
                            </div>
                        </div>
                    )}

                    {/* Success */}
                    {step === 'success' && (
                        <div className="text-center py-12 space-y-6">
                            <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle className="h-10 w-10 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800">Berhasil!</h2>
                                <p className="text-sm text-slate-500 mt-2">Wajah Anda telah terdaftar dengan aman</p>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {step === 'error' && (
                        <div className="text-center py-8 space-y-6">
                            <div className="mx-auto w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                                <XCircle className="h-10 w-10 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800">Terjadi Kesalahan</h2>
                                <p className="text-sm text-slate-500 mt-2">{errorMessage}</p>
                            </div>
                            <Button
                                onClick={() => { stopCamera(); setStep('intro'); }}
                                variant="outline"
                                className="w-full"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Coba Lagi
                            </Button>
                        </div>
                    )}

                </CardContent>
            </Card>
        </div>
    );
}
