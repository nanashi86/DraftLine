import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerServiceWorker } from './pwa/register.js'
import { reloadWhenBuildIsStale } from './pwa/staleBuild.js'

// After a deploy, a tab still on the previous build reloads instead of going blank: see src/pwa/staleBuild.js.
reloadWhenBuildIsStale()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline app shell (production builds only): see src/pwa/.
registerServiceWorker({ base: import.meta.env.BASE_URL, prod: import.meta.env.PROD })
