import { Link } from 'react-router-dom'
import { Check, Trash2 } from 'lucide-react'
import type { Transaction } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useData } from '@/context/DataContext'
import { useToast } from '@/components/ui/Toast'
import { PAYMENT_METHOD_LABEL } from '@/data/constants'
import { formatCurrency, formatDate } from '@/utils/format'
import { isOverdue } from '@/utils/metrics'
import { cn } from '@/utils/cn'

export function TransactionStatusBadge({ t }: { t: Transaction }) {
  if (t.status === 'pago') return <Badge tone="solid">Pago</Badge>
  if (isOverdue(t)) return <Badge tone="danger">Atrasado</Badge>
  return <Badge tone="dashed">Pendente</Badge>
}

export function TransactionsTable({ transactions, showClient = true, allowDelete = false }: { transactions: Transaction[]; showClient?: boolean; allowDelete?: boolean }) {
  const { clients, markTransactionPaid, deleteTransaction } = useData()
  const toast = useToast()
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.company

  if (!transactions.length) return <p className="px-5 py-10 text-center text-sm text-faint">Nenhuma transação.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            {['Data', ...(showClient ? ['Cliente'] : []), 'Descrição', 'Tipo', 'Método', 'Status', 'Valor', ''].map((h, i) => (
              <th key={i} className={cn('eyebrow px-4 py-3 font-normal', h === 'Valor' && 'text-right')}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className="data-row">
              <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-muted">{formatDate(t.date)}</td>
              {showClient && (
                <td className="px-4 py-3">
                  {t.clientId ? <Link to={`/clientes/${t.clientId}`} className="hover:underline">{clientName(t.clientId) ?? '—'}</Link> : <span className="text-faint">—</span>}
                </td>
              )}
              <td className="px-4 py-3 text-fg-soft">
                {t.description}
                {t.isDemo && <span className="ml-2 text-[9px] tracking-widest text-faint uppercase">demo</span>}
              </td>
              <td className="px-4 py-3 text-xs text-muted uppercase">{t.type}</td>
              <td className="px-4 py-3 text-xs text-muted">{PAYMENT_METHOD_LABEL[t.method]}</td>
              <td className="px-4 py-3"><TransactionStatusBadge t={t} /></td>
              <td className={cn('px-4 py-3 text-right font-mono whitespace-nowrap', t.type === 'despesa' ? 'text-muted' : 'text-fg')}>
                {t.type === 'despesa' ? '−' : '+'} {formatCurrency(t.amount)}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  {t.status === 'pendente' && (
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Check className="size-3.5" />}
                      onClick={async () => {
                        await markTransactionPaid(t.id)
                        toast.success(t.type === 'receita' ? 'Pagamento registrado' : 'Despesa paga', formatCurrency(t.amount))
                      }}
                    >
                      Marcar pago
                    </Button>
                  )}
                  {allowDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label="Excluir transação"
                      title="Excluir transação"
                      onClick={async () => {
                        if (!window.confirm(`Excluir "${t.description}"?`)) return
                        await deleteTransaction(t.id)
                        toast.success('Transação excluída')
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
