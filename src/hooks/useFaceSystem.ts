
import { useState, useCallback, useEffect } from 'react';
import * as faceapi from 'face-api.js';

// Configuration
const MODEL_URL = `${import.meta.env.BASE_URL}models/`;
const SCORE_THRESHOLD = 0.4; // For Detection (Lowered for better sensitivity)

interface FaceRecognitionSystem {
    isLoaded: boolean;
    loading: boolean;
    error: string | null;
    loadModels: () => Promise<void>;
    getDeepDescriptor: (videoOrImage: HTMLVideoElement | HTMLImageElement) => Promise<Float32Array | null>;
    computeMatch: (descriptor1: Float32Array, descriptor2: Float32Array) => number;
}

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

export function useFaceSystem(): FaceRecognitionSystem {
    const [status, setStatus] = useState({
        isLoaded: modelsLoaded,
        loading: false,
        error: null as string | null
    });

    const loadModels = useCallback(async () => {
        if (modelsLoaded) return;
        if (loadingPromise) return loadingPromise;

        setStatus(prev => ({ ...prev, loading: true, error: null }));

        loadingPromise = (async () => {
            try {
                console.log('🧠 Loading Deep Learning Models (ResNet-34)...');
                // Load only essential models
                // 1. SsdMobilenetv1 (More robust detection than TinyFace)
                await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
                // 2. FaceLandmark68Net (Required for alignment)
                await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
                // 3. FaceRecognitionNet (The Heavy Hitter - ResNet-34 for 128D Embeddings)
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

                modelsLoaded = true;
                setStatus({ isLoaded: true, loading: false, error: null });
                console.log('✅ Deep Learning Models Ready');
            } catch (err) {
                console.error('Failed to load face models', err);
                setStatus(prev => ({ ...prev, loading: false, error: 'Gagal memuat model AI' }));
                throw err;
            }
        })();

        return loadingPromise;
    }, []);

    // Helper: Extract 128D Vector using ResNet
    const getDeepDescriptor = useCallback(async (input: HTMLVideoElement | HTMLImageElement): Promise<Float32Array | null> => {
        if (!modelsLoaded) await loadModels();

        try {
            // Use SSD Mobilenet for robust locating, then ResNet for recognition
            const detection = await faceapi
                .detectSingleFace(input, new faceapi.SsdMobilenetv1Options({ minConfidence: SCORE_THRESHOLD }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) return null;
            return detection.descriptor;
        } catch (error) {
            console.error('Deep descriptor error:', error);
            return null;
        }
    }, [loadModels]);

    // Helper: Compare 128D Vectors (Euclidean Distance)
    const computeMatch = useCallback((desc1: Float32Array, desc2: Float32Array): number => {
        // Euclidean distance: 0.0 = Identical, > 0.6 = Different
        const distance = faceapi.euclideanDistance(desc1, desc2);

        // Convert to "Similarity Score" (0% to 100%)
        // Rule of thumb: Distance 0.4 is a very strong match (95%+)
        // Distance 0.6 is threshold (60%)
        // Formula: Map [0, 1] distance to [1, 0] similarity
        // But let's be non-linear to penalize bad matches
        const similarity = Math.max(0, 1 - distance);
        return similarity;
    }, []);

    // Auto-load on mount
    useEffect(() => {
        loadModels();
    }, [loadModels]);

    return {
        isLoaded: status.isLoaded,
        loading: status.loading,
        error: status.error,
        loadModels,
        getDeepDescriptor,
        computeMatch
    };
}
