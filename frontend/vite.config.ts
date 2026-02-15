import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Remove console.log and debugger in production
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['Icon.jpg', 'Logo.png', 'icons/icon-*.png'],
      manifest: false, // We're using our own manifest.json
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,svg,jpg,jpeg,webp,woff,woff2}', 'icons/icon-*.png'],
        // Don't include these in precache
        globIgnores: ['**/node_modules/**/*', 'icons/icon.png']
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
    hmr: true,
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    cors: true,
    allowedHosts: true,
  }
}))
