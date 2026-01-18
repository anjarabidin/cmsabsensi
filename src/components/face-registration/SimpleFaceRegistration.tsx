import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Camera as CameraIcon, CheckCircle, XCircle, RefreshCw, Smartphone, ChevronRight, UserCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as faceapi from 'face-api.js';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';

interface SimpleFaceRegistrationProps {
    onComplete?: (success: boolean, data?: any) => void;
    employeeId?: string;
}

type RegistrationStep = 'intro' | 'loading-models' | 'detect-center' | 'detect-left' | 'detect-right' | 'detect-smile' | 'processing' | 'success' | 'error';

export function SimpleFaceRegistration({ onComplete, employeeId }: SimpleFaceRegistrationProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [currentStep, setCurrentStep] = useState<RegistrationStep>('intro');
    const [bestFaceImage, setBestFaceImage] = useState<string | null>(null);
    const [bestDescriptor, setBestDescriptor] = useState<Float32Array | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [progress, setProgress] = useState(0);

    // Feedback message for user guidance
    const [feedback, setFeedback] = useState('Posisikan wajah di tengah area');

    const targetUserId = employeeId || user?.id;
    const { loadModels, modelsLoaded } = useFaceRecognition();

    // Start Camera
    const startCamera = async () => {
        try {
            setCurrentStep('loading-models');
            await loadModels();

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
                // Wait for video to be ready before starting detection
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();
                    setCurrentStep('detect-center');
                };
            }
        } catch (error) {
            console.error('Camera access error:', error);
            setErrorMessage('Gagal mengakses kamera. Pastikan izin diberikan.');
            setCurrentStep('error');
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

    // Main Detection Loop
    useEffect(() => {
        let animationFrameId: number;
        let isProcessing = false;

        const detectFrame = async () => {
            if (
                !videoRef.current ||
                videoRef.current.paused ||
                videoRef.current.ended ||
                !modelsLoaded ||
                ['intro', 'processing', 'success', 'error', 'loading-models'].includes(currentStep)
            ) {
                if (['detect-center', 'detect-left', 'detect-right', 'detect-smile'].includes(currentStep)) {
                    animationFrameId = requestAnimationFrame(detectFrame);
                }
                return;
            }

            if (isProcessing) {
                animationFrameId = requestAnimationFrame(detectFrame);
                return;
            }

            isProcessing = true;

            try {
                // Lower threshold for better detection (0.3 instead of 0.5)
                const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 });

                const detection = await faceapi.detectSingleFace(videoRef.current, options)
                    .withFaceLandmarks()
                    .withFaceExpressions()
                    .withFaceDescriptor();

                if (detection) {
                    console.log('✅ Face detected at step:', currentStep);
                    const { landmarks, expressions, descriptor } = detection;
                    // Get simple head pose estimation from landmarks
                    // Nose bottom
                    const nose = landmarks.getNose()[6];
                    // Face center (approx)
                    const jaw = landmarks.getJawOutline();
                    const jawLeft = jaw[0];
                    const jawRight = jaw[16];

                    // Yaw estimation (Turning Left/Right)
                    const distToLeft = nose.x - jawLeft.x;
                    const distToRight = jawRight.x - nose.x;
                    const yawRatio = distToLeft / (distToLeft + distToRight);
                    // 0.5 = Center, < 0.4 = Looking Right (Mirror Left), > 0.6 = Looking Left (Mirror Right)

                    // Logic State Machine
                    if (currentStep === 'detect-center') {
                        if (yawRatio > 0.45 && yawRatio < 0.55) {
                            setFeedback("Bagus! Tahan sebentar...");
                            // Capture Best Center Face immediately if not already set
                            if (!bestFaceImage) {
                                captureHighQualityImage(descriptor); // Save descriptor too
                            }
                            // Slightly longer delay to ensure they hold it
                            setTimeout(() => {
                                // Only transition if we still have detection (basic validation)
                                if (currentStep === 'detect-center') setCurrentStep('detect-left');
                            }, 1000);
                        } else {
                            if (yawRatio <= 0.45) setFeedback("Toleh sedikit ke Kiri (luruskan)");
                            else if (yawRatio >= 0.55) setFeedback("Toleh sedikit ke Kanan (luruskan)");
                            else setFeedback("Hadap lurus ke depan");
                        }
                    }

                    else if (currentStep === 'detect-left') {
                        // User looks LEFT 
                        setFeedback("Toleh ke KIRI pelan-pelan");
                        if (yawRatio > 0.65) {
                            setFeedback("Oke, Sekarang kanan...");
                            setTimeout(() => {
                                if (currentStep === 'detect-left') setCurrentStep('detect-right');
                            }, 1000);
                        }
                    }

                    else if (currentStep === 'detect-right') {
                        setFeedback("Toleh ke KANAN pelan-pelan");
                        if (yawRatio < 0.35) {
                            setFeedback("Sempurna!");
                            setTimeout(() => {
                                if (currentStep === 'detect-right') setCurrentStep('detect-smile');
                            }, 1000);
                        }
                    }

                    else if (currentStep === 'detect-smile') {
                        setFeedback("Terakhir, Senyum! 😊");
                        if (expressions.happy > 0.7) {
                            setFeedback("Pendaftaran Selesai!");
                            stopCamera(); // Stop immediately
                            setTimeout(() => handleSubmit(), 500);
                        }
                    }

                } else {
                    setFeedback("Wajah tidak terdeteksi");
                }
            } catch (err) {
                console.warn("Detection glitch", err);
            } finally {
                isProcessing = false;
                animationFrameId = requestAnimationFrame(detectFrame);
            }
        };

        if (modelsLoaded && ['detect-center', 'detect-left', 'detect-right', 'detect-smile'].includes(currentStep)) {
            animationFrameId = requestAnimationFrame(detectFrame);
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [currentStep, modelsLoaded, bestFaceImage]);

    // Cleanup
    useEffect(() => {
        return () => stopCamera();
    }, []);

    const captureHighQualityImage = (descriptor: Float32Array) => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Mirror
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(videoRef.current, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                setBestFaceImage(dataUrl);
                setBestDescriptor(descriptor);
                console.log("📸 High Quality Center Face Captured!");
            }
        }
    };

    const handleSubmit = async () => {
        // Use state refs to ensure we have data, logic handled inside main loop triggers this
        // But we need to use the state values here.
        // Due to closures, bestFaceImage might be stale if simple call.
        // But since we trigger via timeout chain OR useEffect re-render, check values.

        // Re-check state in a functional update or rely on valid state flow
        // For safety, we can use the values directly if stored in refs or assume state is consistent because we stopped steps.
    };

    // We need a separate submit effect because handleSubmit inside the loop has stale closures
    useEffect(() => {
        const doSubmit = async () => {
            if (currentStep === 'processing' || currentStep !== 'detect-smile') return; // Wait until explicit transition
            // Actually, let's make handleSubmit triggered by state change to 'processing'
        };
    }, [currentStep]);

    // Improved Submit Logic decoupled from loop
    const finalizeRegistration = async () => {
        if (!bestFaceImage || !bestDescriptor) {
            setErrorMessage("Gagal mengambil data wajah terbaik. Ulangi proses.");
            setCurrentStep('error');
            return;
        }

        setCurrentStep('processing');

        try {
            // Upload
            setProgress(30);
            const response = await fetch(bestFaceImage);
            const blob = await response.blob();
            const fileName = `${targetUserId}/${Date.now()}_face_enroll.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('face-images')
                .upload(fileName, blob, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            setProgress(60);
            const { data: { publicUrl } } = supabase.storage
                .from('face-images')
                .getPublicUrl(fileName);

            // Save DB
            const descriptorArray = Array.from(bestDescriptor);
            const { error: dbError } = await supabase
                .from('face_enrollments')
                .upsert({
                    user_id: targetUserId,
                    face_image_url: publicUrl,
                    face_descriptor: descriptorArray,
                    is_active: true,
                    enrolled_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

            if (dbError) throw dbError;

            setProgress(100);
            setCurrentStep('success');
            toast({ title: 'Sukses', description: 'Wajah Anda berhasil diverifikasi & didaftarkan.' });

            setTimeout(() => {
                onComplete?.(true, { imageUrl: publicUrl });
            }, 2000);

        } catch (error: any) {
            console.error(error);
            setErrorMessage(error.message || "Gagal menyimpan data.");
            setCurrentStep('error');
        }
    };

    // Trigger submission when step implies completion (called from loop)
    // We'll replace the direct handleSubmit call in the loop with a state change to a temporary 'pre-submit' or direct call if we fix closure.
    // To fix closure, we can use a Ref for the image data or just rely on the step transition.

    // Ref-based state access for the loop
    const bestFaceImageRef = useRef<string | null>(null);
    const bestDescriptorRef = useRef<Float32Array | null>(null);

    const captureHighQualityImageRef = (descriptor: Float32Array) => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(videoRef.current, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                bestFaceImageRef.current = dataUrl;
                bestDescriptorRef.current = descriptor;

                // Also update React state for UI checks if needed, but Ref is source of truth for submit
                setBestFaceImage(dataUrl);
                setBestDescriptor(descriptor);
            }
        }
    }

    const executeSubmission = async () => {
        stopCamera();
        setCurrentStep('processing');

        try {
            if (!bestFaceImageRef.current || !bestDescriptorRef.current) {
                throw new Error("Data wajah tidak lengkap.");
            }

            setProgress(10);
            const response = await fetch(bestFaceImageRef.current);
            const blob = await response.blob();
            const fileName = `${targetUserId}/${Date.now()}_face_enroll.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('face-images')
                .upload(fileName, blob, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            setProgress(50);
            const { data: { publicUrl } } = supabase.storage
                .from('face-images')
                .getPublicUrl(fileName);

            // Save DB
            const descriptorArray = Array.from(bestDescriptorRef.current);
            const { error: dbError } = await supabase
                .from('face_enrollments')
                .upsert({
                    user_id: targetUserId,
                    face_image_url: publicUrl,
                    face_descriptor: descriptorArray,
                    is_active: true,
                    enrolled_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

            if (dbError) throw dbError;

            setProgress(100);
            setCurrentStep('success');
            toast({ title: 'Sukses', description: 'Wajah Anda berhasil diverifikasi & didaftarkan.' });

            setTimeout(() => {
                onComplete?.(true, { imageUrl: publicUrl });
            }, 2000);

        } catch (error: any) {
            console.error(error);
            setErrorMessage(error.message || "Gagal menyimpan data.");
            setCurrentStep('error');
        }
    }

    // Updated Loop Logic using Refs
    useEffect(() => {
        let animationFrameId: number;
        let isProcessing = false;

        const detectFrame = async () => {
            if (
                !videoRef.current ||
                videoRef.current.paused ||
                videoRef.current.ended ||
                !modelsLoaded ||
                ['intro', 'processing', 'success', 'error', 'loading-models'].includes(currentStep)
            ) {
                if (['detect-center', 'detect-left', 'detect-right', 'detect-smile'].includes(currentStep)) {
                    animationFrameId = requestAnimationFrame(detectFrame);
                }
                return;
            }

            if (isProcessing) {
                animationFrameId = requestAnimationFrame(detectFrame);
                return;
            }

            isProcessing = true;

            try {
                const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

                const detection = await faceapi.detectSingleFace(videoRef.current, options)
                    .withFaceLandmarks()
                    .withFaceExpressions()
                    .withFaceDescriptor();

                if (detection) {
                    const { landmarks, expressions, descriptor } = detection;
                    const nose = landmarks.getNose()[6];
                    const jaw = landmarks.getJawOutline();
                    const jawLeft = jaw[0];
                    const jawRight = jaw[16];

                    const distToLeft = nose.x - jawLeft.x;
                    const distToRight = jawRight.x - nose.x;
                    const yawRatio = distToLeft / (distToLeft + distToRight);

                    if (currentStep === 'detect-center') {
                        if (yawRatio > 0.45 && yawRatio < 0.55) {
                            setFeedback("Bagus! Tahan sebentar...");
                            if (!bestFaceImageRef.current) {
                                captureHighQualityImageRef(descriptor);
                            }
                            setTimeout(() => {
                                // Double check inside timeout
                                setCurrentStep(prev => prev === 'detect-center' ? 'detect-left' : prev);
                            }, 1000);
                        } else {
                            if (yawRatio <= 0.45) setFeedback("Toleh sedikit ke Kiri");
                            else if (yawRatio >= 0.55) setFeedback("Toleh sedikit ke Kanan");
                            else setFeedback("Hadap lurus ke depan");
                        }
                    }

                    else if (currentStep === 'detect-left') {
                        setFeedback("Toleh ke KIRI");
                        if (yawRatio > 0.65) {
                            setFeedback("Oke, Sekarang kanan...");
                            setTimeout(() => setCurrentStep(prev => prev === 'detect-left' ? 'detect-right' : prev), 800);
                        }
                    }

                    else if (currentStep === 'detect-right') {
                        setFeedback("Toleh ke KANAN");
                        if (yawRatio < 0.35) {
                            setFeedback("Sempurna!");
                            setTimeout(() => setCurrentStep(prev => prev === 'detect-right' ? 'detect-smile' : prev), 800);
                        }
                    }

                    else if (currentStep === 'detect-smile') {
                        setFeedback("Terakhir, Senyum! 😊");
                        if (expressions.happy > 0.7) {
                            setFeedback("Pendaftaran Selesai!");
                            // Stop Loop & Execute Submit
                            // We use a flag or direct call? Direct call is safer if defined outside/memoized
                            // But we need to break the loop first
                            // Trigger effect via state change? No, let's call it.
                            // But we need to ensure we don't call it multiple times.
                            executeSubmission();
                            // Force step change to break loop immediately
                            setCurrentStep('processing');
                        }
                    }

                } else {
                    setFeedback("Wajah tidak terdeteksi");
                }
            } catch (err) {
                console.warn("Detection glitch", err);
            } finally {
                isProcessing = false;
                // Only continue loop if status hasn't changed to processing
                // We check ref equivalent or currentStep prop (but currentStep in closure is stale)
                // The re-render will kill the loop, but this frame might try to request next.
                // It's okay, the next frame check at top will bail out.
                animationFrameId = requestAnimationFrame(detectFrame);
            }
        };

        if (modelsLoaded && ['detect-center', 'detect-left', 'detect-right', 'detect-smile'].includes(currentStep)) {
            animationFrameId = requestAnimationFrame(detectFrame);
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [currentStep, modelsLoaded]); // Re-bind when step changes

    const handleRetry = () => {
        bestFaceImageRef.current = null;
        bestDescriptorRef.current = null;
        setBestFaceImage(null);
        setBestDescriptor(null);
        setErrorMessage('');
        setProgress(0);
        setCurrentStep('intro');
    };

    return (
        <div className="max-w-md mx-auto space-y-4">
            {/* Progress Bar Top */}
            {['detect-center', 'detect-left', 'detect-right', 'detect-smile'].includes(currentStep) && (
                <div className="flex justify-between mb-2 px-2 gap-2">
                    <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${['detect-center', 'detect-left', 'detect-right', 'detect-smile'].includes(currentStep) ? 'bg-blue-500' : 'bg-slate-200'}`}></div>
                    <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${['detect-left', 'detect-right', 'detect-smile'].includes(currentStep) ? 'bg-blue-500' : 'bg-slate-200'}`}></div>
                    <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${['detect-right', 'detect-smile'].includes(currentStep) ? 'bg-blue-500' : 'bg-slate-200'}`}></div>
                    <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${['detect-smile'].includes(currentStep) ? 'bg-blue-500' : 'bg-slate-200'}`}></div>
                </div>
            )}

            {currentStep === 'intro' && (
                <Card className="border-none shadow-xl text-center pt-8 pb-6">
                    <CardContent className="space-y-6">
                        <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                            <UserCheck className="h-12 w-12 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold mb-2">Pendaftaran Wajah Cerdas</h3>
                            <p className="text-slate-500 text-sm">Ikuti instruksi gerakan wajah untuk verifikasi keamanan maksimal (Liveness Detection).</p>
                        </div>
                        <Button onClick={startCamera} className="w-full h-12 text-lg font-bold rounded-xl shadow-lg shadow-blue-200 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600">
                            Mulai Verifikasi
                        </Button>
                    </CardContent>
                </Card>
            )}

            {['loading-models', 'detect-center', 'detect-left', 'detect-right', 'detect-smile'].includes(currentStep) && (
                <Card className="border-none shadow-xl overflow-hidden relative">
                    <div className="aspect-[3/4] bg-black relative">
                        <video
                            ref={videoRef}
                            muted playsInline
                            className="w-full h-full object-cover transform scale-x-[-1]"
                        />

                        {/* Face Overlay Guide */}
                        <div className={`absolute inset-0 border-[4px] rounded-[45%] m-12 transition-all duration-300 ease-out
                            ${currentStep === 'detect-center' && feedback.includes("Bagus") ? 'border-green-400 scale-105 shadow-[0_0_20px_rgba(74,222,128,0.5)]' : 'border-white/40'}
                            ${currentStep !== 'detect-center' ? 'border-blue-400/60' : ''}
                         `}></div>

                        {/* Feedback Overlay */}
                        <div className="absolute bottom-12 left-0 right-0 text-center px-4 pointer-events-none">
                            <div className="bg-black/60 backdrop-blur-md text-white px-6 py-3 rounded-2xl inline-block font-bold text-lg shadow-lg border border-white/10 animate-in slide-in-from-bottom-5 fade-in duration-300">
                                {currentStep === 'loading-models' ? (
                                    <span className="flex items-center gap-2">
                                        <RefreshCw className="h-4 w-4 animate-spin" /> Menyiapkan AI...
                                    </span>
                                ) : feedback}
                            </div>
                        </div>

                        {/* Step Icon Indicator */}
                        <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm rounded-full p-2">
                            {currentStep === 'detect-center' && <span className="text-2xl">😐</span>}
                            {currentStep === 'detect-left' && <span className="text-2xl">👈</span>}
                            {currentStep === 'detect-right' && <span className="text-2xl">👉</span>}
                            {currentStep === 'detect-smile' && <span className="text-2xl">😄</span>}
                        </div>
                    </div>
                </Card>
            )}

            {currentStep === 'processing' && (
                <div className="text-center py-12 space-y-6">
                    <div className="relative mx-auto w-24 h-24">
                        <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Mengamankan Data...</h3>
                        <p className="text-slate-500 text-sm">Jangan tutup halaman ini</p>
                    </div>
                    <Progress value={progress} className="w-64 mx-auto h-2" />
                </div>
            )}

            {currentStep === 'success' && (
                <div className="text-center py-8 space-y-4 animate-in zoom-in-50 duration-500">
                    <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-green-100 shadow-xl">
                        <CheckCircle className="h-12 w-12 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800">Pendaftaran Sukses!</h3>
                    <p className="text-slate-500 max-w-xs mx-auto">Wajah Anda telah diverifikasi dan didaftarkan ke dalam sistem keamanan.</p>
                </div>
            )}

            {currentStep === 'error' && (
                <div className="text-center py-8 space-y-4">
                    <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                        <XCircle className="h-10 w-10 text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-red-700">Gagal</h3>
                    <p className="text-slate-500 max-w-xs mx-auto">{errorMessage}</p>
                    <Button onClick={handleRetry} variant="outline" className="mt-4">
                        <RefreshCw className="mr-2 h-4 w-4" /> Ulangi Proses
                    </Button>
                </div>
            )}
        </div>
    );
}
