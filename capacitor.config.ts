import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dutasol.mruput',
  appName: 'Duta Mruput',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true
  },
  plugins: {
    Camera: {
      permissions: ['camera']
    },
    Geolocation: {
      permissions: ['location', 'coarseLocation']
    },
    CapacitorHttp: {
      enabled: true
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
