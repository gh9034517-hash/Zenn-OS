import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

type Tone = 'solid' | 'bright' | 'default' | 'muted' | 'outline' | 'dashed' | 'danger'

const tones: Record<Tone, string> = {
  solid: 'bg-white text-black border-white',
  bright: 'bg-white/[0.12] text-white border-white/25',
  default: 'bg-white/[0.06] text-fg-soft border-line-strong',
  muted: 'bg-transparent text-muted border-line',
  outline: 'bg-transparent text-fg border-white/30',
  dashed: 'bg-transparent text-fg-soft border-dashed border-white/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
}

export function Badge({
  children,
  tone = 'default',
  className,
  icon,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  icon?: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium tracking-wide whitespace-nowrap uppercase',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/** Selo explícito para qualquer dado fictício. */
export function DemoBadge({ className, label = 'Demo' }: { className?: string; label?: string }) {
  return (
    <span
      title="Dados fictícios — não representam empresas reais"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/35 px-2 py-0.5 font-display text-[9px] tracking-[0.18em] text-fg-soft uppercase',
        className,
      )}
    >
      <span className="size-1 animate-pulse rounded-full bg-white" />
      {label}
    </span>
  )
}
