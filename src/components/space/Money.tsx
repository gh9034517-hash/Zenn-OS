import { useCallback, useEffect, useState } from 'react'
import { formatCurrency, formatCurrencyCompact } from '@/utils/format'
import { cn } from '@/utils/cn'

const KEY = 'zenn-os:hide-values'

function apply(hidden: boolean) {
  document.documentElement.dataset.hideValues = hidden ? '1' : '0'
}

// Aplica já no carregamento, antes da primeira tela.
try {
  apply(localStorage.getItem(KEY) === '1')
} catch {
  /* armazenamento indisponível */
}

/** "Ocultar valores": borra todo valor marcado com .money (bom para abrir o app perto de alguém). */
export function useHideValues() {
  const [hidden, setHidden] = useState(() => document.documentElement.dataset.hideValues === '1')
  useEffect(() => {
    const sync = () => setHidden(document.documentElement.dataset.hideValues === '1')
    window.addEventListener('zenn:hide-values', sync)
    return () => window.removeEventListener('zenn:hide-values', sync)
  }, [])
  const toggle = useCallback(() => {
    const next = document.documentElement.dataset.hideValues !== '1'
    apply(next)
    try {
      localStorage.setItem(KEY, next ? '1' : '0')
    } catch {
      /* armazenamento indisponível */
    }
    window.dispatchEvent(new Event('zenn:hide-values'))
  }, [])
  return [hidden, toggle] as const
}

/** Valor em reais. `sign` mostra + / − (entrada / saída). */
export function Money({
  value,
  compact,
  sign,
  className,
}: {
  value: number
  compact?: boolean
  sign?: 'in' | 'out'
  className?: string
}) {
  const text = compact ? formatCurrencyCompact(Math.abs(value)) : formatCurrency(Math.abs(value))
  const prefix = sign === 'in' ? '+ ' : sign === 'out' ? '− ' : value < 0 ? '− ' : ''
  return (
    <span className={cn('money font-mono tabular-nums', className)} title={compact ? formatCurrency(value) : undefined}>
      {prefix}
      {text}
    </span>
  )
}
