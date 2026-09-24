import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
      <span>{children}</span>
      {hint && <span className="text-faint">{hint}</span>}
    </label>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, icon, ...rest }, ref) {
  if (!icon) return <input ref={ref} className={cn('field', className)} {...rest} />
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint [&_svg]:size-4">{icon}</span>
      <input ref={ref} className={cn('field pl-9', className)} {...rest} />
    </div>
  )
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn('field cursor-pointer appearance-none pr-9', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-faint" />
    </div>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cn('field min-h-24 resize-y', className)} {...rest} />
})

export function FormField({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: ReactNode
  htmlFor?: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
      {children}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: ReactNode
  description?: ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'group flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-200',
        checked ? 'border-white/35 bg-white/[0.06]' : 'border-line bg-ink hover:border-line-strong',
      )}
    >
      <span className="min-w-0">
        <span className={cn('block text-sm', checked ? 'text-fg' : 'text-fg-soft')}>{label}</span>
        {description && <span className="block truncate text-[11px] text-faint">{description}</span>}
      </span>
      <span
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'border-white bg-white' : 'border-line-strong bg-raised',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-3.5 rounded-full transition-all duration-200',
            checked ? 'left-[18px] bg-black' : 'left-0.5 bg-muted',
          )}
        />
      </span>
    </button>
  )
}
