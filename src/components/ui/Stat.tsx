import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'

export function Stat({
  label,
  value,
  hint,
  icon,
  className,
  emphasis,
  style,
  to,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  className?: string
  emphasis?: boolean
  style?: React.CSSProperties
  /** Quando informado, o cartão vira um atalho para essa rota. */
  to?: string
}) {
  // Um cartão com destino é um link de verdade: abre em nova aba com
  // ctrl/cmd-clique e é anunciado corretamente por leitores de tela.
  const Wrapper = to ? Link : 'div'
  const wrapperProps = to
    ? ({ to, 'aria-label': `${label} — abrir` } as const)
    : ({} as Record<string, never>)

  return (
    <Wrapper
      {...wrapperProps}
      style={style}
      className={cn(
        'panel panel-hover group animate-slide-up overflow-hidden p-4 sm:p-5',
        emphasis && 'bg-gradient-to-br from-[#1a1a1e] to-surface',
        to &&
          'block cursor-pointer transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 active:scale-[0.99]',
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
      <p className={cn('mt-3 truncate font-mono text-xl tracking-tighter sm:text-[22px] xl:text-xl 2xl:text-[26px]', emphasis ? 'text-metal' : 'text-fg')}>
        {value}
      </p>
      {hint && <div className="mt-1.5 truncate text-xs text-muted">{hint}</div>}
    </Wrapper>
  )
}
