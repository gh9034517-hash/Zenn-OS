import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Check, HandCoins, Layers } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LogoMark } from '@/components/brand/Logo'
import { Money } from '@/components/space/Money'
import { MonthPicker } from '@/components/space/MonthPicker'
import { EntryRow } from '@/components/space/EntryRow'
import { TransferModal } from '@/components/space/TransferModal'
import { spaceIcon } from '@/components/layout/Sidebar'
import { useSpaces } from '@/context/SpacesContext'
import { useData } from '@/context/DataContext'
import { useSession } from '@/context/SessionContext'
import { useToast } from '@/components/ui/Toast'
import { addDays, currentYM, isEntryOverdue, localISO, monthTotals, spaceWords, walletBalance } from '@/services/spaceMath'
import { formatDateShort } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { ReactNode } from 'react'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

function SpaceCard({
  to,
  icon,
  name,
  kind,
  income,
  expense,
  result,
  resultLabel,
  toPay,
  late,
  balance,
}: {
  to: string
  icon: ReactNode
  name: string
  kind: string
  income: number
  expense: number
  result: number
  resultLabel: string
  toPay: number
  late: number
  balance: number | null
}) {
  return (
    <Link to={to} className="panel panel-hover group flex flex-col p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl border border-line-strong text-fg-soft">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-fg">{name}</p>
          <p className="text-[11px] text-faint">{kind}</p>
        </div>
        <ArrowRight className="size-4 text-faint transition group-hover:translate-x-0.5 group-hover:text-fg" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-muted">Entrou</p>
          <Money value={income} className="mt-0.5 block text-sm text-fg" />
        </div>
        <div>
          <p className="text-muted">Saiu</p>
          <Money value={expense} className="mt-0.5 block text-sm text-fg-soft" />
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
        <p className="text-[10px] tracking-widest text-muted uppercase">{resultLabel}</p>
        <Money value={result} className={cn('mt-0.5 block text-xl tracking-tight', result < 0 ? 'text-danger' : 'text-metal')} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {balance !== null && (
          <span>
            Saldo <Money value={balance} className="text-fg-soft" />
          </span>
        )}
        <span>
          A pagar <Money value={toPay} className="text-fg-soft" />
        </span>
        {late > 0 && <span className="text-danger">{late} atrasada{late > 1 ? 's' : ''}</span>}
      </div>
    </Link>
  )
}

export default function Overview() {
  const { spaces, wallets, entries, reminders, setEntryPaid, updateReminder } = useSpaces()
  const { transactions } = useData()
  const { session } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const [ym, setYm] = useState(currentYM())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const today = localISO()

  // Zenn Works: receitas e despesas do financeiro da agência.
  const zenn = useMemo(() => {
    const rows = transactions.filter((t) => t.date.startsWith(ym))
    const sum = (f: (t: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((a, t) => a + t.amount, 0)
    return {
      income: sum((t) => t.type === 'receita'),
      expense: sum((t) => t.type === 'despesa'),
      toPay: sum((t) => t.type === 'despesa' && t.status === 'pendente'),
      late: transactions.filter((t) => t.status === 'pendente' && t.date < today).length,
    }
  }, [transactions, ym, today])

  const upcoming = entries
    .filter((e) => e.status === 'pendente' && !e.isTransfer && e.date <= addDays(today, 7))
    .sort((a, b) => a.date.localeCompare(b.date))
  const lateOut = upcoming.filter((e) => e.type === 'despesa' && isEntryOverdue(e, today))
  const pendingReminders = reminders.filter((r) => !r.done).slice(0, 6)
  const allWallets = wallets.filter((w) => !w.archived)
  const totalBalance = allWallets.reduce((a, w) => a + walletBalance(w, entries.filter((e) => e.spaceId === w.spaceId)), 0)
  const company = spaces.find((s) => s.kind === 'empresa')
  const personal = spaces.find((s) => s.kind === 'pessoal')

  const toggle = async (id: string) => {
    setBusyId(id)
    try {
      await setEntryPaid(id, true)
      toast.success('Marcado como pago')
    } catch (e) {
      toast.error('Não deu para salvar', e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Layers className="size-3.5" /> Visão geral
          </>
        }
        title={
          <>
            {greeting()}, <span className="text-metal font-normal">{session?.name?.split(' ')[0]}</span>
          </>
        }
        description="Tudo o que você administra, num lugar só: a Zenn Works, o trabalho e o seu dinheiro."
        actions={
          <>
            <MonthPicker value={ym} onChange={setYm} />
            {company && personal && (
              <Button variant="outline" icon={<HandCoins className="size-4" />} onClick={() => setPayOpen(true)}>
                Meu pagamento
              </Button>
            )}
          </>
        }
      />

      {lateOut.length > 0 && (
        <div className="mb-4 flex animate-slide-up items-center gap-3 rounded-2xl border border-danger/30 bg-danger/[0.06] px-4 py-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-danger" />
          <span className="flex-1">
            {lateOut.length === 1 ? '1 conta atrasada' : `${lateOut.length} contas atrasadas`} ·{' '}
            <Money value={lateOut.reduce((a, e) => a + e.amount, 0)} className="text-fg" />
          </span>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {spaces.map((s) => {
          const mine = entries.filter((e) => e.spaceId === s.id)
          const t = monthTotals(mine, ym)
          const myWallets = allWallets.filter((w) => w.spaceId === s.id)
          const Icon = spaceIcon(s)
          return (
            <SpaceCard
              key={s.id}
              to={`/e/${s.id}`}
              icon={<Icon className="size-4.5" strokeWidth={1.6} />}
              name={s.name}
              kind={s.kind === 'empresa' ? 'Empresa' : 'Pessoal'}
              income={t.income}
              expense={t.expense}
              result={t.forecast}
              resultLabel={`${spaceWords(s.kind).result} do mês`}
              toPay={t.toPay}
              late={mine.filter((e) => e.type === 'despesa' && !e.isTransfer && isEntryOverdue(e, today)).length}
              balance={myWallets.length ? myWallets.reduce((a, w) => a + walletBalance(w, mine), 0) : null}
            />
          )
        })}
        <SpaceCard
          to="/financeiro"
          icon={<LogoMark className="size-5" />}
          name="Zenn Works"
          kind="Agência"
          income={zenn.income}
          expense={zenn.expense}
          result={zenn.income - zenn.expense}
          resultLabel="Lucro do mês"
          toPay={zenn.toPay}
          late={zenn.late}
          balance={null}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-3">
          <CardHeader eyebrow="Todos os espaços" title="Vence nos próximos 7 dias" />
          {upcoming.length ? (
            <ul className="mt-3 divide-y divide-line">
              {upcoming.slice(0, 10).map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  wallets={wallets}
                  extra={spaces.find((s) => s.id === e.spaceId)?.name}
                  onEdit={() => navigate(`/e/${e.spaceId}/contas`)}
                  onTogglePaid={() => toggle(e.id)}
                  busy={busyId === e.id}
                />
              ))}
            </ul>
          ) : (
            <CardBody className="flex flex-col items-center py-10 text-center">
              <span className="grid size-10 place-items-center rounded-full border border-line-strong">
                <Check className="size-4" />
              </span>
              <p className="mt-3 text-sm">Nada vencendo esta semana</p>
            </CardBody>
          )}
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <div className="panel bg-gradient-to-br from-[#1a1a1e] to-surface p-5">
            <p className="eyebrow">Dinheiro nas carteiras</p>
            <Money value={totalBalance} className="text-metal mt-2 block text-3xl tracking-tight" />
            <ul className="mt-4 space-y-1.5 text-xs">
              {spaces.map((s) => {
                const ws = allWallets.filter((w) => w.spaceId === s.id)
                if (!ws.length) return null
                const mine = entries.filter((e) => e.spaceId === s.id)
                return (
                  <li key={s.id} className="flex justify-between gap-2 text-muted">
                    <span>{s.name}</span>
                    <Money value={ws.reduce((a, w) => a + walletBalance(w, mine), 0)} className="text-fg-soft" />
                  </li>
                )
              })}
              {!allWallets.length && <li className="text-muted">Cadastre carteiras em cada espaço para ver o saldo aqui.</li>}
            </ul>
          </div>

          <Card>
            <CardHeader eyebrow="Lembretes" title="Para não esquecer" />
            <CardBody className="pt-3">
              {pendingReminders.length ? (
                <ul className="space-y-1">
                  {pendingReminders.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 py-1.5">
                      <button
                        onClick={() => void updateReminder(r.id, { done: true })}
                        className="grid size-5 shrink-0 place-items-center rounded-md border border-line-strong text-transparent transition hover:border-white hover:text-fg"
                        aria-label={`Concluir ${r.title}`}
                      >
                        <Check className="size-3" />
                      </button>
                      <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
                      <span className="shrink-0 text-[11px] text-faint">
                        {spaces.find((s) => s.id === r.spaceId)?.name}
                        {r.dueDate && <span className={cn(r.dueDate < today && 'text-danger')}> · {formatDateShort(r.dueDate)}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nenhum lembrete pendente.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {company && <TransferModal open={payOpen} onClose={() => setPayOpen(false)} space={company} defaultMode="espacos" />}
    </>
  )
}
