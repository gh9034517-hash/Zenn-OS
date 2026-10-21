import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, Repeat, Undo2 } from 'lucide-react'
import { Money } from '@/components/space/Money'
import { Button } from '@/components/ui/Button'
import { isEntryOverdue, localISO } from '@/services/spaceMath'
import { formatDateShort } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Entry, Wallet } from '@/types'

function dueText(e: Entry, today: string) {
  if (e.status === 'pago') return e.paidAt ? `pago em ${formatDateShort(e.paidAt)}` : 'pago'
  if (e.date === today) return 'vence hoje'
  const days = Math.round((new Date(`${e.date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000)
  if (days < 0) return `atrasada ${-days} ${days === -1 ? 'dia' : 'dias'}`
  if (days === 1) return 'vence amanhã'
  return `vence ${formatDateShort(e.date)}`
}

/** Uma linha de lançamento: toque abre a edição; o botão marca como pago. */
export function EntryRow({
  entry: e,
  wallets,
  onEdit,
  onTogglePaid,
  busy,
  extra,
  showDate = true,
}: {
  entry: Entry
  wallets: Wallet[]
  onEdit: () => void
  onTogglePaid?: () => void
  busy?: boolean
  /** texto antes dos detalhes (ex.: nome do espaço na visão geral) */
  extra?: string
  showDate?: boolean
}) {
  const today = localISO()
  const overdue = isEntryOverdue(e, today)
  const wallet = wallets.find((w) => w.id === e.walletId)
  const isIn = e.type === 'receita'
  const Icon = e.isTransfer ? ArrowLeftRight : isIn ? ArrowDownLeft : ArrowUpRight
  const details = [extra, e.category, e.counterparty, wallet?.name, e.installment && `parcela ${e.installment}`].filter(Boolean).join(' · ')

  return (
    <li className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02] sm:px-5">
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full border',
          isIn ? 'border-white/30 bg-white/[0.08] text-fg' : 'border-line text-muted',
        )}
      >
        <Icon className="size-4" strokeWidth={1.7} />
      </span>
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="flex items-center gap-1.5 truncate text-sm text-fg">
          <span className="truncate">{e.description}</span>
          {e.recurringId && <Repeat className="size-3 shrink-0 text-faint" aria-label="Conta fixa" />}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {showDate && <span className={cn(overdue && 'text-danger')}>{dueText(e, today)}</span>}
          {showDate && details && ' · '}
          {details}
        </p>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <Money value={e.amount} sign={isIn ? 'in' : 'out'} className={cn('text-sm', isIn ? 'text-fg' : 'text-fg-soft')} />
        {onTogglePaid &&
          (e.status === 'pendente' ? (
            <Button size="sm" variant={overdue ? 'primary' : 'secondary'} loading={busy} icon={<Check className="size-3.5" />} onClick={onTogglePaid}>
              {isIn ? 'Recebi' : 'Paguei'}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" loading={busy} icon={<Undo2 className="size-3.5" />} onClick={onTogglePaid} title="Voltar para em aberto">
              <span className="hidden sm:inline">Desfazer</span>
            </Button>
          ))}
      </div>
    </li>
  )
}
