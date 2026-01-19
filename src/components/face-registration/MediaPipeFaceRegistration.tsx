import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera as CameraIcon, CheckCircle, XCircle, RefreshCw, Eye, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMediaPipeFace } from '@/hooks/useMediaPipeFace';
import { MediaPipeBlinkDetector } from '@/utils/mediaPipeBlinkDetection';
import { FaceLandmarkerResult } from '@mediapipe/tasks-vision';

interface MediaPipeFaceRegistrationProps {
    onComplete?: (success: boolean, data?: any) => void;
    employeeId?: string;
}

type Step = 'intro' | 'capture' | 'blink-challenge' | 'processing' | 'success' | 'error';

export function MediaPipeFaceRegistration({ onComplete, employeeId }: MediaPipeFaceRegistrationProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const blinkDetectorRef = useRef(new MediaPipeBlinkDetector());
    const animationFrameRef = useRef<number>();

    const [step, setStep] = useState<Step>('intro');
    const [faceImage, setFaceImage] = useState<string | null>(null);
    const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [blinkCount, setBlinkCount] = useState(0);
    const [requiredBlinks] = useState(2);
    const [detectedFace, setDetectedFace] = useState(false);
    const [showMesh, setShowMesh] = useState(true);
    const [loadingStatus, setLoadingStatus] = useState('');

    const targetUserId = employeeId || user?.id;
    const { initialize, isReady, isLoading, error: mpError, detectFace, getFaceDescriptor } = useMediaPipeFace();

    // Start Camera - PARALLEL dengan init MediaPipe
    const startCamera = async () => {
        try {
            setStep('capture');
            setLoadingStatus('Mengaktifkan kamera...');

            // Parallel: Kamera + MediaPipe
            const cameraPromise = navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: false
            });

            // Start camera immediately
            const stream = await cameraPromise;
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();
                    setLoadingStatus('Kamera aktif');
                };
            }

            // Initialize MediaPipe in background
            if (!isReady) {
                setLoadingStatus('Memuat AI Face Mesh...');
                await initialize();
                setLoadingStatus('AI siap');
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
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    };

    // Draw face mesh on canvas
    const drawFaceMesh = (result: FaceLandmarkerResult) => {
        if (!canvasRef.current || !videoRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];

            // Draw mesh points
            ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
            landmarks.forEach((landmark) => {
                const x = landmark.x * canvas.width;
                const y = landmark.y * canvas.height;
                ctx.beginPath();
                ctx.arc(x, y, 1, 0, 2 * Math.PI);
                ctx.fill();
            });

            // Draw key points
            const keyPoints = [33, 133, 362, 263, 1, 2, 61, 291];
            ctx.fillStyle = 'rgba(0, 255, 0, 1)';
            keyPoints.forEach(idx => {
                if (idx < landmarks.length) {
                    const landmark = landmarks[idx];
                    const x = landmark.x * canvas.width;
                    const y = landmark.y * canvas.height;
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, 2 * Math.PI);
                    ctx.fill();
                }
            });
        }
    };

    // Capture Face
    const captureFace = async () => {
        if (!videoRef.current || !isReady) {
            toast({ title: 'AI belum siap', description: 'Tunggu sebentar...', variant: 'destructive' });
            return;
        }

        try {
            const result = await detectFace(videoRef.current);

            if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
                toast({ title: 'Wajah tidak terdeteksi', description: 'Pastikan wajah terlihat jelas', variant: 'destructive' });
                return;
            }

            const descriptor = getFaceDescriptor(result);
            if (!descriptor) {
                toast({ title: 'Gagal memproses wajah', variant: 'destructive' });
                return;
            }

            // Capture image
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');

            if (ctx) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(videoRef.current, 0, 0);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                setFaceImage(dataUrl);
                setFaceDescriptor(descriptor);

                blinkDetectorRef.current.reset();
                setBlinkCount(0);

                // Go to blink challenge - useEffect will start detection automatically
                setStep('blink-challenge');
            }
        } catch (error) {
            console.error('Capture error:', error);
            toast({ title: 'Gagal mengambil foto', variant: 'destructive' });
        }
    };

    // Render loop for capture step
    useEffect(() => {
        if (step === 'capture' && showMesh && isReady) {
            const renderLoop = async () => {
                if (!videoRef.current) return;

                const result = await detectFace(videoRef.current);
                if (result) {
                    drawFaceMesh(result);
                    setDetectedFace(result.faceLandmarks && result.faceLandmarks.length > 0);
                }

                if (step === 'capture') {
                    animationFrameRef.current = requestAnimationFrame(renderLoop);
                }
            };

            renderLoop();
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [step, showMesh, isReady, detectFace]);

    // Blink detection loop for blink-challenge step
    useEffect(() => {
        if (step === 'blink-challenge' && isReady && videoRef.current) {
            const detectBlinks = async () => {
                const video = videoRef.current;
                if (step !== 'blink-challenge' || !video || !isReady) {
                    return;
                }

                // Wait for video to be ready
                if (video.readyState < 2) {
                    if (step === 'blink-challenge') {
                        animationFrameRef.current = requestAnimationFrame(detectBlinks);
                    }
                    return;
                }

                const result = await detectFace(video);

                if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
                    setDetectedFace(true);

                    blinkDetectorRef.current.processFrame(result);
                    const currentBlinks = blinkDetectorRef.current.getBlinkCount();
                    setBlinkCount(currentBlinks);

                    if (showMesh) {
                        drawFaceMesh(result);
                    }

                    // Check if enough blinks and auto-save
                    if (currentBlinks >= requiredBlinks) {
                        await saveEnrollment();
                        return;
                    }
                } else {
                    setDetectedFace(false);
                }

                // Continue loop
                if (step === 'blink-challenge') {
                    animationFrameRef.current = requestAnimationFrame(detectBlinks);
                }
            };

            detectBlinks();
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [step, isReady, showMesh, requiredBlinks, detectFace]);

    // Fix: Re-attach stream when step changes (because video element is re-mounted)
    useEffect(() => {
        if (streamRef.current && videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(console.error);
        }
    }, [step]);

    // Save Enrollment
    const saveEnrollment = async () => {
        if (!faceImage || !faceDescriptor || !targetUserId) {
            setErrorMessage('Data tidak lengkap');
            setStep('error');
            return;
        }

        setStep('processing');

        try {
            const blob = await fetch(faceImage).then(r => r.blob());
            const fileName = `${targetUserId}/enrollment_${Date.now()}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('face-enrollments')
                .upload(fileName, blob);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('face-enrollments')
                .getPublicUrl(fileName);

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
        <div
            className="min-h-screen w-full flex items-center justify-center bg-black"
            style={{
                paddingTop: 'max(1rem, env(safe-area-inset-top))',
                paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
                paddingLeft: 'max(1rem, env(safe-area-inset-left))',
                paddingRight: 'max(1rem, env(safe-area-inset-right))',
            }}
        >
            <div className="w-full max-w-md px-4">
                <Card className="border border-white/10 shadow-2xl rounded-[32px] overflow-hidden bg-black text-white">
                    <CardContent className="p-0">

                        {/* STEP 1: INTRO */}
                        {step === 'intro' && (
                            <div className="text-center space-y-6 p-8">
                                <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-xl shadow-blue-200">
                                    <Sparkles className="h-10 w-10 text-white animate-pulse" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-black text-white tracking-tight">Biometric Registration</h2>
                                    <p className="text-sm text-slate-400 font-medium">Amankan akun Anda dengan teknologi pengenalan wajah terbaru.</p>
                                </div>

                                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs ring-1 ring-blue-500/50">1</div>
                                        <span className="text-xs font-bold text-slate-300">Posisikan wajah di tengah</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs ring-1 ring-blue-500/50">2</div>
                                        <span className="text-xs font-bold text-slate-300">Pastikan pencahayaan cukup</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs ring-1 ring-blue-500/50">3</div>
                                        <span className="text-xs font-bold text-slate-300">Ikuti instruksi kedipan mata</span>
                                    </div>
                                </div>

                                <Button
                                    onClick={startCamera}
                                    className="w-full h-14 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-2xl font-bold text-base shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-95"
                                >
                                    <CameraIcon className="mr-2 h-5 w-5" />
                                    Mulai Registrasi
                                </Button>
                            </div>
                        )}

                        {/* STEP 2 & 3: CAPTURE & BLINK */}
                        {(step === 'capture' || step === 'blink-challenge') && (
                            <div className="relative aspect-[3/4] bg-black">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    style={{ transform: 'scaleX(-1)' }}
                                    className="w-full h-full object-cover"
                                />

                                {showMesh && (
                                    <canvas
                                        ref={canvasRef}
                                        style={{ transform: 'scaleX(-1)' }}
                                        className="absolute inset-0 w-full h-full pointer-events-none opacity-60"
                                    />
                                )}

                                {/* Top Status Bar */}
                                <div className="absolute top-0 left-0 right-0 p-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start z-10">
                                    <div className="flex flex-col">
                                        <Badge className="bg-white/20 backdrop-blur-md text-white border-0 font-bold px-3 py-1.5 self-start">
                                            {loadingStatus || (step === 'blink-challenge' ? 'Liveness Check' : 'Face Detection')}
                                        </Badge>
                                        {!isReady ? (
                                            <p className="text-[10px] text-white/70 mt-1 pl-1"><Loader2 className="inline h-3 w-3 animate-spin" /> Memuat Model AI...</p>
                                        ) : (
                                            <p className="text-[10px] text-green-400 mt-1 pl-1 font-bold">● AI Active</p>
                                        )}
                                    </div>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => { stopCamera(); setStep('intro'); }}
                                        className="rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md h-10 w-10"
                                    >
                                        <XCircle className="h-6 w-6" />
                                    </Button>
                                </div>

                                {/* Center Frame Guide - Changes color on detection */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                                    <div className={`w-64 h-80 border-[3px] rounded-[48px] transition-all duration-300 ${detectedFace ? 'border-green-400 shadow-[0_0_50px_rgba(74,222,128,0.3)]' : 'border-white/30 border-dashed'
                                        }`}>
                                        {/* Corner Accents */}
                                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white/80 rounded-tl-[44px] -mt-[3px] -ml-[3px]" />
                                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white/80 rounded-tr-[44px] -mt-[3px] -mr-[3px]" />
                                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white/80 rounded-bl-[44px] -mb-[3px] -ml-[3px]" />
                                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white/80 rounded-br-[44px] -mb-[3px] -mr-[3px]" />
                                    </div>
                                </div>

                                {/* Bottom Controls Area */}
                                <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-24 flex flex-col items-center z-10">
                                    {step === 'capture' && (
                                        <div className="w-full text-center space-y-4">
                                            <p className="text-white/90 text-sm font-medium drop-shadow-md">
                                                {detectedFace ? "Wajah terdeteksi. Siap ambil foto." : "Posisikan wajah Anda di dalam bingkai"}
                                            </p>

                                            <div className="flex justify-center">
                                                <button
                                                    onClick={captureFace}
                                                    disabled={!isReady || !detectedFace}
                                                    className={`h-20 w-20 rounded-full border-4 p-1.5 transition-all duration-300 ${detectedFace ? 'border-white cursor-pointer active:scale-90 hover:scale-105' : 'border-white/30 cursor-not-allowed opacity-50'
                                                        }`}
                                                >
                                                    <div className={`w-full h-full rounded-full transition-colors duration-300 ${detectedFace ? 'bg-white' : 'bg-white/30'
                                                        }`} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {step === 'blink-challenge' && (
                                        <div className="w-full max-w-[280px] bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 text-center animate-in slide-in-from-bottom-8">
                                            <div className="flex items-center justify-center gap-2 mb-3">
                                                <Eye className="h-5 w-5 text-cyan-400 animate-pulse" />
                                                <span className="font-bold text-white tracking-wide">KEDIPKAN MATA</span>
                                            </div>

                                            <div className="flex justify-center gap-2 mb-2">
                                                {[...Array(requiredBlinks)].map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`h-2.5 flex-1 rounded-full transition-all duration-500 ${i < blinkCount
                                                            ? 'bg-gradient-to-r from-green-400 to-emerald-500 shadow-[0_0_10px_rgba(74,222,128,0.5)]'
                                                            : 'bg-white/20'
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-white/60 font-medium uppercase tracking-widest mt-2">
                                                Liveness Check {blinkCount}/{requiredBlinks}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* STEP 4: PROCESSING */}
                        {step === 'processing' && (
                            <div className="p-12 pb-16 text-center space-y-8">
                                <div className="relative mx-auto w-32 h-32">
                                    <div className="absolute inset-0 rounded-full border-[6px] border-white/10" />
                                    <div className="absolute inset-0 rounded-full border-[6px] border-blue-500 border-t-transparent animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="h-16 w-16 bg-blue-500/20 rounded-full flex items-center justify-center animate-pulse">
                                            <Sparkles className="h-8 w-8 text-blue-400" />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-black text-white">Memproses Data</h3>
                                    <p className="text-slate-400 text-sm">Mengenkripsi dan menyimpan profil biometrik...</p>
                                </div>
                            </div>
                        )}

                        {/* STEP 5: SUCCESS */}
                        {step === 'success' && (
                            <div className="p-12 pb-16 text-center space-y-8 bg-gradient-to-b from-green-500/10 to-transparent">
                                <div className="mx-auto w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center shadow-xl shadow-green-900/20 ring-4 ring-green-500/10">
                                    <CheckCircle className="h-12 w-12 text-green-400" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-black text-white tracking-tight">Registrasi Berhasil!</h2>
                                    <p className="text-slate-400 text-sm max-w-[200px] mx-auto">Wajah Anda kini terdaftar. Anda dapat menggunakan fitur Login & Absensi Wajah.</p>
                                </div>
                                <Button onClick={() => window.location.href = '/profile'} className="w-full h-12 rounded-xl bg-white text-black font-bold hover:bg-slate-200">
                                    Kembali ke Profil
                                </Button>
                            </div>
                        )}

                        {/* STEP 6: ERROR */}
                        {step === 'error' && (
                            <div className="p-10 text-center space-y-6">
                                <div className="mx-auto w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center shadow-lg shadow-red-900/20">
                                    <XCircle className="h-10 w-10 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white">Terjadi Kesalahan</h3>
                                    <p className="text-sm text-red-400 mt-2 font-medium bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                                        {errorMessage}
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    <Button
                                        onClick={() => { setStep('intro'); setErrorMessage(''); }}
                                        className="h-12 bg-white text-black rounded-xl font-bold hover:bg-slate-200"
                                    >
                                        <RefreshCw className="mr-2 h-4 w-4" /> Coba Lagi
                                    </Button>
                                    <Button onClick={() => window.location.reload()} variant="ghost" className="text-slate-400 hover:text-white hover:bg-white/10">
                                        Muat Ulang Halaman
                                    </Button>
                                </div>
                            </div>
                        )}

                    </CardContent>
                </Card>

                {/* Secure Badge Footer */}
                <div className="mt-8 flex items-center justify-center gap-2 opacity-50">
                    <div className="h-3 w-3 bg-slate-300 rounded-full" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">End-to-End Encrypted</span>
                </div>
            </div>
        </div>
    );
}
