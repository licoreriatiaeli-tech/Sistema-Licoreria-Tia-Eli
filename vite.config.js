import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'public',
  
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: {
          'vendor-firebase': ['firebase/app', 'firebase/firestore'],
          'vendor-chart': ['chart.js'],
          'utils': ['utils-bundle.js'],
          'services': ['services/event-bus.js', 'services/storage-service.js'],
          'schemas': ['schemas/index.js']
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(assetInfo.name)) {
            return `assets/img/[name]-[hash].${ext}`;
          }
          if (/\.(woff2?|ttf|eot)$/.test(assetInfo.name)) {
            return `assets/fonts/[name]-[hash].${ext}`;
          }
          return `assets/[ext]/[name]-[hash].${ext}`;
        }
      }
    }
  },
  
  server: {
    port: 3000,
    host: true,
    open: true,
    cors: true
  },
  
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'TIA ELI LICORERIA',
        short_name: 'TIA ELI',
        description: 'Sistema de control de inventario y ventas',
        theme_color: '#09090b',
        background_color: '#f4f4f5',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ],
        categories: ['business', 'productivity'],
        screenshots: []
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/www\.gstatic\.com\/firebasejs\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'firebase-sdk-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ],
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@utils': resolve(__dirname, 'utils'),
      '@services': resolve(__dirname, 'services'),
      '@schemas': resolve(__dirname, 'schemas'),
      '@components': resolve(__dirname, 'components')
    }
  },
  
  css: {
    devSourcemap: true
  },
  
  esbuild: {
    drop: ['console', 'debugger'],
    pure: ['console.log']
  }
});