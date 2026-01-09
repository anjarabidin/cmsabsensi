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
          width: { ideal: 640 },
          height: { ideal: 480 },
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

      // Ensure video has dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        reject(new Error('Kamera belum siap (dimensions 0)'));
        return;
      }

      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Gagal membuat canvas context'));
          return;
        }

        // Mirror the image for selfie
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Gagal mengkonversi foto'));
            }
          },
          'image/jpeg',
          0.8
        );
      } catch (err: any) {
        reject(new Error('Error saat mengambil foto: ' + err.message));
      }
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
