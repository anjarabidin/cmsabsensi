import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: './',
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.png', 'robots.txt'],
      manifest: {
        name: "CMS Absensi Enterprise",
        short_name: "Duta Mruput",
        description: "Aplikasi Absensi dan HRIS Terintegrasi",
        theme_color: "#2563eb",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/logo.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/logo.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15MB untuk mengakomodasi file WASM AI yang besar
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 3000, // Naikkan limit warning ke 3MB (karena AI models memang besar)
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs', 'lucide-react'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          'vendor-ai': ['@mediapipe/tasks-vision', 'face-api.js'],
          'vendor-supabase': ['@supabase/supabase-js'],
        }
      }
    }
  }
}));
