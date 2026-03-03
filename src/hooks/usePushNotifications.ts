import { useEffect, useRef, useCallback, useMemo } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// ⚠️  CATATAN KEAMANAN (Firebase Web Config):
// Config ini adalah CLIENT-SIDE config yang memang HARUS ada di frontend.
// Firebase dirancang agar API key ini terekspos — keamanan dijaga oleh
// Firebase Security Rules, bukan oleh kerahasiaan config ini.
// Ref: https://firebase.google.com/docs/projects/api-keys
//
// Yang TIDAK boleh diekspos: Firebase Admin SDK / Service Account private key.
// Itu disimpan HANYA di Supabase Edge Function env variables.
const firebaseConfig = {
    apiKey: "AIzaSyDeuXMVp1Y4Ss-Py4-qeTlZYqDk-s7Xg-s",
    authDomain: "cmsabsensibenar.firebaseapp.com",
    projectId: "cmsabsensibenar",
    storageBucket: "cmsabsensibenar.firebasestorage.app",
    messagingSenderId: "1005997535417",
    appId: "1:1005997535417:web:b73c7477ea5af5134d2b68",
};

// Guard: Hindari re-initialize Firebase saat hot-reload (React dev mode)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const messaging = getMessaging(app);

export const usePushNotifications = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const hasRegistered = useRef(false);

    useEffect(() => {
        if (user?.id && !hasRegistered.current) {
            registerPush();
            hasRegistered.current = true;
        }
    }, [user?.id]);

    const registerPush = useCallback(async () => {
        if (!user?.id) return;

        // --- NATIVE PLATFORM (Android/iOS) ---
        if (Capacitor.isNativePlatform()) {
            try {
                let permStatus = await PushNotifications.checkPermissions();

                if (permStatus.receive === 'prompt') {
                    permStatus = await PushNotifications.requestPermissions();
                }

                if (permStatus.receive !== 'granted') {
                    console.warn('User denied native push notification permissions');
                    return;
                }

                await PushNotifications.addListener('registration', async (token) => {
                    console.log('Native Push registration success');
                    await saveTokenToDatabase(token.value, 'native');
                    localStorage.setItem('fcm_token_native', token.value);
                });

                await PushNotifications.addListener('registrationError', (error: any) => {
                    console.error('Error on registration: ' + JSON.stringify(error));
                });

                await PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    toast({
                        title: notification.title || "Notifikasi Baru",
                        description: notification.body || "Anda menerima pesan baru.",
                    });
                });

                if (Capacitor.getPlatform() === 'android') {
                    await PushNotifications.createChannel({
                        id: 'default',
                        name: 'Default',
                        description: 'General Notifications',
                        importance: 5,
                        visibility: 1,
                        vibration: true,
                    });
                }

                await PushNotifications.register();
            } catch (error) {
                console.error('Native push registration failed', error);
            }
        }
        // --- WEB PLATFORM (PWA) ---
        else {
            try {
                console.log('Requesting notification permission...');
                let permission = Notification.permission;
                if (permission === 'default') {
                    permission = await Notification.requestPermission();
                }

                if (permission !== 'granted') {
                    console.warn('User denied web push permissions');
                    return;
                }

                // Explicitly register our specific messaging service worker
                console.log('Registering messaging service worker...');
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                    scope: '/'
                });
                console.log('Messaging service worker registered:', registration);

                // Try to register periodic sync (the 'lure' to keep SW alive)
                if ('periodicSync' in registration) {
                    try {
                        const status = await (navigator as any).permissions.query({
                            name: 'periodic-background-sync',
                        });
                        if (status.state === 'granted') {
                            await (registration as any).periodicSync.register('fcm-heartbeat', {
                                minInterval: 24 * 60 * 60 * 1000, // 24 hours
                            });
                        }
                    } catch (e) {
                        console.log('Periodic sync registration failed (expected if not granted or standalone):', e);
                    }
                }

                // Get FCM token using Firebase SDK
                const VAPID_PUBLIC_KEY = 'BCT-K19g5pQvHIioEfMYsz0_J1GW9KTxOsYIxWDGAr_fNfsuE3O5q5iijBHIhm1TCfpkjy-DGsaVE51OHH7Gcxo';

                console.log('Getting FCM registration token for PWA...');
                const token = await getToken(messaging, {
                    vapidKey: VAPID_PUBLIC_KEY,
                    serviceWorkerRegistration: registration
                });

                if (token) {
                    console.log('PWA token received successfully:', token);

                    // Only save and toast if the token is different from what we last saved
                    const lastToken = localStorage.getItem('fcm_token_pwa');
                    if (lastToken !== token) {
                        await saveTokenToDatabase(token, 'pwa');
                        localStorage.setItem('fcm_token_pwa', token);

                        toast({
                            title: "PWA Push Aktif",
                        });
                    }

                    // Listen for foreground messages
                    onMessage(messaging, (payload) => {
                        console.log('Foreground message received:', payload);
                        toast({
                            title: payload.notification?.title || "Notifikasi Baru",
                            description: payload.notification?.body || "Anda menerima pesan baru.",
                        });
                    });
                } else {
                    console.warn('No registration token available. Request permission to generate one.');
                }

            } catch (error) {
                console.error('Web push registration failed:', error);
            }
        }
    }, [user?.id, toast]);

    const sendTestPush = useCallback(async () => {
        if (!user?.id) return;

        try {
            toast({ title: "Mengirim Test...", description: "Harap tunggu sebentar." });

            const { data, error } = await supabase.functions.invoke('send-push-notification', {
                body: {
                    userId: user.id,
                    title: "Test Notifikasi 🚀",
                    body: "Jika Anda menerima ini, berarti push notifikasi Anda AKTIF!",
                    data: { type: 'test' }
                }
            });

            if (error) throw error;

            return { success: true, data };
        } catch (error: any) {
            console.error('Test push failed:', error);
            toast({
                title: "Test Gagal",
                description: error.message || "Pastikan Anda sudah mengizinkan notifikasi.",
                variant: 'destructive'
            });
            return { success: false, error };
        }
    }, [user?.id, toast]);

    const saveTokenToDatabase = async (tokenValue: string, platform: string) => {
        if (!user?.id) return;

        try {
            // Delete ALL old tokens for this user first to prevent duplicate push notifications
            // Each browser/device generates a unique token, but we only want the LATEST one
            await supabase
                .from('fcm_tokens' as any)
                .delete()
                .eq('user_id', user.id)
                .neq('token', tokenValue); // Keep current token if already exists

            // Upsert the current token
            const { error } = await supabase
                .from('fcm_tokens' as any)
                .upsert({
                    user_id: user.id,
                    token: tokenValue,
                    device_type: platform,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, token' });

            if (error) console.error('Error saving push token to database:', error);
        } catch (e) {
            console.error('Exception saving push token:', e);
        }
    };

    return useMemo(() => ({
        permission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
        isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream,
        isStandalone: (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches,
        isOptimized: localStorage.getItem('notif_guide_completed') === 'true',
        completeGuide: () => {
            localStorage.setItem('notif_guide_completed', 'true');
            window.dispatchEvent(new Event('storage')); // Notify other components
        },
        register: registerPush,
        sendTestPush
    }), [registerPush, sendTestPush]);
};

