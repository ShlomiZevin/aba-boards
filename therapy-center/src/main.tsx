import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { runSlidesMigrationsIfNeeded } from './pages/slides/auth'

// Wipe stale per-slide localStorage overrides whenever slide IDs are remapped
// (see CURRENT_SLIDES_VERSION in pages/slides/auth.ts)
runSlidesMigrationsIfNeeded();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
