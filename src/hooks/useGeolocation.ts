import { useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

// Utility to calculate distance between two coordinates in meters (Haversine Formula)
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d * 1000; // Distance in meters
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  isMocked: boolean;
  error: string | null;
  loading: boolean;
  // For fake GPS detection
  lastLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  };
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

  const getLocation = useCallback(async (retryCount = 0) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Check if running in PWA (browser) or native
      const isNative = Capacitor.isNativePlatform();
      const isIOS = Capacitor.getPlatform() === 'ios';
      const isAndroid = Capacitor.getPlatform() === 'android';
      
      console.log('Platform detection:', { isNative, isIOS, isAndroid });

      let position: any;

      if (isNative) {
        // Native App Logic (previous implementation)
        const perm = await Geolocation.checkPermissions();
        
        if (isIOS) {
          if (perm.location !== 'granted') {
            console.log('iOS: Requesting location permissions...');
            const req = await Geolocation.requestPermissions();
            if (req.location !== 'granted') {
              throw new Error('Akses Lokasi Ditolak. Mohon aktifkan izin lokasi di Pengaturan > Privasi > Lokasi > Saat Menggunakan Aplikasi.');
            }
          }
        } else {
          if (perm.location !== 'granted') {
            const req = await Geolocation.requestPermissions();
            if (req.location !== 'granted') {
              throw new Error('Akses Lokasi Ditolak. Mohon aktifkan izin lokasi di pengaturan HP Anda.');
            }
          }
        }

        position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: isIOS ? 15000 : 10000,
          maximumAge: isIOS ? 10000 : 0,
          ...(isIOS && { 
            desiredAccuracy: 10
          })
        });
      } else {
        // PWA Logic - Use Browser Native Geolocation
        console.log('PWA: Using browser native geolocation');
        
        position = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error('Browser tidak mendukung geolocation. Pastikan menggunakan browser modern.'));
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            (error) => {
              console.error('PWA Geolocation error:', error);
              reject(error);
            },
            {
              enableHighAccuracy: true,
              timeout: isIOS ? 20000 : 15000, // PWA needs more timeout
              maximumAge: isIOS ? 15000 : 5000  // PWA can use more cached data
            }
          );
        });
      }

      let { latitude, longitude, accuracy } = position.coords;

      console.log(`${isNative ? (isIOS ? 'Native iOS' : 'Native Android') : 'PWA'} GPS Result:`, {
        latitude,
        longitude,
        accuracy,
        timestamp: position.timestamp
      });

      // If accuracy is poor (> 50m) and it's the first try, try again
      if (accuracy > 50 && retryCount < 2) {
        console.warn(`GPS accuracy poor (${accuracy}m), retrying...`);
        return getLocation(retryCount + 1);
      }

      // Anti-Fake GPS Logic (Enhanced for both PWA and Native)
      let isMocked = false;
      let fakeGpsIndicators = [];

      if (isNative) {
        // Native App Detection
        // @ts-ignore
        const nativeMocked = position.coords.isMocked || (position as any).extra?.isMocked || (position as any).mocked || false;
        if (nativeMocked) {
          fakeGpsIndicators.push('Native isMocked flag');
        }
      } else {
        // PWA Detection Methods
        console.log('PWA: Running fake GPS detection...');
        
        // 1. Check for unrealistic accuracy
        if (accuracy && accuracy < 1) {
          fakeGpsIndicators.push('Unrealistic high accuracy (< 1m)');
        }
        
        // 2. Check for impossible movement speed
        if (state.lastLocation && latitude && longitude) {
          const distance = getDistanceFromLatLonInM(
            state.lastLocation.latitude,
            state.lastLocation.longitude,
            latitude,
            longitude
          );
          const timeDiff = (position.timestamp - state.lastLocation.timestamp) / 1000; // seconds
          const speed = distance / timeDiff; // meters per second
          
          // Max realistic human running speed ~ 12 m/s (43 km/h)
          if (speed > 50) { // 180 km/h - definitely fake
            fakeGpsIndicators.push(`Impossible speed detected: ${speed.toFixed(1)} m/s`);
          } else if (speed > 20) { // 72 km/h - very suspicious
            fakeGpsIndicators.push(`Suspicious speed detected: ${speed.toFixed(1)} m/s`);
          }
        }
        
        // 3. Check for impossible coordinates
        if (latitude === 0 || longitude === 0) {
          fakeGpsIndicators.push('Null Island coordinates (0,0)');
        }
        
        // 4. Check for consistency between accuracy and timestamp
        const now = Date.now();
        const timeDiff = Math.abs(now - position.timestamp);
        if (timeDiff > 60000) { // More than 1 minute old
          fakeGpsIndicators.push('Stale GPS data (> 1min old)');
        }
        
        // 5. Check for browser developer tools manipulation
        if (window.navigator.userAgent.includes('Dev') || window.location.hostname === 'localhost') {
          // Only in development, but log it
          console.log('Development environment detected');
        }
      }

      // Additional checks for both PWA and Native
      // 6. Check for impossible coordinates
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        fakeGpsIndicators.push('Impossible coordinate ranges');
      }

      // 7. Check for GPS spoofing patterns
      if (accuracy && Number.isInteger(accuracy) && accuracy === 0) {
        fakeGpsIndicators.push('Perfect zero accuracy (suspicious)');
      }

      // Final determination
      isMocked = fakeGpsIndicators.length > 0;
      
      if (isMocked) {
        console.warn('Fake GPS detected:', fakeGpsIndicators);
      }

      // Update state with new location data
      setState((prev) => ({
        latitude,
        longitude,
        accuracy,
        isMocked,
        error: null,
        loading: false,
        // Store current location for next fake GPS check
        lastLocation: latitude && longitude ? {
          latitude,
          longitude,
          timestamp: position.timestamp
        } : prev.lastLocation
      }));

      return { latitude, longitude, accuracy, isMocked };
    } catch (err: any) {
      console.error('GPS Fetch Error:', err);
      const isNative = Capacitor.isNativePlatform();
      const isIOS = Capacitor.getPlatform() === 'ios';

      // Auto-retry once if it was a timeout
      if (retryCount < 1) {
        return getLocation(retryCount + 1);
      }

      let errorMessage = 'GPS tidak terkunci. Pastikan GPS HP Aktif dan Anda berada di area terbuka.';
      
      if (err.code === 1 || err.message?.includes('denied') || err.message?.includes('permission')) {
        if (isNative && isIOS) {
          errorMessage = 'Izin lokasi ditolak. Buka Pengaturan > Privasi & Keamanan > Lokasi > Saat Menggunakan Aplikasi.';
        } else if (isNative) {
          errorMessage = 'Izin lokasi ditolak. Cek pengaturan aplikasi.';
        } else {
          // PWA Error Messages
          if (isIOS) {
            errorMessage = 'Izin lokasi ditolak. Buka Pengaturan > Safari > Lokasi > Izinkan Lokasi, atau gunakan Chrome.';
          } else {
            errorMessage = 'Izin lokasi ditolak. Klik ikon lokasi di address bar browser dan pilih Izinkan.';
          }
        }
      } else if (err.code === 3 || err.message?.includes('timeout')) {
        if (isNative && isIOS) {
          errorMessage = 'GPS Timeout. Pastikan Location Services aktif dan coba refresh. Buka Pengaturan > Privasi & Keamanan > Location Services.';
        } else if (isNative) {
          errorMessage = 'GPS Timeout. Sinyal GPS lemah, coba refresh kembali atau berpindah ke area terbuka.';
        } else {
          // PWA Timeout
          errorMessage = 'GPS Timeout. Pastikan lokasi diaktifkan di browser dan coba di area dengan sinyal GPS baik.';
        }
      } else if (err.message?.includes('network')) {
        errorMessage = 'Tidak ada koneksi internet. GPS memerlukan koneksi untuk kalibrasi.';
      } else if (!isNative && err.message?.includes('not supported')) {
        errorMessage = 'Browser tidak mendukung GPS. Gunakan Chrome, Safari, atau Firefox modern.';
      }

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
