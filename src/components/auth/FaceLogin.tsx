import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { XCircle, RefreshCw, Loader2, UserCheck, ShieldCheck, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMediaPipeFace } from '@/hooks/useMediaPipeFace';
import { useFaceSystem } from '@/hooks/useFaceSystem';
import { FaceLandmarkerResult } from '@mediapipe/tasks-vision';

interface FaceLoginProps {
    onVerificationComplete: (success: boolean, data?: any) => void;
    employeeId?: string;
    mode?: 'verification' | 'liveness'; // For future extensibility
}

export function FaceLogin({ onVerificationComplete, employeeId }: FaceLoginProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number>();

    const [status, setStatus] = useState<'loading' | 'scanning' | 'verifying' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState('');
    const [enrolledDescriptor, setEnrolledDescriptor] = useState<Float32Array | null>(null);
    const [similarityScore, setSimilarityScore] = useState(0);

    const { initialize, isReady, detectFace } = useMediaPipeFace();
    const { getDeepDescriptor, computeMatch } = useFaceSystem();

    // 1. Fetch Enrolled Face Data
    useEffect(() => {
        const fetchEnrollment = async () => {
            if (!employeeId) {
                setStatus('error');
                setErrorMessage('ID Pengguna tidak ditemukan');
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('face_enrollments')
                    .select('face_descriptor')
                    .eq('user_id', employeeId)
                    .eq('is_active', true)
                    .maybeSingle();

                if (error) throw error;

                if (!data) {
                    setStatus('error');
                    setErrorMessage('Anda belum mendaftarkan wajah. Silakan login manual.');
                    return;
                }

                // Parse Float32Array from JSON/Array
                const descriptor = new Float32Array(data.face_descriptor as any);
                setEnrolledDescriptor(descriptor);

                // Initialize MediaPipe
                await initialize();
                setStatus('scanning');

            } catch (err: any) {
                console.error('Fetch enrollment error:', err);
                setStatus('error');
                setErrorMessage('Gagal memuat data biometrik.');
            }
        };

        fetchEnrollment();
    }, [employeeId, initialize]);

    // 2. Start Camera when 'scanning'
    useEffect(() => {
        if (status === 'scanning' && isReady) {
            startCamera();
        }
        return () => {
            stopCamera();
        };
    }, [status, isReady]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();
                };
            }
        } catch (err) {
            console.error('Camera error:', err);
            setStatus('error');
            setErrorMessage('Gagal mengakses kamera.');
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    };

    // 3. Scanning Loop - Robust Implementation
    useEffect(() => {
        if (status !== 'scanning' || !isReady || !enrolledDescriptor || !streamRef.current) {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            return;
        }

        const loop = async () => {
            if (!videoRef.current || status !== 'scanning') {
                animationFrameRef.current = requestAnimationFrame(loop);
                return;
            }

            // Stop if video is not ready
            if (videoRef.current.readyState < 2) {
                animationFrameRef.current = requestAnimationFrame(loop);
                return;
            }

            try {
                const result = await detectFace(videoRef.current);

                // Draw Mesh
                drawMesh(result);

                if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
                    // 1. Get Deep Descriptor (ResNet-34)
                    const currentDescriptor = await getDeepDescriptor(videoRef.current);

                    if (currentDescriptor) {
                        const score = computeMatch(currentDescriptor, enrolledDescriptor);
                        setSimilarityScore(score);

                        // Threshold: > 0.55 (Equivalent to < 0.45 Euclidean Distance)
                        if (score > 0.55) {
                            handleSuccess();
                            return; // Stop checking
                        }
                    }
                }
            } catch (err) {
                console.error("Scanning loop error:", err);
            }

            animationFrameRef.current = requestAnimationFrame(loop);
        };

        animationFrameRef.current = requestAnimationFrame(loop);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [status, isReady, enrolledDescriptor, detectFace, getDeepDescriptor, computeMatch]);

    const drawMesh = (result: FaceLandmarkerResult | null) => {
        if (!canvasRef.current || !videoRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const video = videoRef.current;
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;

        ctx.clearRect(0, 0, video.videoWidth, video.videoHeight);

        if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];

            // Draw simple frame or points
            ctx.fillStyle = 'rgba(74, 222, 128, 0.8)'; // Green brighter
            landmarks.forEach((pt, i) => {
                // Draw mesh for visual feedback
                if (i % 8 === 0) { // Optimize: draw fewer points
                    const x = pt.x * video.videoWidth;
                    const y = pt.y * video.videoHeight;
                    ctx.beginPath();
                    ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
                    ctx.fill();
                }
            });
        }
    };

    const handleSuccess = () => {
        setStatus('success');
        stopCamera();
        // Wait a bit to show success screen then callback
        setTimeout(() => {
            onVerificationComplete(true);
        }, 1500);
    };

    const handleCancel = () => {
        stopCamera();
        onVerificationComplete(false, { error: 'Dibatalkan oleh pengguna' });
    };

    return (
        <Card className="border-0 shadow-none bg-black text-white w-full h-full min-h-[400px] flex flex-col overflow-hidden relative">

            {/* Camera View */}
            {(status === 'scanning' || status === 'verifying' || status === 'success') && (
                <div className="absolute inset-0 z-0">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ transform: 'scaleX(-1)' }}
                        className="w-full h-full object-cover opacity-80"
                    />
                    <canvas
                        ref={canvasRef}
                        style={{ transform: 'scaleX(-1)' }}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                    />
                </div>
            )}

            {/* Overlays */}
            <div className="relative z-10 flex-1 flex flex-col justify-between p-6">

                {/* Header */}
                <div className="flex justify-between items-start">
                    <Badge variant="outline" className="text-white border-white/20 bg-black/40 backdrop-blur-md">
                        {status === 'loading' && 'Memuat Data...'}
                        {status === 'scanning' && 'Mencocokkan Wajah'}
                        {status === 'success' && 'Terverifikasi'}
                        {status === 'error' && 'Error'}
                    </Badge>
                    <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 rounded-full h-8 w-8" onClick={handleCancel}>
                        <XCircle className="h-5 w-5" />
                    </Button>
                </div>

                {/* Center Content based on Status */}
                {status === 'loading' && (
                    <div className="flex flex-col items-center justify-center flex-1 space-y-4">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                        <p className="text-sm text-slate-400">Menyiapkan Biometrik...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center justify-center flex-1 space-y-4 text-center">
                        <div className="h-16 w-16 bg-red-500/20 rounded-full flex items-center justify-center">
                            <XCircle className="h-8 w-8 text-red-500" />
                        </div>
                        <h3 className="font-bold text-lg">Verifikasi Gagal</h3>
                        <p className="text-sm text-slate-400 max-w-[80%]">{errorMessage}</p>
                        <Button onClick={() => window.location.reload()} variant="outline" className="mt-4 border-white/20 text-white hover:bg-white/10">
                            <RefreshCw className="mr-2 h-4 w-4" /> Coba Lagi
                        </Button>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center justify-center flex-1 animate-in zoom-in duration-300">
                        <div className="h-20 w-20 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.6)]">
                            <ShieldCheck className="h-10 w-10 text-white" />
                        </div>
                        <h3 className="font-bold text-xl mt-4">Berhasil Masuk!</h3>
                    </div>
                )}

                {status === 'scanning' && (
                    <div className="w-full text-center pb-8">
                        {/* Scanning Frame Guide */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-48 h-64 border-2 border-white/30 rounded-[32px] border-dashed relative">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="h-64 w-[1px] bg-gradient-to-b from-transparent via-blue-500 to-transparent absolute animate-scan" />
                                </div>
                            </div>
                        </div>
                        <p className="text-sm font-medium text-white/80 drop-shadow-md bg-black/40 py-1 px-3 rounded-full inline-block backdrop-blur-sm">
                            {similarityScore > 0 ? `Match: ${(similarityScore * 100).toFixed(0)}%` : 'Posisikan wajah Anda di tengah'}
                        </p>
                    </div>
                )}
            </div>
        </Card>
    );
}
