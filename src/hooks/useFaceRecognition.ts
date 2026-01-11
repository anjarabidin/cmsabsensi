import { useState, useCallback, useEffect } from 'react';
import * as faceapi from 'face-api.js';

interface FaceRecognitionState {
    modelsLoaded: boolean;
    loading: boolean;
    error: string | null;
}

let globalModelsPromise: Promise<boolean> | null = null;
let globalModelsLoaded = false;

export function useFaceRecognition() {
    const [state, setState] = useState<FaceRecognitionState>({
        modelsLoaded: globalModelsLoaded,
        loading: false,
        error: null,
    });

    // Load face-api.js models
    const loadModels = useCallback(async () => {
        if (globalModelsLoaded) {
            if (!state.modelsLoaded) setState(prev => ({ ...prev, modelsLoaded: true }));
            return true;
        }

        if (globalModelsPromise) return globalModelsPromise;

        globalModelsPromise = (async () => {
            setState(prev => ({ ...prev, loading: true, error: null }));
            try {
                const MODEL_URL = '/models';
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                ]);
                globalModelsLoaded = true;
                setState({ modelsLoaded: true, loading: false, error: null });
                console.log('✅ Face recognition models loaded (Global)');
                return true;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to load models';
                setState({ modelsLoaded: false, loading: false, error: errorMessage });
                console.error('❌ Failed to load face recognition models:', error);
                globalModelsPromise = null;
                return false;
            }
        })();

        return globalModelsPromise;
    }, [state.modelsLoaded]);

    // Auto-load models on mount
    useEffect(() => {
        loadModels();
    }, [loadModels]);

    // Detect face in video element
    const detectFace = useCallback(async (videoElement: HTMLVideoElement) => {
        if (!globalModelsLoaded) {
            await loadModels();
        }

        try {
            const detection = await faceapi
                .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            return detection;
        } catch (error) {
            console.error('Face detection error:', error);
            return null;
        }
    }, [state.modelsLoaded]);

    // Get face descriptor (encoding) from video
    const getFaceDescriptor = useCallback(async (videoElement: HTMLVideoElement): Promise<Float32Array | null> => {
        const detection = await detectFace(videoElement);
        return detection?.descriptor || null;
    }, [detectFace]);

    // Compare two face descriptors
    const compareFaces = useCallback((descriptor1: Float32Array, descriptor2: Float32Array): number => {
        const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
        // Convert distance to similarity score (0-1, higher is more similar)
        const similarity = 1 - Math.min(distance, 1);
        return similarity;
    }, []);

    // Check if face is detected in frame
    const isFaceInFrame = useCallback(async (videoElement: HTMLVideoElement): Promise<boolean> => {
        const detection = await detectFace(videoElement);
        return detection !== null;
    }, [detectFace]);

    // Draw face detection box on canvas
    const drawFaceDetection = useCallback((
        canvas: HTMLCanvasElement,
        detection: faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>>
    ) => {
        const displaySize = { width: canvas.width, height: canvas.height };
        faceapi.matchDimensions(canvas, displaySize);

        const resizedDetection = faceapi.resizeResults(detection, displaySize);

        // Clear canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        // Draw detection box and landmarks
        faceapi.draw.drawDetections(canvas, resizedDetection);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetection);
    }, []);

    return {
        ...state,
        loadModels,
        detectFace,
        getFaceDescriptor,
        compareFaces,
        isFaceInFrame,
        drawFaceDetection,
    };
}
