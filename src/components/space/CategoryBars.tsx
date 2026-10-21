import { Money } from '@/components/space/Money'
import { formatPercent } from '@/utils/format'

/** Barras horizontais por categoria — "para onde foi o dinheiro". */
export function CategoryBars({ rows, limit = 6, empty }: { rows: { category: string; total: number }[]; limit?: number; empty: string }) {
  const total = rows.reduce((a, r) => a + r.total, 0)
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>
  const shown = rows.slice(0, limit)
  const rest = rows.slice(limit).reduce((a, r) => a + r.total, 0)
  const list = rest > 0 ? [...shown, { category: 'Outras', total: rest }] : shown
  const max = Math.max(...list.map((r) => r.total))
  return (
    <ul className="space-y-3">
      {list.map((r) => (
        <li key={r.category}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-fg-soft">{r.category}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="font-mono text-[11px] text-faint">{formatPercent(r.total / total, 0)}</span>
              <Money value={r.total} className="text-fg" />
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-2 via-accent to-accent-2"
              style={{ width: `${Math.max(2, (r.total / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
