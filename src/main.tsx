import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { DataProvider } from '@/context/DataContext'
import { SessionProvider } from '@/context/SessionContext'
import { ToastProvider } from '@/components/ui/Toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <SessionProvider>
        <DataProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </DataProvider>
      </SessionProvider>
    </HashRouter>
  </StrictMode>,
)
