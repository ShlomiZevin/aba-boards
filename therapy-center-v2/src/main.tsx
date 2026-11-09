import { IS_DEMO } from './demo/demoFetch'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './v2/notebook.css'

// v2 design system root class (see src/v2/notebook.css)
document.documentElement.classList.add('nb')
if (IS_DEMO) document.documentElement.classList.add('nb-demo')
import { runSlidesMigrationsIfNeeded } from './pages/slides/auth'

// Wipe stale per-slide localStorage overrides whenever slide IDs are remapped
// (see CURRENT_SLIDES_VERSION in pages/slides/auth.ts)
runSlidesMigrationsIfNeeded();

// Lets Android (older Chrome too) install Doing as an app on the home screen. Caches nothing.
if (import.meta.env.PROD && !IS_DEMO && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
