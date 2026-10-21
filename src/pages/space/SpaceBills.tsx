import { useMemo, useState } from 'react'
import { Check, Plus, Repeat } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { Money } from '@/components/space/Money'
import { EntryRow } from '@/components/space/EntryRow'
import { useSpacePage } from '@/layouts/SpaceLayout'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import { addDays, localISO } from '@/services/spaceMath'
import { cn } from '@/utils/cn'
import type { Entry, TransactionType } from '@/types'

export default function SpaceBills() {
  const { space, openEntry } = useSpacePage()
  const { entries, wallets, setEntryPaid } = useSpaces()
  const toast = useToast()
  const navigate = useNavigate()
  const [type, setType] = useState<TransactionType>('despesa')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showPaid, setShowPaid] = useState(false)
  const today = localISO()
  const week = addDays(today, 7)
  const isIn = type === 'receita'

  const open = useMemo(
    () =>
      entries
        .filter((e) => e.spaceId === space.id && e.type === type && e.status === 'pendente' && !e.isTransfer)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [entries, space.id, type],
  )
  const recentlyPaid = entries
    .filter((e) => e.spaceId === space.id && e.type === type && e.status === 'pago' && !e.isTransfer && (e.paidAt ?? '') >= addDays(today, -30))
    .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))
    .slice(0, 15)

  const sections: { id: string; title: string; rows: Entry[]; danger?: boolean }[] = [
    { id: 'late', title: 'Atrasadas', rows: open.filter((e) => e.date < today), danger: true },
    { id: 'today', title: 'Vencem hoje', rows: open.filter((e) => e.date === today) },
    { id: 'week', title: 'Próximos 7 dias', rows: open.filter((e) => e.date > today && e.date <= week) },
    { id: 'later', title: 'Mais adiante', rows: open.filter((e) => e.date > week) },
  ]
  const total = open.reduce((a, e) => a + e.amount, 0)

  const toggle = async (e: Entry) => {
    setBusyId(e.id)
    try {
      const paying = e.status === 'pendente'
      await setEntryPaid(e.id, paying)
      if (paying) toast.success(isIn ? 'Recebimento confirmado' : 'Conta paga', e.description)
    } catch (err) {
      toast.error('Não deu para salvar', err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={space.name}
        title={isIn ? 'Contas a receber' : 'Contas a pagar'}
        description="Tudo que está em aberto, por vencimento. Um toque em “Paguei” e pronto."
        actions={
          <>
            <Segmented<TransactionType>
              value={type}
              onChange={setType}
              options={[
                { value: 'despesa', label: 'A pagar' },
                { value: 'receita', label: 'A receber' },
              ]}
            />
            <div className="hidden sm:block">
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => openEntry(null, type)}>
                Nova conta
              </Button>
            </div>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {sections.map((s) => {
          const sum = s.rows.reduce((a, e) => a + e.amount, 0)
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(ev) => {
                ev.preventDefault()
                document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className={cn('panel panel-hover p-4', s.danger && s.rows.length > 0 && 'border-danger/30')}
            >
              <p className="eyebrow !tracking-[0.14em]">{s.title}</p>
              <p className={cn('mt-2 text-lg', s.danger && s.rows.length > 0 ? 'text-danger' : 'text-fg')}>
                <Money value={sum} />
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {s.rows.length} {s.rows.length === 1 ? 'conta' : 'contas'}
              </p>
            </a>
          )
        })}
      </div>

      {open.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full border border-line-strong">
            <Check className="size-5" />
          </span>
          <p className="mt-4 text-base font-medium">{isIn ? 'Nada para receber em aberto' : 'Nenhuma conta em aberto'}</p>
          <p className="mt-1.5 max-w-sm text-sm text-muted">
            Cadastre as <Link to={`/e/${space.id}/fixas`} className="text-fg underline-offset-2 hover:underline">contas fixas</Link> (aluguel,
            luz, salários) e elas aparecem aqui todo mês, sozinhas.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="outline" icon={<Repeat className="size-4" />} onClick={() => navigate(`/e/${space.id}/fixas`)}>
              Contas fixas
            </Button>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => openEntry(null, type)}>
              {isIn ? 'Algo a receber' : 'Conta a pagar'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {sections
            .filter((s) => s.rows.length)
            .map((s) => (
              <Card key={s.id} id={`sec-${s.id}`} className={cn('scroll-mt-20 overflow-hidden', s.danger && 'border-danger/25')}>
                <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
                  <p className={cn('text-sm font-medium', s.danger && 'text-danger')}>{s.title}</p>
                  <Money value={s.rows.reduce((a, e) => a + e.amount, 0)} className="text-sm text-fg" />
                </div>
                <ul className="divide-y divide-line">
                  {s.rows.map((e) => (
                    <EntryRow key={e.id} entry={e} wallets={wallets} onEdit={() => openEntry(e)} onTogglePaid={() => toggle(e)} busy={busyId === e.id} />
                  ))}
                </ul>
              </Card>
            ))}
          <p className="text-right text-xs text-muted">
            Total em aberto: <Money value={total} className="text-fg" />
          </p>
        </div>
      )}

      {recentlyPaid.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowPaid((v) => !v)} className="text-xs text-muted transition hover:text-fg">
            {showPaid ? 'Esconder' : 'Ver'} {isIn ? 'recebidas' : 'pagas'} nos últimos 30 dias ({recentlyPaid.length})
          </button>
          {showPaid && (
            <Card className="mt-3 overflow-hidden">
              <ul className="divide-y divide-line">
                {recentlyPaid.map((e) => (
                  <EntryRow key={e.id} entry={e} wallets={wallets} onEdit={() => openEntry(e)} onTogglePaid={() => toggle(e)} busy={busyId === e.id} />
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
