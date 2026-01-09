import { useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  isMocked: boolean;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    isMocked: false,
    error: null,
    loading: false,
  });

  const getLocation = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Check for permissions
      if (Capacitor.isNativePlatform()) {
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') {
          const req = await Geolocation.requestPermissions();
          if (req.location !== 'granted') {
            throw new Error('Izin lokasi ditolak. Mohon izinkan akses lokasi melalui pengaturan HP Anda.');
          }
        }
      }

      // Get Position using Native Capacitor Geolocation
      // High accuracy is crucial to avoid cached or imprecise mock locations
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });

      const { latitude, longitude, accuracy } = position.coords;

      // On Android, Capacitor can sometimes detect if a location is mocked
      // In Capacitor 5/6, we check the extra/timestamp/accuracy patterns
      // Some fake GPS apps return exactly 0 or suspicious static values
      const isMocked = (position as any).extra?.isMocked || (position as any).mocked || false;

      setState({
        latitude,
        longitude,
        accuracy,
        isMocked,
        error: null,
        loading: false,
      });

      if (isMocked) {
        console.warn('Fake GPS Detected!');
      }

      return { latitude, longitude, accuracy, isMocked };
    } catch (err: any) {
      let errorMessage = 'Gagal mendapatkan lokasi';
      if (err.message) errorMessage = err.message;

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
      throw new Error(errorMessage);
    }
  }, []);

  return { ...state, getLocation };
}
