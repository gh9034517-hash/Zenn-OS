import type { ReactNode } from 'react'

interface Item {
  name?: string | number
  value?: number | string | (number | string)[]
  color?: string
  dataKey?: string | number
  payload?: Record<string, unknown>
}

export function ChartTooltip({
  active,
  payload,
  label,
  format = (v: number) => String(v),
}: {
  active?: boolean
  payload?: Item[]
  label?: ReactNode
  format?: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line-strong bg-raised/95 px-3 py-2 shadow-2xl backdrop-blur">
      {label !== undefined && <p className="mb-1 font-mono text-[10px] tracking-widest text-muted uppercase">{label}</p>}
      {payload.map((p) => (
        <div key={String(p.dataKey ?? p.name)} className="flex items-center gap-2 text-xs">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-fg-soft">{p.name}</span>
          <span className="ml-auto pl-4 font-mono text-fg">{format(Number(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-[11px] text-muted">
          <span
            className="h-0.5 w-4 rounded-full"
            style={
              i.dashed
                ? { backgroundImage: `repeating-linear-gradient(90deg, ${i.color} 0 3px, transparent 3px 5px)` }
                : { background: i.color }
            }
          />
          {i.label}
        </span>
      ))}
    </div>
  )
}
