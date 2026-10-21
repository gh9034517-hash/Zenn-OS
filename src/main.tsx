import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { DataProvider } from '@/context/DataContext'
import { SpacesProvider } from '@/context/SpacesContext'
import { SessionProvider } from '@/context/SessionContext'
import { ToastProvider } from '@/components/ui/Toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <SessionProvider>
        <DataProvider>
          <SpacesProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </SpacesProvider>
        </DataProvider>
      </SessionProvider>
    </HashRouter>
  </StrictMode>,
)

// App instalável (tela inicial do celular). Só no site publicado.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
