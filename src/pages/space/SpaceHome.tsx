import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowLeftRight, ArrowRight, Check, HandCoins, Plus, Repeat, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Stat } from '@/components/ui/Stat'
import { Progress } from '@/components/ui/Progress'
import { ChartTooltip, Legend } from '@/components/charts/ChartTooltip'
import { CHART, axisProps } from '@/components/charts/theme'
import { Money, useHideValues } from '@/components/space/Money'
import { MonthPicker } from '@/components/space/MonthPicker'
import { EntryRow } from '@/components/space/EntryRow'
import { CategoryBars } from '@/components/space/CategoryBars'
import { spaceIcon } from '@/components/layout/Sidebar'
import { useSpacePage } from '@/layouts/SpaceLayout'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import {
  addDays,
  addMonths,
  categoryBreakdown,
  currentYM,
  isEntryOverdue,
  localISO,
  monthTotals,
  monthlySeries,
  monthsEnding,
  walletBalance,
} from '@/services/spaceMath'
import { formatCurrency, formatCurrencyCompact, formatDateShort, formatPercent } from '@/utils/format'
import { cn } from '@/utils/cn'

function Delta({ now, before, invert }: { now: number; before: number; invert?: boolean }) {
  if (!before) return null
  const diff = (now - before) / Math.abs(before)
  if (!Number.isFinite(diff) || Math.abs(diff) < 0.005) return <span className="text-faint">igual ao mês passado</span>
  const up = diff > 0
  const good = invert ? !up : up
  return (
    <span className={good ? 'text-fg-soft' : 'text-danger'}>
      {up ? '▲' : '▼'} {formatPercent(Math.abs(diff), 0)} vs mês passado
    </span>
  )
}

export default function SpaceHome() {
  const { space, words, openEntry, openTransfer } = useSpacePage()
  const { spaces, wallets, entries, recurrings, budgets, goals, reminders, setEntryPaid, updateReminder } = useSpaces()
  const toast = useToast()
  const [hidden] = useHideValues()
  const [ym, setYm] = useState(currentYM())
  const [busyId, setBusyId] = useState<string | null>(null)
  const today = localISO()
  const Icon = spaceIcon(space)
  const base = `/e/${space.id}`

  const mine = useMemo(() => entries.filter((e) => e.spaceId === space.id), [entries, space.id])
  const myWallets = wallets.filter((w) => w.spaceId === space.id && !w.archived)
  const t = monthTotals(mine, ym)
  const prev = monthTotals(mine, addMonths(ym, -1))
  const balance = myWallets.reduce((a, w) => a + walletBalance(w, mine), 0)
  const overdue = mine.filter((e) => !e.isTransfer && isEntryOverdue(e, today))
  const overdueOut = overdue.filter((e) => e.type === 'despesa')
  const upcoming = mine
    .filter((e) => e.status === 'pendente' && !e.isTransfer && e.date <= addDays(today, 7))
    .sort((a, b) => a.date.localeCompare(b.date))
  const series = monthlySeries(mine, monthsEnding(ym, 6))
  const cats = categoryBreakdown(mine, ym, 'despesa')
  const myBudgets = budgets.filter((b) => b.spaceId === space.id)
  const myGoals = goals.filter((g) => g.spaceId === space.id)
  const myReminders = reminders.filter((r) => r.spaceId === space.id && !r.done).slice(0, 5)
  const hasOther = spaces.some((s) => s.id !== space.id)
  const isNew = !mine.length && !myWallets.length && !recurrings.some((r) => r.spaceId === space.id)
  const money = hidden ? () => 'R$ ••••' : formatCurrency

  const togglePaid = async (id: string, paid: boolean) => {
    setBusyId(id)
    try {
      await setEntryPaid(id, paid)
      if (paid) toast.success('Marcado como pago')
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
            <Icon className="size-3.5" /> {space.kind === 'empresa' ? 'Empresa' : 'Pessoal'}
          </>
        }
        title={space.name}
        description={
          space.kind === 'empresa'
            ? 'Quanto entrou, quanto saiu, o lucro e as contas que vão vencer.'
            : 'Seu dinheiro: o que entrou, o que saiu, o que sobrou e o que vai vencer.'
        }
        actions={
          <>
            <MonthPicker value={ym} onChange={setYm} />
            {hasOther && (
              <Button variant="outline" icon={<HandCoins className="size-4" />} onClick={() => openTransfer('espacos')}>
                Meu pagamento
              </Button>
            )}
            <div className="hidden sm:block">
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => openEntry()}>
                Lançar
              </Button>
            </div>
          </>
        }
      />

      {isNew && (
        <Card className="mb-4 animate-slide-up">
          <CardHeader eyebrow="Primeiros passos" title={`Deixe o ${space.name} pronto em 3 passos`} />
          <CardBody className="grid gap-3 sm:grid-cols-3">
            {[
              {
                n: 1,
                title: 'Cadastre as carteiras',
                text: 'Conta no banco, dinheiro do caixa, cartão. Assim o saldo de cada uma aparece sozinho.',
                to: `${base}/carteiras`,
                icon: Wallet,
              },
              {
                n: 2,
                title: 'Cadastre as contas fixas',
                text: 'Aluguel, luz, internet, salários. Elas entram todo mês sozinhas, como “a pagar”.',
                to: `${base}/fixas`,
                icon: Repeat,
              },
              {
                n: 3,
                title: 'Lance o que entra e sai',
                text: 'Use o botão “Lançar” (no celular, o + redondo). Leva 5 segundos.',
                icon: Plus,
              },
            ].map((s) => {
              const inner = (
                <>
                  <span className="grid size-8 place-items-center rounded-full border border-line-strong font-mono text-xs">{s.n}</span>
                  <p className="mt-3 text-sm font-medium text-fg">{s.title}</p>
                  <p className="mt-1 text-xs text-muted">{s.text}</p>
                </>
              )
              return s.to ? (
                <Link key={s.n} to={s.to} className="panel panel-hover block p-4">
                  {inner}
                </Link>
              ) : (
                <button key={s.n} onClick={() => openEntry()} className="panel panel-hover block p-4 text-left">
                  {inner}
                </button>
              )
            })}
          </CardBody>
        </Card>
      )}

      {overdueOut.length > 0 && (
        <Link
          to={`${base}/contas`}
          className="mb-4 flex animate-slide-up items-center gap-3 rounded-2xl border border-danger/30 bg-danger/[0.06] px-4 py-3 text-sm transition hover:bg-danger/10"
        >
          <AlertTriangle className="size-4 shrink-0 text-danger" />
          <span className="flex-1">
            {overdueOut.length === 1 ? '1 conta atrasada' : `${overdueOut.length} contas atrasadas`} ·{' '}
            <Money value={overdueOut.reduce((a, e) => a + e.amount, 0)} className="text-fg" />
          </span>
          <span className="flex items-center gap-1 text-xs text-muted">
            Ver <ArrowRight className="size-3.5" />
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label={words.ins}
          value={<Money value={t.income} />}
          hint={t.toReceive > 0 ? <>a receber <Money value={t.toReceive} /></> : <Delta now={t.income} before={prev.income} />}
          to={`${base}/movimentacoes?tipo=receita&mes=${ym}`}
        />
        <Stat
          label={words.outs}
          value={<Money value={t.expense} />}
          hint={t.toPay > 0 ? <>a pagar <Money value={t.toPay} /></> : <Delta now={t.expense} before={prev.expense} invert />}
          to={`${base}/movimentacoes?tipo=despesa&mes=${ym}`}
        />
        <Stat
          emphasis
          label={`${words.result} do mês`}
          value={<Money value={t.profit} />}
          hint={
            t.forecast !== t.profit ? (
              <>
                previsto <Money value={t.forecast} />
              </>
            ) : (
              <Delta now={t.profit} before={prev.profit} />
            )
          }
          to={`${base}/relatorio?mes=${ym}`}
        />
        {myWallets.length ? (
          <Stat
            label="Saldo"
            value={<Money value={balance} />}
            hint={`${myWallets.length} ${myWallets.length === 1 ? 'carteira' : 'carteiras'}`}
            to={`${base}/carteiras`}
          />
        ) : (
          <Stat
            label="Atrasadas"
            value={overdue.length}
            hint={overdue.length ? 'veja em Contas a pagar' : 'nada em atraso'}
            to={`${base}/contas`}
            className={overdue.length ? 'border-danger/25' : ''}
          />
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-3">
          <CardHeader
            eyebrow="Próximos 7 dias"
            title="Contas para pagar e receber"
            action={
              <Link to={`${base}/contas`} className="flex items-center gap-1 text-xs text-muted hover:text-fg">
                Ver todas <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {upcoming.length ? (
            <ul className="mt-3 divide-y divide-line">
              {upcoming.slice(0, 6).map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  wallets={wallets}
                  onEdit={() => openEntry(e)}
                  onTogglePaid={() => togglePaid(e.id, e.status === 'pendente')}
                  busy={busyId === e.id}
                />
              ))}
              {upcoming.length > 6 && (
                <li className="px-5 py-3 text-xs text-muted">
                  + {upcoming.length - 6} em <Link to={`${base}/contas`} className="text-fg underline-offset-2 hover:underline">Contas a pagar</Link>
                </li>
              )}
            </ul>
          ) : (
            <CardBody className="flex flex-col items-center py-10 text-center">
              <span className="grid size-10 place-items-center rounded-full border border-line-strong">
                <Check className="size-4" />
              </span>
              <p className="mt-3 text-sm text-fg">Nada vencendo nos próximos dias</p>
              <p className="mt-1 text-xs text-muted">Contas fixas e lançamentos “a pagar” aparecem aqui.</p>
            </CardBody>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader eyebrow={`${words.outs} do mês`} title="Para onde foi o dinheiro" />
          <CardBody>
            <CategoryBars rows={cats} empty={`Nenhum ${words.out.toLowerCase()} lançado neste mês.`} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          eyebrow="Últimos 6 meses"
          title={`${words.ins} x ${words.outs.toLowerCase()}`}
          action={<Legend items={[{ label: words.ins, color: CHART.primary }, { label: words.outs, color: CHART.tertiary }]} />}
        />
        <CardBody className="h-60 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ left: -4, right: 4, top: 8 }} barGap={2}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis width={56} {...axisProps} tickFormatter={(v) => (hidden ? '' : formatCurrencyCompact(v).replace('R$', '').trim())} />
              <Tooltip content={<ChartTooltip format={money} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="receitas" name={words.ins} fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="despesas" name={words.outs} fill={CHART.tertiary} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader
            eyebrow="Orçamento"
            title="Limites do mês"
            action={
              <Link to={`${base}/planejamento`} className="text-xs text-muted hover:text-fg">
                {myBudgets.length ? 'Ajustar' : 'Criar'}
              </Link>
            }
          />
          <CardBody className="space-y-4">
            {myBudgets.length ? (
              myBudgets.slice(0, 4).map((b) => {
                const spent = cats.find((c) => c.category === b.category)?.total ?? 0
                const ratio = spent / b.monthlyLimit
                return (
                  <div key={b.id}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate text-fg-soft">{b.category}</span>
                      <span className={cn('shrink-0 text-xs', ratio > 1 ? 'text-danger' : 'text-muted')}>
                        <Money value={spent} /> de <Money value={b.monthlyLimit} />
                      </span>
                    </div>
                    <Progress value={ratio} className={cn('mt-1.5', ratio > 1 && '[&>div]:from-danger [&>div]:via-danger [&>div]:to-danger')} />
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-muted">Defina quanto pode gastar por categoria e acompanhe aqui.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Metas"
            title="Juntando dinheiro"
            action={
              <Link to={`${base}/planejamento`} className="text-xs text-muted hover:text-fg">
                {myGoals.length ? 'Ver' : 'Criar'}
              </Link>
            }
          />
          <CardBody className="space-y-4">
            {myGoals.length ? (
              myGoals.slice(0, 3).map((g) => (
                <div key={g.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate text-fg-soft">{g.name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted">{formatPercent(g.saved / g.target, 0)}</span>
                  </div>
                  <Progress value={g.saved / g.target} className="mt-1.5" />
                  <p className="mt-1 text-[11px] text-faint">
                    <Money value={g.saved} /> de <Money value={g.target} />
                    {g.deadline && ` · até ${formatDateShort(g.deadline)}`}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">
                {space.kind === 'empresa' ? 'Ex.: reserva para impostos, comprar um equipamento.' : 'Ex.: reserva de emergência, uma viagem.'}
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Lembretes"
            title="Para não esquecer"
            action={
              <Link to={`${base}/lembretes`} className="text-xs text-muted hover:text-fg">
                {myReminders.length ? 'Ver todos' : 'Criar'}
              </Link>
            }
          />
          <CardBody className="pt-3">
            {myReminders.length ? (
              <ul className="space-y-1">
                {myReminders.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-1.5">
                    <button
                      onClick={() => void updateReminder(r.id, { done: true })}
                      className="grid size-5 shrink-0 place-items-center rounded-md border border-line-strong text-transparent transition hover:border-white hover:text-fg"
                      aria-label={`Concluir ${r.title}`}
                    >
                      <Check className="size-3" />
                    </button>
                    <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
                    {r.dueDate && (
                      <span className={cn('shrink-0 text-[11px]', r.dueDate < today ? 'text-danger' : 'text-faint')}>{formatDateShort(r.dueDate)}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Ex.: “pedir nota do fornecedor”, “ir ao banco”.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {myWallets.length >= 2 && (
        <div className="mt-4 flex justify-center">
          <Button variant="ghost" size="sm" icon={<ArrowLeftRight className="size-3.5" />} onClick={() => openTransfer('carteiras')}>
            Transferir entre carteiras
          </Button>
        </div>
      )}
    </>
  )
}
