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
