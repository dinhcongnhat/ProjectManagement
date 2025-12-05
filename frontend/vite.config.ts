import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['Icon.jpg', 'Logo.png', 'icons/*.png'],
      manifest: false, // We're using our own manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2}'],
        // Don't cache API calls - always fetch fresh
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
        // Skip waiting - activate new SW immediately
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // API calls - Network only, never cache
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // WebSocket/Socket.io - Network only, never cache
            urlPattern: /\/socket\.io\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // WebSocket upgrade requests
            urlPattern: /\?.*EIO=.*/i,
            handler: 'NetworkOnly',
          }
        ],
        // Don't include these in precache
        globIgnores: ['**/node_modules/**/*', 'sw.js', 'workbox-*.js']
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    cors: true,
    allowedHosts: true,
    hmr: false
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    cors: true,
    allowedHosts: true,
  }
})
