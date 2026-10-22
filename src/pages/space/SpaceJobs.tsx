import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Calculator, CalendarClock, CheckSquare, Columns3, List, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Stat } from '@/components/ui/Stat'
import { Progress } from '@/components/ui/Progress'
import { Segmented } from '@/components/ui/Segmented'
import { Kanban } from '@/components/ui/Kanban'
import { Money } from '@/components/space/Money'
import { JobDrawer, JobFormModal, defaultChecklist, jobKindIcon, type JobPreset } from '@/components/space/JobForms'
import { useSpacePage } from '@/layouts/SpaceLayout'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { JOB_FLOW, JOB_KIND_LABEL, addDays, currentYM, jobFinance, jobStatusLabel, localISO, nextJobStatus } from '@/services/spaceMath'
import { formatDateShort } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Job, JobKind, JobStatus } from '@/types'

type KindFilter = 'todos' | JobKind
type View = 'quadro' | 'lista'

/** Nome das colunas do quadro (o que o administrador vê no dia a dia). */
const columnLabel = (s: JobStatus, kind: KindFilter) =>
  s === 'orcamento'
    ? 'Para fechar'
    : s === 'aprovado'
      ? 'Aprovado · a fazer'
      : s === 'andamento'
        ? kind === 'frete'
          ? 'Agendado'
          : kind === 'movel'
            ? 'Em produção'
            : 'Em produção / agendado'
        : 'Entregue'

/** Adicionar rápido no fim da coluna, como no Trello: só o nome. */
function QuickAdd({ status, kind, spaceId }: { status: JobStatus; kind: KindFilter; spaceId: string }) {
  const { createJob } = useSpaces()
  const toast = useToast()
  const [openForm, setOpenForm] = useState(false)
  const [title, setTitle] = useState('')
  const k: JobKind = kind === 'todos' ? 'movel' : kind
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    try {
      await createJob({
        spaceId,
        kind: k,
        title: title.trim(),
        client: '',
        phone: null,
        address: '',
        description: '',
        value: 0,
        costEstimate: 0,
        deadline: null,
        status,
        notes: '',
        checklist: defaultChecklist(k),
      })
      setTitle('')
    } catch (err) {
      toast.error('Não deu para criar', err instanceof Error ? err.message : String(err))
    }
  }
  return openForm ? (
    <form onSubmit={submit} className="space-y-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpenForm(false)}
        placeholder={k === 'frete' ? 'Ex.: Frete chapas — Centro' : 'Ex.: Armário da lavanderia'}
        className="field py-2 text-sm"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={!title.trim()}>
          Adicionar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpenForm(false)}>
          Fechar
        </Button>
      </div>
    </form>
  ) : (
    <button
      onClick={() => setOpenForm(true)}
      className="flex w-full items-center gap-1.5 rounded-xl px-2 py-2 text-xs text-muted transition hover:bg-white/[0.04] hover:text-fg"
    >
      <Plus className="size-3.5" /> Adicionar cartão
    </button>
  )
}

export default function SpaceJobs() {
  const { space, openEntry, readOnly } = useSpacePage()
  const { jobs, entries, updateJob } = useSpaces()
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [kind, setKind] = useState<KindFilter>('todos')
  const [view, setView] = useLocalStorage<View>('zenn-os:jobs-view', 'quadro')
  const [form, setForm] = useState<{ job: Job | null; preset?: JobPreset | null } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showOld, setShowOld] = useState(false)
  const today = localISO()
  const monthAgo = addDays(today, -30)

  // Vindo da calculadora ou de Clientes: abre o "Novo serviço" já preenchido.
  useEffect(() => {
    const preset = (location.state as { newJob?: JobPreset } | null)?.newJob
    if (preset) {
      setForm({ job: null, preset })
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state, location.pathname, navigate])
  // Vindo da Agenda / Clientes: abre o cartão.
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('abrir')
    if (id) setOpenId(id)
  }, [location.search])

  const mine = useMemo(() => jobs.filter((j) => j.spaceId === space.id && (kind === 'todos' || j.kind === kind)), [jobs, space.id, kind])
  const open = jobs.find((j) => j.id === openId) ?? null
  const active = mine.filter((j) => j.status === 'aprovado' || j.status === 'andamento')
  const quotes = mine.filter((j) => j.status === 'orcamento')
  const delivered = mine.filter((j) => j.status === 'entregue')
  const cancelled = mine.filter((j) => j.status === 'cancelado')
  // No quadro, "Entregue" mostra só o último mês; o resto fica no histórico.
  const onBoard = mine.filter((j) => j.status !== 'cancelado' && (j.status !== 'entregue' || j.updatedAt.slice(0, 10) >= monthAgo))
  const oldOnes = [...delivered.filter((j) => j.updatedAt.slice(0, 10) < monthAgo), ...cancelled]
  const fin = (j: Job) => jobFinance(j, entries)
  const toReceive = mine
    .filter((j) => j.status !== 'cancelado' && j.status !== 'orcamento')
    .reduce((a, j) => {
      const f = fin(j)
      return a + f.toReceive + f.notCharged
    }, 0)
  const deliveredThisMonth = delivered.filter((j) => j.updatedAt.slice(0, 7) === currentYM())
  const profitThisMonth = deliveredThisMonth.reduce((a, j) => a + fin(j).profit, 0)

  const move = async (j: Job, status: JobStatus) => {
    try {
      await updateJob(j.id, { status })
      toast.success(jobStatusLabel(status, j.kind), j.title)
    } catch (e) {
      toast.error('Não deu para salvar', e instanceof Error ? e.message : String(e))
    }
  }

  const JobCard = ({ j, compact }: { j: Job; compact?: boolean }) => {
    const f = fin(j)
    const Icon = jobKindIcon(j.kind)
    const late = j.deadline && j.deadline < today && j.status !== 'entregue' && j.status !== 'cancelado'
    const next = nextJobStatus(j.status)
    const list = j.checklist ?? []
    const done = list.filter((c) => c.done).length
    return (
      <div className={cn('rounded-xl border border-line bg-surface p-3 transition hover:border-line-strong', compact && 'rounded-none border-0 bg-transparent px-4 py-3.5 sm:px-5')}>
        <button onClick={() => setOpenId(j.id)} className="block w-full text-left">
          <span className="flex items-start gap-2">
            <Icon className="mt-0.5 size-3.5 shrink-0 text-faint" strokeWidth={1.8} />
            <span className="min-w-0 flex-1 text-sm leading-snug text-fg">{j.title}</span>
          </span>
          <span className="mt-1 block truncate pl-5.5 text-xs text-muted">
            {[j.client, compact ? JOB_KIND_LABEL[j.kind] : null].filter(Boolean).join(' · ') || 'sem cliente'}
          </span>
          <span className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-5.5 text-[11px]">
            {j.deadline && (
              <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5', late ? 'border-danger/40 text-danger' : 'border-line text-muted')}>
                <CalendarClock className="size-3" />
                {formatDateShort(j.deadline)}
              </span>
            )}
            {list.length > 0 && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5',
                  done === list.length ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted',
                )}
              >
                <CheckSquare className="size-3" />
                {done}/{list.length}
              </span>
            )}
            {j.value > 0 && <Money value={j.value} className="ml-auto text-xs text-fg" />}
          </span>
          {j.status !== 'orcamento' && j.value > 0 && (
            <span className="mt-2 block pl-5.5">
              <Progress value={f.paidRatio} className="h-1" />
              <span className="mt-1 block text-[10px] text-faint">
                {f.paidRatio >= 1 ? 'pago' : <>recebido <Money value={f.received} /></>}
              </span>
            </span>
          )}
        </button>
        {next && !readOnly && (
          <button
            onClick={() => void move(j, next)}
            className="mt-2 ml-5.5 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] text-muted transition hover:bg-white/5 hover:text-fg"
          >
            {jobStatusLabel(next, j.kind)} <ArrowRight className="size-3" />
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow={space.name}
        title="Quadro de serviços"
        description="Móveis e fretes do primeiro contato à entrega. Arraste os cartões entre as colunas (no celular, toque na próxima etapa)."
        actions={
          <>
            <Segmented<View>
              value={view}
              onChange={setView}
              options={[
                { value: 'quadro', label: 'Quadro', icon: <Columns3 /> },
                { value: 'lista', label: 'Lista', icon: <List /> },
              ]}
            />
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
        <Stat label="Para fechar" value={quotes.length} hint={<><Money value={quotes.reduce((a, j) => a + j.value, 0)} /> em orçamentos</>} />
        <Stat label="Em andamento" value={active.length} hint={<><Money value={active.reduce((a, j) => a + j.value, 0)} /> para entregar</>} />
        <Stat label="A receber" value={<Money value={toReceive} />} hint="dos serviços fechados" />
        <Stat emphasis label="Lucro entregue no mês" value={<Money value={profitThisMonth} />} hint={`${deliveredThisMonth.length} entregues`} />
      </div>

      <div className="mt-4 mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {(['todos', 'movel', 'frete', 'outro'] as KindFilter[]).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={cn('chip', kind === k && 'chip-on')}>
            {k === 'todos' ? 'Todos' : k === 'movel' ? 'Móveis' : k === 'frete' ? 'Fretes' : 'Outros'}
          </button>
        ))}
      </div>

      {view === 'quadro' ? (
        <Kanban<Job, JobStatus>
          columns={JOB_FLOW.map((s) => ({ id: s, label: columnLabel(s, kind) }))}
          items={onBoard.sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))}
          getStatus={(j) => j.status}
          onMove={(j, s) => (readOnly ? undefined : move(j, s))}
          renderCard={(j) => <JobCard j={j} />}
          columnMeta={(_, rows) => (rows.length ? <Money value={rows.reduce((a, j) => a + j.value, 0)} compact className="text-[11px] text-muted" /> : null)}
          columnFooter={(s) => (s === 'entregue' || readOnly ? null : <QuickAdd status={s} kind={kind} spaceId={space.id} />)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {JOB_FLOW.map((s) => {
            const rows = onBoard.filter((j) => j.status === s).sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))
            return (
              <Card key={s} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
                  <p className="text-sm font-medium">{columnLabel(s, kind)}</p>
                  <span className="font-mono text-xs text-muted">{rows.length}</span>
                </div>
                {rows.length ? (
                  <ul className="divide-y divide-line">
                    {rows.map((j) => (
                      <li key={j.id}>
                        <JobCard j={j} compact />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-6 text-center text-xs text-faint">Nenhum</p>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {oldOnes.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowOld((v) => !v)} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
            <CalendarClock className="size-3.5" />
            {showOld ? 'Esconder' : 'Ver'} entregues há mais de 30 dias e cancelados ({oldOnes.length})
          </button>
          {showOld && (
            <Card className="mt-3 overflow-hidden">
              <ul className="divide-y divide-line">
                {oldOnes
                  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                  .slice(0, 60)
                  .map((j) => (
                    <li key={j.id}>
                      <JobCard j={j} compact />
                    </li>
                  ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <JobFormModal open={!!form} onClose={() => setForm(null)} space={space} job={form?.job} preset={form?.preset} />
      <JobDrawer
        job={form ? null : open}
        onClose={() => {
          setOpenId(null)
          if (location.search) navigate(location.pathname, { replace: true })
        }}
        onEdit={() => open && setForm({ job: open })}
        openEntry={openEntry}
        readOnly={readOnly}
      />
    </>
  )
}
