import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode; icon?: ReactNode }[]
}) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-ink p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 [&_svg]:size-3.5',
            value === o.value ? 'bg-white text-black' : 'text-muted hover:text-fg',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}
