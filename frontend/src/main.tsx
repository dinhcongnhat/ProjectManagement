import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { preloadOnlyOfficeScript } from './utils/onlyofficePreload'

// Check if running as installed PWA
const isStandalonePWA = window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
  document.referrer.includes('android-app://');

// Register service worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('[SW] New version available, auto-updating...');
    // Clear only app caches (not push subscription related)
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          // Only clear app/asset caches, preserve push-related state
          if (name.startsWith('pwa-cache') || name.startsWith('workbox-')) {
            caches.delete(name);
          }
        });
      });
    }
    // Auto-apply the update
    updateSW(true);
  },
  onOfflineReady() {
    console.log('Ứng dụng đã sẵn sàng hoạt động offline')
  },
  onRegistered(registration) {
    console.log('SW registered:', registration)

    // Check for updates periodically
    if (registration) {
      // For PWA: check every 2 minutes, for browser: every 5 minutes
      const interval = isStandalonePWA ? 2 * 60 * 1000 : 5 * 60 * 1000;
      setInterval(() => {
        registration.update()
      }, interval)
    }
  },
  onRegisterError(error) {
    console.error('SW registration error:', error)
  }
})

// For PWA: Listen for visibility changes to refresh connection
if (isStandalonePWA) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('[PWA] App became visible, checking connection...')
      // Trigger checkSession from AuthContext if available
      // Dispatch custom event that AuthContext or App listens to
      window.dispatchEvent(new CustomEvent('pwa-resume'));

      // Force reload all images to get fresh avatars
      setTimeout(() => {
        const images = document.querySelectorAll('img[src*="/avatar"]');
        images.forEach((img) => {
          const htmlImg = img as HTMLImageElement;
          const currentSrc = htmlImg.src;
          // Add timestamp to bypass cache if not already presenting
          if (currentSrc.includes('/avatar')) {
            // Logic to refresh avatar...
            const url = new URL(currentSrc);
            url.searchParams.set('_t', Date.now().toString());
            htmlImg.src = url.toString();
          }
        });
      }, 500);
    }
  })

  // Handle online/offline
  window.addEventListener('online', () => {
    console.log('[PWA] Back online')
    window.dispatchEvent(new CustomEvent('pwa-online'))
  })

  console.log('[PWA] Running as installed PWA')
}

// Preload OnlyOffice script in background
preloadOnlyOfficeScript()



createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
