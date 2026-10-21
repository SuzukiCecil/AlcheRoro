import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { CardGallery } from './components/CardGallery'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {new URLSearchParams(location.search).has('gallery') ? <CardGallery /> : <App />}
  </StrictMode>,
)

// ゲーム集（IPPUKU GAMES）のサービスワーカー。ホーム画面に追加したときオフラインでも遊べるようにする（本番だけ）
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
