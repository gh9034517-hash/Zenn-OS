import { useState, type FormEvent } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useSpacePage } from '@/layouts/SpaceLayout'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import { localISO } from '@/services/spaceMath'
import { formatDateShort } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Reminder } from '@/types'

export default function SpaceReminders() {
  const { space } = useSpacePage()
  const { reminders, createReminder, updateReminder, deleteReminder } = useSpaces()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const today = localISO()

  const mine = reminders.filter((r) => r.spaceId === space.id)
  const pending = mine.filter((r) => !r.done)
  const done = mine.filter((r) => r.done).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    try {
      await createReminder({ spaceId: space.id, title: title.trim(), dueDate: due || null, done: false, notes: '' })
      setTitle('')
      setDue('')
    } catch (err) {
      toast.error('Não deu para salvar', err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const Row = ({ r }: { r: Reminder }) => {
    const late = !r.done && r.dueDate && r.dueDate < today
    return (
      <li className="group flex items-center gap-3 px-4 py-3 sm:px-5">
        <button
          onClick={() => void updateReminder(r.id, { done: !r.done })}
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-lg border transition',
            r.done ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-transparent hover:border-white hover:text-fg',
          )}
          aria-label={r.done ? `Reabrir ${r.title}` : `Concluir ${r.title}`}
        >
          <Check className="size-3.5" strokeWidth={2.5} />
        </button>
        <span className={cn('min-w-0 flex-1 truncate text-sm', r.done ? 'text-faint line-through' : 'text-fg')}>{r.title}</span>
        {r.dueDate && (
          <span className={cn('shrink-0 text-xs', late ? 'text-danger' : r.dueDate === today ? 'text-fg' : 'text-muted')}>
            {r.dueDate === today ? 'hoje' : formatDateShort(r.dueDate)}
          </span>
        )}
        <button
          onClick={() => void deleteReminder(r.id)}
          className="shrink-0 rounded-lg p-1.5 text-faint transition hover:bg-white/5 hover:text-fg sm:opacity-0 sm:group-hover:opacity-100"
          aria-label={`Apagar ${r.title}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      </li>
    )
  }

  return (
    <>
      <PageHeader eyebrow={space.name} title="Lembretes" description="Pequenas coisas para não esquecer: ligar para alguém, pedir nota, ir ao banco." />

      <Card className="overflow-hidden">
        <form onSubmit={add} className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Novo lembrete…" className="flex-1" />
          <div className="flex gap-2">
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="sm:w-40" aria-label="Data (opcional)" />
            <Button type="submit" variant="primary" loading={busy} icon={<Plus className="size-4" />} disabled={!title.trim()}>
              Adicionar
            </Button>
          </div>
        </form>
        {pending.length ? (
          <ul className="divide-y divide-line">
            {pending.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-muted">Nada pendente por aqui.</p>
        )}
      </Card>

      {done.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowDone((v) => !v)} className="text-xs text-muted hover:text-fg">
            {showDone ? 'Esconder' : 'Ver'} concluídos ({done.length})
          </button>
          {showDone && (
            <Card className="mt-3 overflow-hidden">
              <ul className="divide-y divide-line">
                {done.slice(0, 30).map((r) => (
                  <Row key={r.id} r={r} />
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
