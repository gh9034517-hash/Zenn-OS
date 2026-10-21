import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Calculator, CalendarClock, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Stat } from '@/components/ui/Stat'
import { Progress } from '@/components/ui/Progress'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/components/space/Money'
import { JobDrawer, JobFormModal, jobKindIcon, type JobPreset } from '@/components/space/JobForms'
import { useSpacePage } from '@/layouts/SpaceLayout'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import { JOB_FLOW, JOB_KIND_LABEL, currentYM, jobFinance, jobStatusLabel, localISO, nextJobStatus } from '@/services/spaceMath'
import { formatDateShort } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Job, JobKind, JobStatus } from '@/types'

type KindFilter = 'todos' | JobKind

export default function SpaceJobs() {
  const { space, openEntry, readOnly } = useSpacePage()
  const { jobs, entries, updateJob } = useSpaces()
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [kind, setKind] = useState<KindFilter>('todos')
  const [form, setForm] = useState<{ job: Job | null; preset?: JobPreset | null } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const today = localISO()

  // Vindo da calculadora: abre o "Novo serviço" já com o preço.
  useEffect(() => {
    const preset = (location.state as { newJob?: JobPreset } | null)?.newJob
    if (preset) {
      setForm({ job: null, preset })
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state, location.pathname, navigate])

  const mine = useMemo(() => jobs.filter((j) => j.spaceId === space.id && (kind === 'todos' || j.kind === kind)), [jobs, space.id, kind])
  const open = jobs.find((j) => j.id === openId) ?? null
  const active = mine.filter((j) => j.status === 'aprovado' || j.status === 'andamento')
  const quotes = mine.filter((j) => j.status === 'orcamento')
  const delivered = mine.filter((j) => j.status === 'entregue')
  const cancelled = mine.filter((j) => j.status === 'cancelado')
  const fin = (j: Job) => jobFinance(j, entries)
  const toReceive = mine
    .filter((j) => j.status !== 'cancelado' && j.status !== 'orcamento')
    .reduce((a, j) => {
      const f = fin(j)
      return a + f.toReceive + f.notCharged
    }, 0)
  const deliveredThisMonth = delivered.filter((j) => j.updatedAt.slice(0, 7) === currentYM())
  const profitThisMonth = deliveredThisMonth.reduce((a, j) => a + fin(j).profit, 0)

  const advance = async (j: Job) => {
    const next = nextJobStatus(j.status)
    if (!next) return
    try {
      await updateJob(j.id, { status: next })
      toast.success(jobStatusLabel(next, j.kind), j.title)
    } catch (e) {
      toast.error('Não deu para salvar', e instanceof Error ? e.message : String(e))
    }
  }

  const JobCard = ({ j }: { j: Job }) => {
    const f = fin(j)
    const Icon = jobKindIcon(j.kind)
    const late = j.deadline && j.deadline < today && j.status !== 'entregue' && j.status !== 'cancelado'
    const next = nextJobStatus(j.status)
    return (
      <li className="px-4 py-3.5 sm:px-5">
        <button onClick={() => setOpenId(j.id)} className="flex w-full items-start gap-3 text-left">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line text-muted">
            <Icon className="size-4" strokeWidth={1.7} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-fg">{j.title}</span>
            <span className="block truncate text-xs text-muted">
              {[j.client, JOB_KIND_LABEL[j.kind]].filter(Boolean).join(' · ')}
              {j.deadline && (
                <span className={cn(late && 'text-danger')}>
                  {' · '}
                  {late ? 'atrasado ' : ''}
                  {formatDateShort(j.deadline)}
                </span>
              )}
            </span>
          </span>
          <Money value={j.value} className="shrink-0 text-sm text-fg" />
        </button>
        {j.status !== 'orcamento' && j.status !== 'cancelado' && j.value > 0 && (
          <div className="mt-2.5 pl-12">
            <Progress value={f.paidRatio} className="h-1" />
            <p className="mt-1 text-[11px] text-faint">
              recebido <Money value={f.received} /> de <Money value={f.value} />
            </p>
          </div>
        )}
        {next && !readOnly && (
          <div className="mt-2 pl-12">
            <button onClick={() => void advance(j)} className="inline-flex items-center gap-1 text-xs text-muted transition hover:text-fg">
              {jobStatusLabel(next, j.kind)} <ArrowRight className="size-3" />
            </button>
          </div>
        )}
      </li>
    )
  }

  const sections: { status: JobStatus; rows: Job[] }[] = JOB_FLOW.filter((s) => s !== 'entregue').map((s) => ({
    status: s,
    rows: mine.filter((j) => j.status === s).sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')),
  }))
  const kindLabel = (s: JobStatus) =>
    s === 'andamento' ? (kind === 'frete' ? 'Agendados' : kind === 'movel' ? 'Em produção' : 'Em produção / agendados') : jobStatusLabel(s, 'movel')

  return (
    <>
      <PageHeader
        eyebrow={space.name}
        title="Serviços"
        description="Móveis, fretes e outros serviços: do orçamento à entrega, com quanto cada um rendeu."
        actions={
          <>
            <Button variant="outline" icon={<Calculator className="size-4" />} onClick={() => navigate('/calculadoras')}>
              Calcular preço
            </Button>
            {!readOnly && (
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ job: null })}>
                Novo serviço
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Em andamento" value={active.length} hint={<><Money value={active.reduce((a, j) => a + j.value, 0)} /> em serviços</>} />
        <Stat label="Orçamentos" value={quotes.length} hint={<><Money value={quotes.reduce((a, j) => a + j.value, 0)} /> esperando resposta</>} />
        <Stat label="A receber" value={<Money value={toReceive} />} hint="dos serviços aprovados" />
        <Stat emphasis label="Lucro entregue no mês" value={<Money value={profitThisMonth} />} hint={`${deliveredThisMonth.length} entregues`} />
      </div>

      <div className="mt-4 mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {(['todos', 'movel', 'frete', 'outro'] as KindFilter[]).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={cn('chip', kind === k && 'chip-on')}>
            {k === 'todos' ? 'Todos' : k === 'movel' ? 'Móveis' : k === 'frete' ? 'Fretes' : 'Outros'}
          </button>
        ))}
      </div>

      {mine.length === 0 ? (
        <Card>
          <EmptyState
            title={kind === 'todos' ? 'Nenhum serviço ainda' : 'Nada deste tipo'}
            description="Cadastre o orçamento de um móvel ou um frete. Depois é só ir avançando: aprovado, em produção, entregue — e lançar o sinal e o pagamento."
            action={
              !readOnly && (
                <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ job: null })}>
                  Novo serviço
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {sections.map((s) => (
            <Card key={s.status} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
                <p className="text-sm font-medium">{kindLabel(s.status)}</p>
                <span className="font-mono text-xs text-muted">{s.rows.length}</span>
              </div>
              {s.rows.length ? (
                <ul className="divide-y divide-line">
                  {s.rows.map((j) => (
                    <JobCard key={j.id} j={j} />
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-6 text-center text-xs text-faint">Nenhum</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {(delivered.length > 0 || cancelled.length > 0) && (
        <div className="mt-6">
          <button onClick={() => setShowDone((v) => !v)} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
            <CalendarClock className="size-3.5" />
            {showDone ? 'Esconder' : 'Ver'} entregues ({delivered.length}){cancelled.length ? ` e cancelados (${cancelled.length})` : ''}
          </button>
          {showDone && (
            <Card className="mt-3 overflow-hidden">
              <ul className="divide-y divide-line">
                {[...delivered, ...cancelled]
                  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                  .slice(0, 40)
                  .map((j) => (
                    <JobCard key={j.id} j={j} />
                  ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <JobFormModal open={!!form} onClose={() => setForm(null)} space={space} job={form?.job} preset={form?.preset} />
      <JobDrawer
        job={form ? null : open}
        onClose={() => setOpenId(null)}
        onEdit={() => open && setForm({ job: open })}
        openEntry={openEntry}
        readOnly={readOnly}
      />
    </>
  )
}
