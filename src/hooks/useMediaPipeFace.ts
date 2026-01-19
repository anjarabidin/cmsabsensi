import { useState, useCallback, useRef } from 'react';
import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import faceLandmarkerModel from '@/assets/mediapipe/face_landmarker.task?url';

interface MediaPipeFaceState {
    isReady: boolean;
    isLoading: boolean;
    error: string | null;
}

export interface FaceDetectionResult {
    landmarks: any;
    blendshapes: any;
    faceDescriptor: Float32Array;
}

let globalFaceLandmarker: FaceLandmarker | null = null;
let globalInitPromise: Promise<void> | null = null;

export function useMediaPipeFace() {
    const [state, setState] = useState<MediaPipeFaceState>({
        isReady: !!globalFaceLandmarker,
        isLoading: false,
        error: null,
    });

    const faceLandmarkerRef = useRef<FaceLandmarker | null>(globalFaceLandmarker);

    // Initialize MediaPipe Face Landmarker
    const initialize = useCallback(async () => {
        if (globalFaceLandmarker) {
            setState({ isReady: true, isLoading: false, error: null });
            return;
        }

        if (globalInitPromise) {
            await globalInitPromise;
            setState({ isReady: true, isLoading: false, error: null });
            return;
        }

        globalInitPromise = (async () => {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            try {
                console.log('🚀 Initializing MediaPipe Face Landmarker...');

                const vision = await FilesetResolver.forVisionTasks(
                    '/wasm'
                );

                console.log('✅ Vision tasks loaded, creating Face Landmarker...');

                globalFaceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: faceLandmarkerModel,
                        delegate: 'CPU' // Changed to CPU for better compatibility
                    },
                    runningMode: 'VIDEO',
                    numFaces: 1,
                    minFaceDetectionConfidence: 0.5,
                    minFacePresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                    outputFaceBlendshapes: true,
                    outputFacialTransformationMatrixes: false
                });

                faceLandmarkerRef.current = globalFaceLandmarker;

                console.log('✅ MediaPipe Face Landmarker Ready!');
                setState({ isReady: true, isLoading: false, error: null });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to initialize MediaPipe';
                console.error('❌ MediaPipe initialization error:', error);
                setState({ isReady: false, isLoading: false, error: errorMessage });
                globalInitPromise = null;
                throw error;
            }
        })();

        await globalInitPromise;
    }, []);

    // Detect face in video frame
    const detectFace = useCallback(async (videoElement: HTMLVideoElement): Promise<FaceLandmarkerResult | null> => {
        if (!globalFaceLandmarker) {
            console.warn('Face Landmarker not initialized');
            return null;
        }

        try {
            const timestamp = performance.now();
            const result = globalFaceLandmarker.detectForVideo(videoElement, timestamp);
            return result;
        } catch (error) {
            console.error('Face detection error:', error);
            return null;
        }
    }, []);

    // Extract face descriptor from landmarks (Improved: Position & Scale Invariant)
    const getFaceDescriptor = useCallback((result: FaceLandmarkerResult): Float32Array | null => {
        if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
            return null;
        }

        const landmarks = result.faceLandmarks[0];

        // 1. Calculate Face Centroid (Geometric Center)
        let cx = 0, cy = 0, cz = 0;
        for (const point of landmarks) {
            cx += point.x;
            cy += point.y;
            cz += (point.z || 0);
        }
        cx /= landmarks.length;
        cy /= landmarks.length;
        cz /= landmarks.length;

        // 2. Calculate Scale (Inter-pupillary distance or similar stable metric)
        // Using distance between iris centers (468: Left, 473: Right) if available, else eye corners
        let p1 = landmarks[468] || landmarks[33];  // Left Eye
        let p2 = landmarks[473] || landmarks[263]; // Right Eye

        let scale = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
        if (scale === 0) scale = 1.0; // Prevent division by zero

        // Select key facial points for descriptor (Geometric Layout)
        // We'll use strategic points representing the facial structure
        const keyIndices = [
            // Left eye contour
            33, 133, 157, 158, 159, 160, 161, 163, 144, 145, 153, 154,
            // Right eye contour
            263, 362, 373, 374, 380, 381, 382, 384, 385, 386, 387, 388,
            // Nose bridge & tip
            1, 2, 98, 327, 168, 197, 195, 5, 4,
            // Lips (Inner & Outer)
            61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, // Outer
            78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, // Inner
            // Chin & Jawline
            152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
            // Eyebrows
            70, 63, 105, 66, 107, 336, 296, 334, 293, 300
        ];

        // 3. Extract & Normalize Coordinates
        const descriptor: number[] = [];
        keyIndices.forEach(idx => {
            if (idx < landmarks.length) {
                const point = landmarks[idx];
                // Normalize relative to centroid and scale
                // This makes the descriptor independent of where the face is in the image (Translation Invariance)
                // And independent of how close the face is (Scale Invariance)
                descriptor.push((point.x - cx) / scale);
                descriptor.push((point.y - cy) / scale);
                // Z is usually depth relative to head center, but also scale it
                descriptor.push(((point.z || 0)) / scale);
            }
        });

        // 4. L2 Normalization (Unit Vector)
        // This ensures the vector magnitude is 1, optimal for Cosine Similarity
        const magnitude = Math.sqrt(descriptor.reduce((sum, val) => sum + val * val, 0));
        const normalized = descriptor.map(val => val / (magnitude || 1));

        return new Float32Array(normalized);
    }, []);

    // Compare two face descriptors (returns similarity score 0-1)
    const compareFaces = useCallback((desc1: Float32Array, desc2: Float32Array): number => {
        if (desc1.length !== desc2.length) {
            console.warn('Descriptor length mismatch');
            return 0;
        }

        // Cosine similarity
        let dotProduct = 0;
        let mag1 = 0;
        let mag2 = 0;

        for (let i = 0; i < desc1.length; i++) {
            dotProduct += desc1[i] * desc2[i];
            mag1 += desc1[i] * desc1[i];
            mag2 += desc2[i] * desc2[i];
        }

        mag1 = Math.sqrt(mag1);
        mag2 = Math.sqrt(mag2);

        if (mag1 === 0 || mag2 === 0) return 0;

        const similarity = dotProduct / (mag1 * mag2);
        return Math.max(0, Math.min(1, similarity));
    }, []);

    // Check eye blink using blendshapes
    const checkBlink = useCallback((result: FaceLandmarkerResult): boolean => {
        if (!result.faceBlendshapes || result.faceBlendshapes.length === 0) {
            return false;
        }

        const blendshapes = result.faceBlendshapes[0].categories;

        const leftEyeBlink = blendshapes.find(cat => cat.categoryName === 'eyeBlinkLeft');
        const rightEyeBlink = blendshapes.find(cat => cat.categoryName === 'eyeBlinkRight');

        const threshold = 0.3; // Adjust based on testing
        const leftClosed = (leftEyeBlink?.score || 0) > threshold;
        const rightClosed = (rightEyeBlink?.score || 0) > threshold;

        return leftClosed && rightClosed;
    }, []);

    return {
        ...state,
        initialize,
        detectFace,
        getFaceDescriptor,
        compareFaces,
        checkBlink,
        faceLandmarker: faceLandmarkerRef.current,
    };
}

