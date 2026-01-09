import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dutasol.mruput',
  appName: 'Duta Mruput',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true
  }
};

export default config;
