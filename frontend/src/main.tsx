import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { preloadOnlyOfficeScript } from './utils/onlyofficePreload'

// Register service worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Có phiên bản mới! Bạn có muốn cập nhật không?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('Ứng dụng đã sẵn sàng hoạt động offline')
  },
})

// Preload OnlyOffice script in background
preloadOnlyOfficeScript()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
