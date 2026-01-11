import { useState, useRef, useCallback } from 'react';

interface CameraState {
  stream: MediaStream | null;
  error: string | null;
  isActive: boolean;
}

export function useCamera() {
  const [state, setState] = useState<CameraState>({
    stream: null,
    error: null,
    isActive: false,
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Kamera tidak didukung di browser ini');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 480 },
          height: { ideal: 360 },
        },
      });

      setState({
        stream,
        error: null,
        isActive: true,
      });

      return stream;
    } catch (error) {
      let errorMessage = 'Gagal mengakses kamera';

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Izin kamera ditolak. Silakan aktifkan izin kamera di browser Anda';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'Kamera tidak ditemukan';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Kamera sedang digunakan oleh aplikasi lain';
        }
      }

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isActive: false,
      }));

      throw new Error(errorMessage);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
    }
    setState({
      stream: null,
      error: null,
      isActive: false,
    });
  }, [state.stream]);

  const capturePhoto = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!videoRef.current || !state.stream) {
        reject(new Error('Kamera belum aktif'));
        return;
      }

      const video = videoRef.current;
      let retries = 0;
      const maxRetries = 10; // 10 * 300ms = 3 seconds

      const checkReadiness = () => {
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          captureNow();
        } else if (retries < maxRetries) {
          retries++;
          setTimeout(checkReadiness, 300);
        } else {
          reject(new Error('Kamera belum siap setelah 3 detik. Pastikan pencahayaan cukup dan coba lagi.'));
        }
      };

      const captureNow = () => {
        try {
          const canvas = document.createElement('canvas');
          // Use video dimensions or fallback to ideal
          canvas.width = video.videoWidth || 480;
          canvas.height = video.videoHeight || 360;

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            reject(new Error('Gagal membuat canvas context'));
            return;
          }

          // Apply beauty filters
          ctx.filter = 'brightness(1.08) contrast(1.05) saturate(1.1)';

          // Capture as-is (natural orientation)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Gagal mengkonversi foto'));
              }
            },
            'image/jpeg',
            0.85
          );
        } catch (err: any) {
          reject(new Error('Error saat mengambil foto: ' + err.message));
        }
      };

      checkReadiness();
    });
  }, [state.stream]);

  return {
    ...state,
    videoRef,
    startCamera,
    stopCamera,
    capturePhoto,
  };
}
