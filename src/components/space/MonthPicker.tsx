import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths, currentYM, monthName } from '@/services/spaceMath'

/** ‹ Outubro de 2026 › — com atalho de volta para o mês atual. */
export function MonthPicker({ value, onChange }: { value: string; onChange: (ym: string) => void }) {
  const now = currentYM()
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-ink p-1">
      <button
        onClick={() => onChange(addMonths(value, -1))}
        className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-white/5 hover:text-fg"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-[9.5rem] px-1 text-center text-sm text-fg">{monthName(value)}</span>
      <button
        onClick={() => onChange(addMonths(value, 1))}
        className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-white/5 hover:text-fg"
        aria-label="Próximo mês"
      >
        <ChevronRight className="size-4" />
      </button>
      {value !== now && (
        <button onClick={() => onChange(now)} className="rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-white/5 hover:text-fg">
          Hoje
        </button>
      )}
    </div>
  )
}
