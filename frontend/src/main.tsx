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
    if (confirm('Có phiên bản mới! Bạn có muốn cập nhật không?')) {
      // Clear all caches before update
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => {
            caches.delete(name);
          });
        });
      }
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('Ứng dụng đã sẵn sàng hoạt động offline')
  },
  onRegistered(registration) {
    console.log('SW registered:', registration)
    
    // For installed PWA, check for updates more frequently
    if (isStandalonePWA && registration) {
      setInterval(() => {
        registration.update()
      }, 60 * 1000) // Check every minute
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
      // Dispatch custom event for WebSocket to reconnect
      window.dispatchEvent(new CustomEvent('pwa-visible'))
      
      // Force reload all images to get fresh avatars
      setTimeout(() => {
        const images = document.querySelectorAll('img[src*="/avatar"]');
        images.forEach((img) => {
          const htmlImg = img as HTMLImageElement;
          const currentSrc = htmlImg.src;
          // Add timestamp to bypass cache
          if (currentSrc.includes('/avatar')) {
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
