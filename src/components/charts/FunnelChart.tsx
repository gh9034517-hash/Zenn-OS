import { formatNumber, formatPercent } from '@/utils/format'

/** Funil horizontal em barras — magnitude por comprimento, sem cor. */
export function FunnelChart({ stages }: { stages: { label: string; value: number }[] }) {
  const max = Math.max(...stages.map((s) => s.value), 1)
  const first = stages[0]?.value || 0
  return (
    <div className="space-y-3">
      {stages.map((s, i) => {
        const pct = s.value / max
        const conv = first ? s.value / first : 0
        return (
          <div key={s.label} className="group" title={`${s.label}: ${s.value} (${formatPercent(conv)} do topo)`}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
              <span className="text-fg-soft">{s.label}</span>
              <span className="font-mono text-muted">
                <span className="text-fg">{formatNumber(s.value)}</span>
                {i > 0 && <span className="ml-2 text-faint">{formatPercent(conv, 0)}</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out group-hover:brightness-125"
                style={{
                  width: `${Math.max(pct * 100, s.value ? 2 : 0)}%`,
                  background: `linear-gradient(90deg, rgba(255,255,255,${0.35 + 0.65 * (1 - i / stages.length)}), rgba(255,255,255,${0.15 + 0.5 * (1 - i / stages.length)}))`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
