import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Bell, Check, Plus, Truck, Hammer } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { Money } from '@/components/space/Money'
import { useSpacePage } from '@/layouts/SpaceLayout'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import { addDays, localISO } from '@/services/spaceMath'
import { cn } from '@/utils/cn'
import type { Entry, Job, Reminder } from '@/types'

type Range = '7' | '14' | '30'

type Item =
  | { kind: 'job'; date: string; job: Job }
  | { kind: 'entry'; date: string; entry: Entry }
  | { kind: 'reminder'; date: string; reminder: Reminder }

function dayTitle(date: string, today: string) {
  if (date === today) return 'Hoje'
  if (date === addDays(today, 1)) return 'Amanhã'
  const d = new Date(`${date}T12:00:00`)
  const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Tudo que tem data: entregas, contas e lembretes, dia a dia. */
export default function SpaceAgenda() {
  const { space, openEntry, readOnly } = useSpacePage()
  const { jobs, entries, reminders, setEntryPaid, updateReminder, createReminder } = useSpaces()
  const toast = useToast()
  const navigate = useNavigate()
  const [range, setRange] = useState<Range>('14')
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const today = localISO()
  const end = addDays(today, Number(range) - 1)

  const items: Item[] = [
    ...jobs
      .filter((j) => j.spaceId === space.id && j.deadline && j.status !== 'entregue' && j.status !== 'cancelado' && j.deadline <= end)
      .map((job) => ({ kind: 'job' as const, date: job.deadline!, job })),
    ...entries
      .filter((e) => e.spaceId === space.id && e.status === 'pendente' && !e.isTransfer && e.date <= end)
      .map((entry) => ({ kind: 'entry' as const, date: entry.date, entry })),
    ...reminders
      .filter((r) => r.spaceId === space.id && !r.done && r.dueDate && r.dueDate <= end)
      .map((reminder) => ({ kind: 'reminder' as const, date: reminder.dueDate!, reminder })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind))

  const late = items.filter((i) => i.date < today)
  const days = new Map<string, Item[]>()
  for (const i of items.filter((i) => i.date >= today)) days.set(i.date, [...(days.get(i.date) ?? []), i])
  const deliveries = items.filter((i) => i.kind === 'job').length

  const addReminder = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    try {
      await createReminder({ spaceId: space.id, title: title.trim(), dueDate: due || today, done: false, notes: '' })
      setTitle('')
      setDue('')
    } catch (err) {
      toast.error('Não deu para salvar', err instanceof Error ? err.message : String(err))
    }
  }

  const Row = ({ item }: { item: Item }) => {
    if (item.kind === 'job') {
      const j = item.job
      const Icon = j.kind === 'frete' ? Truck : Hammer
      return (
        <li>
          <button onClick={() => navigate(`/e/${space.id}/servicos?abrir=${j.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02] sm:px-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/30 bg-white/[0.08]">
              <Icon className="size-4" strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{j.kind === 'frete' ? 'Frete' : 'Entregar'}: {j.title}</span>
              <span className="block truncate text-xs text-muted">{[j.client, j.address].filter(Boolean).join(' · ') || 'serviço'}</span>
            </span>
            {j.value > 0 && <Money value={j.value} className="shrink-0 text-sm text-fg-soft" />}
          </button>
        </li>
      )
    }
    if (item.kind === 'entry') {
      const e = item.entry
      const isIn = e.type === 'receita'
      return (
        <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-muted">
            {isIn ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
          </span>
          <button onClick={() => openEntry(e)} className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm">{isIn ? 'Receber' : 'Pagar'}: {e.description}</span>
            <span className="block truncate text-xs text-muted">{[e.category, e.counterparty].filter(Boolean).join(' · ') || 'conta'}</span>
          </button>
          <Money value={e.amount} sign={isIn ? 'in' : 'out'} className="shrink-0 text-sm" />
          {!readOnly && (
            <Button size="sm" variant={item.date < today ? 'primary' : 'secondary'} icon={<Check className="size-3.5" />} onClick={() => void setEntryPaid(e.id, true)}>
              <span className="hidden sm:inline">{isIn ? 'Recebi' : 'Paguei'}</span>
            </Button>
          )}
        </li>
      )
    }
    const r = item.reminder
    return (
      <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-muted">
          <Bell className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
        {!readOnly && (
          <Button size="sm" variant="ghost" icon={<Check className="size-3.5" />} onClick={() => void updateReminder(r.id, { done: true })}>
            <span className="hidden sm:inline">Feito</span>
          </Button>
        )}
      </li>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow={space.name}
        title="Agenda"
        description={
          space.kind === 'empresa'
            ? 'Entregas, contas para pagar e receber e lembretes, dia a dia. O que você precisa resolver, num lugar só.'
            : 'Contas e lembretes, dia a dia.'
        }
        actions={
          <Segmented<Range>
            value={range}
            onChange={setRange}
            options={[
              { value: '7', label: '7 dias' },
              { value: '14', label: '14 dias' },
              { value: '30', label: '30 dias' },
            ]}
          />
        }
      />

      {!readOnly && (
        <Card className="mb-4 p-3">
          <form onSubmit={addReminder} className="flex flex-col gap-2 sm:flex-row">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Anotar algo para um dia (ex.: buscar chapas na madeireira)" className="flex-1" />
            <div className="flex gap-2">
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="sm:w-40" aria-label="Dia" />
              <Button type="submit" variant="primary" icon={<Plus className="size-4" />} disabled={!title.trim()}>
                Anotar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <p className="mb-3 text-xs text-muted">
        {items.length} {items.length === 1 ? 'coisa' : 'coisas'} nos próximos {range} dias
        {space.kind === 'empresa' && ` · ${deliveries} ${deliveries === 1 ? 'entrega' : 'entregas'}`}
        {late.length > 0 && <span className="text-danger"> · {late.length} atrasadas</span>}
      </p>

      <div className="space-y-4">
        {late.length > 0 && (
          <Card className="overflow-hidden border-danger/25">
            <p className="border-b border-line px-4 py-2.5 text-sm font-medium text-danger sm:px-5">Atrasado</p>
            <ul className="divide-y divide-line">
              {late.map((i) => (
                <Row key={`${i.kind}-${i.kind === 'job' ? i.job.id : i.kind === 'entry' ? i.entry.id : i.reminder.id}`} item={i} />
              ))}
            </ul>
          </Card>
        )}
        {[...days.entries()].map(([date, list]) => (
          <Card key={date} className="overflow-hidden">
            <p className={cn('border-b border-line px-4 py-2.5 text-sm font-medium sm:px-5', date === today && 'text-fg')}>{dayTitle(date, today)}</p>
            <ul className="divide-y divide-line">
              {list.map((i) => (
                <Row key={`${i.kind}-${i.kind === 'job' ? i.job.id : i.kind === 'entry' ? i.entry.id : i.reminder.id}`} item={i} />
              ))}
            </ul>
          </Card>
        ))}
        {!items.length && (
          <Card className="px-6 py-14 text-center">
            <p className="text-sm">Agenda livre nos próximos {range} dias</p>
            <p className="mt-1 text-xs text-muted">Prazos dos serviços, contas e lembretes com data aparecem aqui.</p>
          </Card>
        )}
      </div>
    </>
  )
}
