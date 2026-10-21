import { useState } from 'react'
import { Plus, Target } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { Money } from '@/components/space/Money'
import { MonthPicker } from '@/components/space/MonthPicker'
import { MoneyInput } from '@/components/space/EntryFormModal'
import { BudgetFormModal, GoalFormModal } from '@/components/space/SpaceForms'
import { useSpacePage } from '@/layouts/SpaceLayout'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import { categoryBreakdown, currentYM, localISO, parseMoney } from '@/services/spaceMath'
import { formatCurrency, formatDate, formatPercent } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Goal } from '@/types'

function monthsUntil(date: string) {
  const [y, m] = date.split('-').map(Number)
  const now = new Date()
  return (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth())
}

export default function SpacePlanning() {
  const { space, words } = useSpacePage()
  const { entries, budgets, goals, updateGoal } = useSpaces()
  const toast = useToast()
  const [ym, setYm] = useState(currentYM())
  const [budgetModal, setBudgetModal] = useState<{ category?: string; limit?: number } | null>(null)
  const [goalModal, setGoalModal] = useState<{ goal: Goal | null } | null>(null)
  const [deposit, setDeposit] = useState<{ goal: Goal; value: string } | null>(null)

  const mine = entries.filter((e) => e.spaceId === space.id)
  const spent = categoryBreakdown(mine, ym, 'despesa')
  const myBudgets = budgets.filter((b) => b.spaceId === space.id).sort((a, b) => a.category.localeCompare(b.category))
  const myGoals = goals.filter((g) => g.spaceId === space.id)
  const totalLimit = myBudgets.reduce((a, b) => a + b.monthlyLimit, 0)
  const totalSpentInBudgets = myBudgets.reduce((a, b) => a + (spent.find((s) => s.category === b.category)?.total ?? 0), 0)
  const unbudgeted = spent.filter((s) => !myBudgets.some((b) => b.category === s.category))

  const saveDeposit = async () => {
    if (!deposit) return
    const v = parseMoney(deposit.value)
    if (!v) return
    try {
      await updateGoal(deposit.goal.id, { saved: Math.max(0, Math.round((deposit.goal.saved + v) * 100) / 100) })
      toast.success(v > 0 ? 'Guardado!' : 'Retirada registrada', `${deposit.goal.name}: ${formatCurrency(Math.abs(v))}`)
      setDeposit(null)
    } catch (e) {
      toast.error('Não deu para salvar', e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={space.name}
        title="Orçamento e metas"
        description="Quanto pode gastar em cada categoria no mês, e para o que você está juntando dinheiro."
        actions={<MonthPicker value={ym} onChange={setYm} />}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            eyebrow={`Orçamento · ${words.outs.toLowerCase()} por categoria`}
            title={myBudgets.length ? <>Usado <Money value={totalSpentInBudgets} /> de <Money value={totalLimit} /></> : 'Limites de gasto'}
            action={
              <Button size="sm" variant="outline" icon={<Plus className="size-3.5" />} onClick={() => setBudgetModal({})}>
                Limite
              </Button>
            }
          />
          <CardBody className="space-y-5">
            {myBudgets.length ? (
              myBudgets.map((b) => {
                const used = spent.find((s) => s.category === b.category)?.total ?? 0
                const ratio = used / b.monthlyLimit
                const left = b.monthlyLimit - used
                return (
                  <button key={b.id} onClick={() => setBudgetModal({ category: b.category, limit: b.monthlyLimit })} className="block w-full text-left">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate text-fg">{b.category}</span>
                      <span className="shrink-0 text-xs text-muted">
                        <Money value={used} className="text-fg-soft" /> / <Money value={b.monthlyLimit} />
                      </span>
                    </div>
                    <Progress value={ratio} className={cn('mt-2 h-1.5', ratio > 1 && '[&>div]:from-danger [&>div]:via-danger [&>div]:to-danger')} />
                    <p className={cn('mt-1 text-[11px]', left < 0 ? 'text-danger' : 'text-faint')}>
                      {left < 0 ? (
                        <>
                          passou <Money value={-left} /> do limite
                        </>
                      ) : (
                        <>
                          ainda pode <Money value={left} /> · {formatPercent(Math.min(ratio, 1), 0)} usado
                        </>
                      )}
                    </p>
                  </button>
                )
              })
            ) : (
              <div className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">
                {space.kind === 'empresa'
                  ? 'Ex.: “Manutenção” até R$ 800 por mês, “Marketing” até R$ 500. Quando passar, fica vermelho.'
                  : 'Ex.: “Alimentação” até R$ 1.200, “Lazer” até R$ 300. Quando passar, fica vermelho.'}
              </div>
            )}

            {unbudgeted.length > 0 && (
              <div className="border-t border-line pt-4">
                <p className="mb-2 text-xs text-muted">Sem limite definido neste mês</p>
                <div className="flex flex-wrap gap-1.5">
                  {unbudgeted.slice(0, 10).map((s) => (
                    <button key={s.category} onClick={() => setBudgetModal({ category: s.category })} className="chip">
                      {s.category} · <Money value={s.total} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            eyebrow="Metas"
            title="Juntando dinheiro"
            action={
              <Button size="sm" variant="outline" icon={<Plus className="size-3.5" />} onClick={() => setGoalModal({ goal: null })}>
                Meta
              </Button>
            }
          />
          <CardBody className="space-y-4">
            {myGoals.length ? (
              myGoals.map((g) => {
                const ratio = g.saved / g.target
                const missing = Math.max(0, g.target - g.saved)
                const months = g.deadline ? monthsUntil(g.deadline) : 0
                const perMonth = g.deadline && months > 0 && missing > 0 ? missing / months : 0
                const late = g.deadline && g.deadline < localISO() && missing > 0
                return (
                  <div key={g.id} className="rounded-xl border border-line p-4">
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => setGoalModal({ goal: g })} className="min-w-0 text-left">
                        <p className="truncate text-sm text-fg">{g.name}</p>
                        <p className="text-[11px] text-faint">
                          {g.deadline ? `até ${formatDate(g.deadline)}` : 'sem prazo'}
                          {late && <span className="text-danger"> · prazo passou</span>}
                        </p>
                      </button>
                      <span className="font-mono text-xs text-muted">{formatPercent(Math.min(ratio, 1), 0)}</span>
                    </div>
                    <Progress value={ratio} className="mt-3 h-1.5" />
                    <p className="mt-2 text-xs text-muted">
                      <Money value={g.saved} className="text-fg" /> de <Money value={g.target} />
                      {missing === 0 ? ' · concluída ✓' : perMonth ? <> · guarde <Money value={perMonth} />/mês</> : null}
                    </p>
                    {deposit?.goal.id === g.id ? (
                      <div className="mt-3 flex gap-2">
                        <div className="flex-1">
                          <MoneyInput value={deposit.value} onChange={(v) => setDeposit({ goal: g, value: v })} autoFocus />
                        </div>
                        <Button size="md" variant="primary" onClick={() => void saveDeposit()}>
                          OK
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="secondary" className="mt-3" onClick={() => setDeposit({ goal: g, value: '' })}>
                        Guardar dinheiro
                      </Button>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="flex flex-col items-center rounded-xl border border-dashed border-line p-6 text-center">
                <Target className="size-5 text-muted" />
                <p className="mt-2 text-sm text-muted">
                  {space.kind === 'empresa' ? 'Ex.: reserva para impostos, uma máquina nova.' : 'Ex.: reserva de emergência, carro, viagem.'}
                </p>
              </div>
            )}
            {deposit && <p className="text-[11px] text-faint">Para tirar dinheiro da meta, digite com “−” na frente.</p>}
          </CardBody>
        </Card>
      </div>

      <BudgetFormModal open={!!budgetModal} onClose={() => setBudgetModal(null)} space={space} category={budgetModal?.category} limit={budgetModal?.limit} />
      <GoalFormModal open={!!goalModal} onClose={() => setGoalModal(null)} space={space} goal={goalModal?.goal} />
    </>
  )
}
