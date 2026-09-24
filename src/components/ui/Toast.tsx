import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Info, X, AlertTriangle } from 'lucide-react'
import { cn } from '@/utils/cn'

type ToastKind = 'success' | 'info' | 'error'
interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  description?: string
}

const ToastContext = createContext<((t: Omit<ToastItem, 'id'>) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev.slice(-3), { ...t, id }])
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 4200)
  }, [])

  const icons = { success: Check, info: Info, error: AlertTriangle }

  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed right-4 bottom-4 left-4 z-[60] flex flex-col items-end gap-2 sm:left-auto">
          {items.map((t) => {
            const Icon = icons[t.kind]
            return (
              <div
                key={t.id}
                className="panel pointer-events-auto flex w-full animate-slide-up items-start gap-3 bg-raised px-4 py-3 shadow-2xl sm:w-80"
              >
                <span
                  className={cn(
                    'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
                    t.kind === 'error' ? 'bg-danger/15 text-danger' : 'bg-white text-black',
                  )}
                >
                  <Icon className="size-3" strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
                </div>
                <button
                  onClick={() => setItems((prev) => prev.filter((i) => i.id !== t.id))}
                  className="text-faint hover:text-fg"
                  aria-label="Fechar"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const push = useContext(ToastContext)
  if (!push) throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  return {
    success: (title: string, description?: string) => push({ kind: 'success', title, description }),
    info: (title: string, description?: string) => push({ kind: 'info', title, description }),
    error: (title: string, description?: string) => push({ kind: 'error', title, description }),
  }
}
