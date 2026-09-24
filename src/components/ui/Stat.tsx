import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function Stat({
  label,
  value,
  hint,
  icon,
  className,
  emphasis,
  style,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  className?: string
  emphasis?: boolean
  style?: React.CSSProperties
}) {
  return (
    <div
      style={style}
      className={cn(
        'panel panel-hover group animate-slide-up overflow-hidden p-4 sm:p-5',
        emphasis && 'bg-gradient-to-br from-[#1a1a1e] to-surface',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow truncate !tracking-[0.14em]" title={label}>{label}</p>
        {icon && (
          <span className="grid size-7 place-items-center rounded-lg border border-line text-muted transition-colors group-hover:text-fg [&_svg]:size-3.5">
            {icon}
          </span>
        )}
      </div>
      <p className={cn('mt-3 truncate font-mono text-[22px] tracking-tight 2xl:text-[28px]', emphasis ? 'text-metal' : 'text-fg')}>
        {value}
      </p>
      {hint && <p className="mt-1.5 truncate text-xs text-muted">{hint}</p>}
    </div>
  )
}
