import type { ReactNode } from 'react'
import { Mascot } from '@/components/brand/Mascot'
import { cn } from '@/utils/cn'

export function EmptyState({
  title,
  description,
  action,
  mascot = true,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  mascot?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex animate-fade-in flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {mascot && <Mascot size={112} className="mb-5 opacity-90" />}
      <p className="text-base font-medium tracking-tight">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
