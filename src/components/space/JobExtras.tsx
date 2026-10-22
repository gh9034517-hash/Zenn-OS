// Partes da ficha do serviço: checklist (como no Trello) e material do estoque.
import { useState, type FormEvent } from 'react'
import { Check, Package, Plus, Undo2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { Progress } from '@/components/ui/Progress'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import { parseMoney } from '@/services/spaceMath'
import { formatDateShort } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { ChecklistItem, Job } from '@/types'

const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function JobChecklist({ job, readOnly }: { job: Job; readOnly?: boolean }) {
  const { updateJob } = useSpaces()
  const toast = useToast()
  const [text, setText] = useState('')
  const list = job.checklist ?? []
  const done = list.filter((c) => c.done).length

  const save = async (checklist: ChecklistItem[]) => {
    try {
      await updateJob(job.id, { checklist })
    } catch (e) {
      toast.error('Não deu para salvar', e instanceof Error ? e.message : String(e))
    }
  }

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    void save([...list, { id: newId(), text: text.trim(), done: false }])
    setText('')
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow">Checklist</p>
        {list.length > 0 && (
          <span className="font-mono text-[11px] text-muted">
            {done}/{list.length}
          </span>
        )}
      </div>
      {list.length > 0 && <Progress value={done / list.length} className="mb-3 h-1" />}
      <ul className="space-y-0.5">
        {list.map((c) => (
          <li key={c.id} className="group flex items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-white/[0.03]">
            <button
              disabled={readOnly}
              onClick={() => void save(list.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))}
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded-md border transition',
                c.done ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-transparent hover:border-white/60',
              )}
              aria-label={c.done ? `Desmarcar ${c.text}` : `Marcar ${c.text}`}
            >
              <Check className="size-3" strokeWidth={3} />
            </button>
            <span className={cn('min-w-0 flex-1 text-sm', c.done ? 'text-faint line-through' : 'text-fg')}>{c.text}</span>
            {!readOnly && (
              <button
                onClick={() => void save(list.filter((x) => x.id !== c.id))}
                className="rounded p-1 text-faint opacity-60 transition hover:text-fg sm:opacity-0 sm:group-hover:opacity-100"
                aria-label={`Tirar ${c.text}`}
              >
                <X className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <form onSubmit={add} className="mt-2 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nova etapa…" className="field py-2 text-sm" />
          <Button type="submit" size="sm" variant="secondary" icon={<Plus className="size-3.5" />} disabled={!text.trim()} className="h-[38px]">
            <span className="sr-only">Adicionar etapa</span>
          </Button>
        </form>
      )}
    </div>
  )
}

/** Material do estoque usado neste serviço (sai do estoque e fica registrado aqui). */
export function JobStockUse({ job, readOnly }: { job: Job; readOnly?: boolean }) {
  const { stockItems, stockMoves, moveStock, undoStockMove } = useSpaces()
  const toast = useToast()
  const items = stockItems.filter((i) => i.spaceId === job.spaceId)
  const used = stockMoves.filter((m) => m.jobId === job.id)
  const [open, setOpen] = useState(false)
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState('1')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const item = items.find((i) => i.id === (itemId || items[0]?.id))
    const n = parseMoney(qty)
    if (!item || !(n > 0)) return
    setBusy(true)
    try {
      await moveStock({ itemId: item.id, delta: -n, reason: 'uso', jobId: job.id, note: job.title })
      toast.success('Saiu do estoque', `${n} ${item.unit} de ${item.name}`)
      setQty('1')
      setOpen(false)
    } catch (err) {
      toast.error('Não deu para salvar', err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (!items.length && !used.length) return null

  return (
    <div>
      <p className="eyebrow mb-2">Material do estoque</p>
      {used.length > 0 && (
        <ul className="mb-2 space-y-1">
          {used.map((m) => {
            const item = stockItems.find((i) => i.id === m.itemId)
            return (
              <li key={m.id} className="flex items-center gap-2.5 text-sm">
                <Package className="size-3.5 shrink-0 text-faint" />
                <span className="min-w-0 flex-1 truncate">
                  {Math.abs(Number(m.delta))} {item?.unit} · {item?.name ?? 'item apagado'}
                </span>
                <span className="text-[11px] text-faint">{formatDateShort(m.date)}</span>
                {!readOnly && (
                  <button
                    onClick={() => void undoStockMove(m.id)}
                    className="rounded p-1 text-faint hover:text-fg"
                    title="Devolver ao estoque"
                    aria-label="Devolver ao estoque"
                  >
                    <Undo2 className="size-3.5" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {!readOnly &&
        items.length > 0 &&
        (open ? (
          <form onSubmit={submit} className="flex flex-wrap gap-2">
            <div className="min-w-0 flex-1">
              <Select value={itemId || items[0].id} onChange={(e) => setItemId(e.target.value)} aria-label="Material">
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} (tem {Number(i.qty)} {i.unit})
                  </option>
                ))}
              </Select>
            </div>
            <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="field w-20 font-mono" aria-label="Quantidade" />
            <Button type="submit" variant="primary" loading={busy}>
              Usar
            </Button>
          </form>
        ) : (
          <Button variant="secondary" size="sm" icon={<Package className="size-3.5" />} onClick={() => setOpen(true)}>
            Usar material do estoque
          </Button>
        ))}
    </div>
  )
}
