import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const usePushNotifications = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (Capacitor.isNativePlatform() && user?.id) {
            registerPush();
        }
    }, [user?.id]);

    const registerPush = async () => {
        try {
            // Check performance
            let permStatus = await PushNotifications.checkPermissions();

            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            if (permStatus.receive !== 'granted') {
                console.warn('User denied push notification permissions');
                return;
            }

            await PushNotifications.register();

            // On success, we get a token
            PushNotifications.addListener('registration', async (token) => {
                console.log('Push registration success, token: ' + token.value);

                // Save token to Supabase
                const { error } = await supabase
                    .from('fcm_tokens' as any)
                    .upsert({
                        user_id: user?.id,
                        token: token.value,
                        device_type: Capacitor.getPlatform()
                    }, { onConflict: 'user_id, token' });

                if (error) console.error('Error saving FCM token:', error);
            });

            PushNotifications.addListener('registrationError', (error: any) => {
                console.error('Error on registration: ' + JSON.stringify(error));
            });

            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('Push received: ' + JSON.stringify(notification));
            });

            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                console.log('Push action performed: ' + JSON.stringify(notification));
            });

        } catch (error) {
            console.error('Push notification registration failed', error);
        }
    };
};
