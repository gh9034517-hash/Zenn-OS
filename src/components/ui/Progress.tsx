import { cn } from '@/utils/cn'

export function Progress({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100)
  return (
    <div className={cn('h-1 w-full overflow-hidden rounded-full bg-white/[0.07]', className)} role="progressbar" aria-valuenow={pct}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-accent-2 via-accent to-accent-2 transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
