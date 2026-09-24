import { useState, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface KanbanColumn<S extends string> {
  id: S
  label: string
}

/**
 * Kanban genérico com drag and drop nativo (HTML5).
 * Em telas touch, cada card pode oferecer um seletor de etapa (renderCard).
 */
export function Kanban<T extends { id: string }, S extends string>({
  columns,
  items,
  getStatus,
  onMove,
  renderCard,
  columnFooter,
  columnMeta,
}: {
  columns: KanbanColumn<S>[]
  items: T[]
  getStatus: (item: T) => S
  onMove: (item: T, status: S) => void | Promise<void>
  renderCard: (item: T) => ReactNode
  columnFooter?: (status: S) => ReactNode
  columnMeta?: (status: S, items: T[]) => ReactNode
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<S | null>(null)

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-3">
        {columns.map((col) => {
          const colItems = items.filter((i) => getStatus(i) === col.id)
          const isOver = overCol === col.id && dragId !== null
          return (
            <section
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (overCol !== col.id) setOverCol(col.id)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/plain') || dragId
                const item = items.find((i) => i.id === id)
                setOverCol(null)
                setDragId(null)
                if (item && getStatus(item) !== col.id) void onMove(item, col.id)
              }}
              data-column={col.id}
              className={cn(
                'flex w-[280px] shrink-0 flex-col rounded-2xl border bg-ink/60 transition-all duration-200',
                isOver ? 'border-white/40 bg-white/[0.04] shadow-[0_0_0_4px_rgba(255,255,255,0.04)]' : 'border-line',
              )}
            >
              <header className="flex items-center justify-between gap-2 px-3.5 pt-3.5 pb-2">
                <div className="flex items-center gap-2">
                  <span className="eyebrow text-fg-soft">{col.label}</span>
                  <span className="rounded-md border border-line px-1.5 font-mono text-[10px] text-muted">{colItems.length}</span>
                </div>
                {columnMeta?.(col.id, colItems)}
              </header>
              <div className="flex min-h-[140px] flex-1 flex-col gap-2 p-2">
                {colItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    data-card={item.id}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.id)
                      e.dataTransfer.effectAllowed = 'move'
                      setDragId(item.id)
                    }}
                    onDragEnd={() => {
                      setDragId(null)
                      setOverCol(null)
                    }}
                    className={cn(
                      'cursor-grab animate-scale-in active:cursor-grabbing',
                      dragId === item.id && 'opacity-40',
                    )}
                  >
                    {renderCard(item)}
                  </div>
                ))}
                {colItems.length === 0 && (
                  <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-line py-8 text-xs text-faint">
                    Arraste para cá
                  </div>
                )}
              </div>
              {columnFooter && <div className="px-2 pb-2">{columnFooter(col.id)}</div>}
            </section>
          )
        })}
      </div>
    </div>
  )
}
