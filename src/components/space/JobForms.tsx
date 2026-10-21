// Serviço (móvel, frete...): formulário e ficha com dinheiro, etapas e ações.
import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowRight, CalendarClock, Hammer, MapPin, MessageCircle, Pencil, Phone, Receipt, Trash2, Truck } from 'lucide-react'
import { Drawer, Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { Progress } from '@/components/ui/Progress'
import { Money } from '@/components/space/Money'
import { MoneyInput } from '@/components/space/EntryFormModal'
import { EntryRow } from '@/components/space/EntryRow'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import {
  JOB_FLOW,
  JOB_KIND_LABEL,
  addDays,
  jobFinance,
  jobStatusLabel,
  localISO,
  nextJobStatus,
  parseMoney,
} from '@/services/spaceMath'
import { formatCurrency, formatDate, formatPercent, whatsappLink } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { EntryPreset } from '@/components/space/EntryFormModal'
import type { Entry, Job, JobKind, JobStatus, Space } from '@/types'

export const jobKindIcon = (kind: JobKind) => (kind === 'frete' ? Truck : Hammer)

const toInput = (n: number | undefined) => (n ? String(n).replace('.', ',') : '')

/** Valores para abrir o formulário de serviço já preenchido (ex.: vindo da calculadora). */
export type JobPreset = Partial<Pick<Job, 'kind' | 'title' | 'value' | 'costEstimate' | 'description' | 'client'>>

export function JobFormModal({
  open,
  onClose,
  space,
  job,
  preset,
}: {
  open: boolean
  onClose: () => void
  space: Space
  job?: Job | null
  preset?: JobPreset | null
}) {
  const { createJob, updateJob } = useSpaces()
  const toast = useToast()
  const [kind, setKind] = useState<JobKind>('movel')
  const [title, setTitle] = useState('')
  const [client, setClient] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [value, setValue] = useState('')
  const [cost, setCost] = useState('')
  const [deadline, setDeadline] = useState('')
  const [status, setStatus] = useState<JobStatus>('orcamento')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setKind(job?.kind ?? preset?.kind ?? 'movel')
    setTitle(job?.title ?? preset?.title ?? '')
    setClient(job?.client ?? preset?.client ?? '')
    setPhone(job?.phone ?? '')
    setAddress(job?.address ?? '')
    setValue(toInput(job?.value ?? preset?.value))
    setCost(toInput(job?.costEstimate ?? preset?.costEstimate))
    setDeadline(job?.deadline ?? '')
    setStatus(job?.status ?? 'orcamento')
    setDescription(job?.description ?? preset?.description ?? '')
  }, [open, job, preset])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = value.trim() ? parseMoney(value) : 0
    const c = cost.trim() ? parseMoney(cost) : 0
    if (!title.trim() || Number.isNaN(v) || Number.isNaN(c)) {
      toast.error('Confira os campos', 'O nome do serviço é obrigatório e os valores precisam ser números.')
      return
    }
    const data = {
      kind,
      title: title.trim(),
      client: client.trim(),
      phone: phone.trim() || null,
      address: address.trim(),
      value: Math.max(0, v),
      costEstimate: Math.max(0, c),
      deadline: deadline || null,
      status,
      description: description.trim(),
    }
    setBusy(true)
    try {
      if (job) await updateJob(job.id, data)
      else await createJob({ ...data, spaceId: space.id, notes: '' })
      toast.success(job ? 'Serviço atualizado' : 'Serviço criado', data.title)
      onClose()
    } catch (err) {
      toast.error('Não deu para salvar', err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const isFrete = kind === 'frete'

  return (
    <Modal open={open} onClose={onClose} eyebrow={space.name} title={job ? 'Editar serviço' : 'Novo serviço'}>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Segmented<JobKind>
            value={kind}
            onChange={setKind}
            options={[
              { value: 'movel', label: 'Móvel' },
              { value: 'frete', label: 'Frete' },
              { value: 'outro', label: 'Outro' },
            ]}
          />
        </div>
        <FormField label="O que é" className="sm:col-span-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isFrete ? 'Ex.: Entrega de 12 chapas MDF' : kind === 'movel' ? 'Ex.: Guarda-roupa 3 portas' : 'Ex.: Instalação de prateleiras'}
            required
            autoFocus={!job}
          />
        </FormField>
        <FormField label="Cliente">
          <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Nome" />
        </FormField>
        <FormField label="WhatsApp / telefone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-0000" inputMode="tel" />
        </FormField>
        <FormField label={isFrete ? 'Destino' : 'Endereço de entrega'} className="sm:col-span-2">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Opcional" />
        </FormField>
        <FormField label="Preço combinado">
          <MoneyInput value={value} onChange={setValue} />
        </FormField>
        <FormField label={isFrete ? 'Custo previsto (diesel, pedágio…)' : 'Custo previsto (material)'} hint="opcional">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-faint">R$</span>
            <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0,00" className="pl-10 font-mono" />
          </div>
        </FormField>
        <FormField label={isFrete ? 'Data da entrega' : 'Prazo de entrega'}>
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </FormField>
        <FormField label="Etapa">
          <Select value={status} onChange={(e) => setStatus(e.target.value as JobStatus)}>
            {[...JOB_FLOW, 'cancelado' as const].map((s) => (
              <option key={s} value={s}>
                {jobStatusLabel(s, kind)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Detalhes" className="sm:col-span-2">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-20"
            placeholder={isFrete ? 'Ex.: 12 chapas MDF 15mm branco, retirar no depósito às 8h' : 'Ex.: MDF branco 15mm, puxadores pretos, 2,10 x 1,80 m'}
          />
        </FormField>
        <div className="flex justify-end gap-2 border-t border-line pt-4 sm:col-span-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            {job ? 'Salvar' : 'Criar serviço'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function JobDrawer({
  job,
  onClose,
  onEdit,
  openEntry,
  readOnly,
}: {
  job: Job | null
  onClose: () => void
  onEdit: () => void
  openEntry: (entry?: Entry | null, preset?: EntryPreset) => void
  readOnly?: boolean
}) {
  const { entries, wallets, updateJob, deleteJob, setEntryPaid } = useSpaces()
  const toast = useToast()
  const [confirm, setConfirm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => setConfirm(false), [job?.id])
  if (!job) return null

  const f = jobFinance(job, entries)
  const Icon = jobKindIcon(job.kind)
  const today = localISO()
  const late = job.deadline && job.deadline < today && job.status !== 'entregue' && job.status !== 'cancelado'
  const incomeCategory = job.kind === 'frete' ? 'Fretes' : job.kind === 'movel' ? 'Móveis sob medida' : 'Serviços'
  const costCategory = job.kind === 'frete' ? 'Combustível' : 'Chapas e madeira'
  const wa = whatsappLink(
    job.phone,
    job.status === 'orcamento'
      ? `Olá${job.client ? `, ${job.client}` : ''}! Segue o orçamento: ${job.title} — ${formatCurrency(job.value)}. Qualquer dúvida, estou à disposição.`
      : `Olá${job.client ? `, ${job.client}` : ''}! Tudo bem? Sobre o ${job.title}: `,
  )

  const receive = (amount: number, label: string, status: 'pago' | 'pendente' = 'pago') =>
    openEntry(null, {
      type: 'receita',
      amount: amount > 0 ? Math.round(amount * 100) / 100 : undefined,
      description: `${job.title} — ${label}`,
      category: incomeCategory,
      counterparty: job.client,
      status,
      date: status === 'pendente' ? (job.deadline && job.deadline >= today ? job.deadline : addDays(today, 7)) : today,
      jobId: job.id,
    })

  const setStatus = async (status: JobStatus) => {
    try {
      await updateJob(job.id, { status })
      toast.success(jobStatusLabel(status, job.kind), job.title)
    } catch (e) {
      toast.error('Não deu para salvar', e instanceof Error ? e.message : String(e))
    }
  }

  const togglePaid = async (id: string, paid: boolean) => {
    setBusyId(id)
    try {
      await setEntryPaid(id, paid)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Drawer
      open={!!job}
      onClose={onClose}
      eyebrow={
        <span className="flex items-center gap-1.5">
          <Icon className="size-3.5" /> {JOB_KIND_LABEL[job.kind]}
        </span>
      }
      title={job.title}
      footer={
        readOnly ? undefined : (
          <>
            <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)}>
              Apagar
            </Button>
            <Button variant="outline" icon={<Pencil className="size-4" />} onClick={onEdit} className="ml-auto">
              Editar
            </Button>
          </>
        )
      }
    >
      {confirm ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Apagar <span className="text-fg">{job.title}</span>? Os pagamentos e custos lançados continuam em Movimentações, só deixam de estar
            ligados a este serviço.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Voltar
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await deleteJob(job.id)
                toast.success('Serviço apagado', job.title)
                onClose()
              }}
            >
              Apagar serviço
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cliente */}
          <div className="space-y-1.5 text-sm">
            {job.client && <p className="text-fg">{job.client}</p>}
            {job.phone && (
              <p className="flex items-center gap-2 text-muted">
                <Phone className="size-3.5" /> {job.phone}
              </p>
            )}
            {job.address && (
              <p className="flex items-center gap-2 text-muted">
                <MapPin className="size-3.5" /> {job.address}
              </p>
            )}
            {job.deadline && (
              <p className={cn('flex items-center gap-2', late ? 'text-danger' : 'text-muted')}>
                <CalendarClock className="size-3.5" /> {job.kind === 'frete' ? 'Entrega' : 'Prazo'}: {formatDate(job.deadline)}
                {late && ' · atrasado'}
              </p>
            )}
            {job.description && <p className="pt-1 whitespace-pre-line text-muted">{job.description}</p>}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs text-fg transition hover:border-white/40"
              >
                <MessageCircle className="size-3.5" /> Chamar no WhatsApp
              </a>
            )}
          </div>

          {/* Etapas */}
          <div>
            <p className="eyebrow mb-2">Etapa</p>
            <div className="grid grid-cols-4 gap-1">
              {JOB_FLOW.map((s, i) => {
                const reached = job.status !== 'cancelado' && JOB_FLOW.indexOf(job.status) >= i
                return (
                  <button
                    key={s}
                    disabled={readOnly}
                    onClick={() => void setStatus(s)}
                    className={cn(
                      'rounded-lg border px-1 py-2 text-[11px] leading-tight transition',
                      reached ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted hover:border-line-strong hover:text-fg',
                    )}
                  >
                    {jobStatusLabel(s, job.kind)}
                  </button>
                )
              })}
            </div>
            {!readOnly && (
              <button
                onClick={() => void setStatus(job.status === 'cancelado' ? 'orcamento' : 'cancelado')}
                className="mt-2 text-xs text-muted hover:text-fg"
              >
                {job.status === 'cancelado' ? 'Reabrir serviço' : 'Cancelar / cliente desistiu'}
              </button>
            )}
          </div>

          {/* Dinheiro */}
          <div className="rounded-2xl border border-line p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-muted">Preço combinado</p>
              <Money value={f.value} className="text-lg text-fg" />
            </div>
            <Progress value={f.paidRatio} className="mt-3 h-1.5" />
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted">Recebido</p>
                <Money value={f.received} className="text-sm text-fg" />
              </div>
              <div>
                <p className="text-muted">A receber</p>
                <Money value={f.toReceive + f.notCharged} className="text-sm text-fg-soft" />
              </div>
              <div>
                <p className="text-muted">{f.costIsEstimate ? 'Custo previsto' : 'Custos lançados'}</p>
                <Money value={f.costIsEstimate ? job.costEstimate : f.costs} className="text-sm text-fg-soft" />
              </div>
              <div>
                <p className="text-muted">Lucro {f.costIsEstimate || !f.costs ? 'estimado' : ''}</p>
                <span className={cn('text-sm', f.profit < 0 ? 'text-danger' : 'text-fg')}>
                  <Money value={f.profit} /> <span className="font-mono text-[11px] text-faint">{formatPercent(f.margin, 0)}</span>
                </span>
              </div>
            </div>
          </div>

          {!readOnly && (
            <div className="grid grid-cols-2 gap-2">
              {f.received === 0 && f.value > 0 && (
                <Button variant="secondary" icon={<ArrowDownLeft className="size-4" />} onClick={() => receive(f.value / 2, 'sinal')}>
                  Sinal 50%
                </Button>
              )}
              <Button variant="primary" icon={<ArrowDownLeft className="size-4" />} onClick={() => receive(f.notCharged, 'pagamento')}>
                Recebi
              </Button>
              {f.notCharged > 0 && (
                <Button variant="secondary" icon={<CalendarClock className="size-4" />} onClick={() => receive(f.notCharged, 'restante', 'pendente')}>
                  Cobrar depois
                </Button>
              )}
              <Button
                variant="secondary"
                icon={<Receipt className="size-4" />}
                onClick={() =>
                  openEntry(null, {
                    type: 'despesa',
                    description: `${job.title} — ${job.kind === 'frete' ? 'combustível' : 'material'}`,
                    category: costCategory,
                    status: 'pago',
                    jobId: job.id,
                  })
                }
              >
                Lançar custo
              </Button>
              {nextJobStatus(job.status) && (
                <Button
                  variant="outline"
                  icon={<ArrowRight className="size-4" />}
                  onClick={() => void setStatus(nextJobStatus(job.status)!)}
                  className="col-span-2"
                >
                  Passar para “{jobStatusLabel(nextJobStatus(job.status)!, job.kind)}”
                </Button>
              )}
            </div>
          )}

          {/* Lançamentos do serviço */}
          <div>
            <p className="eyebrow mb-2">Pagamentos e custos</p>
            {f.entries.length ? (
              <ul className="-mx-4 divide-y divide-line sm:-mx-5">
                {f.entries
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      wallets={wallets}
                      onEdit={() => openEntry(e)}
                      onTogglePaid={readOnly || e.status === 'pago' ? undefined : () => void togglePaid(e.id, true)}
                      busy={busyId === e.id}
                    />
                  ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nada lançado ainda. Use “Sinal”, “Recebi” ou “Lançar custo”.</p>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}
