import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Contact, CornerDownLeft, Search, Users, type LucideIcon } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { normalize } from '@/utils/format'
import { LEAD_STATUS_LABEL, PROJECT_STATUS_LABEL, CLIENT_STATUS_LABEL } from '@/data/constants'
import { cn } from '@/utils/cn'

interface Result {
  id: string
  kind: 'Lead' | 'Cliente' | 'Projeto'
  icon: LucideIcon
  title: string
  subtitle: string
  meta: string
  to: string
}

/** Busca global: empresa, telefone, cidade, categoria, cliente e projeto. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { leads, clients, projects } = useData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  const results = useMemo<Result[]>(() => {
    const q = normalize(query.trim())
    if (!q) return []
    const qDigits = query.replace(/\D/g, '')
    const match = (...fields: (string | null | undefined)[]) =>
      fields.some((f) => normalize(f).includes(q)) ||
      (qDigits.length >= 3 && fields.some((f) => (f ?? '').replace(/\D/g, '').includes(qDigits)))

    const clientName = (id: string) => clients.find((c) => c.id === id)?.company ?? ''

    const out: Result[] = [
      ...clients
        .filter((c) => match(c.company, c.contactName, c.phone, c.city, c.category, c.email))
        .map((c) => ({
          id: c.id,
          kind: 'Cliente' as const,
          icon: Users,
          title: c.company,
          subtitle: [c.category, c.city, c.phone].filter(Boolean).join(' · '),
          meta: CLIENT_STATUS_LABEL[c.status],
          to: `/clientes/${c.id}`,
        })),
      ...projects
        .filter((p) => match(p.name, clientName(p.clientId), p.description))
        .map((p) => ({
          id: p.id,
          kind: 'Projeto' as const,
          icon: Briefcase,
          title: p.name,
          subtitle: clientName(p.clientId),
          meta: PROJECT_STATUS_LABEL[p.status],
          to: `/projetos/${p.id}`,
        })),
      ...leads
        .filter((l) => match(l.name, l.phone, l.city, l.category, l.address))
        .map((l) => ({
          id: l.id,
          kind: 'Lead' as const,
          icon: Contact,
          title: l.name,
          subtitle: [l.category, l.city, l.phone].filter(Boolean).join(' · '),
          meta: LEAD_STATUS_LABEL[l.status],
          to: `/leads?lead=${l.id}`,
        })),
    ]
    return out.slice(0, 30)
  }, [query, leads, clients, projects])

  useEffect(() => setActive(0), [query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(a + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
      }
      if (e.key === 'Enter' && results[active]) {
        navigate(results[active].to)
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, results, active, navigate, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="panel relative w-full max-w-2xl animate-scale-in overflow-hidden bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Empresa, telefone, cidade, categoria, cliente ou projeto…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
          />
          <kbd className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint">ESC</kbd>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {!query.trim() && (
            <p className="px-3 py-8 text-center text-sm text-faint">
              Digite para buscar em {leads.length} leads, {clients.length} clientes e {projects.length} projetos.
            </p>
          )}
          {query.trim() && results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-faint">Nenhum resultado para “{query}”.</p>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.kind}-${r.id}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                navigate(r.to)
                onClose()
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                i === active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
              )}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-muted">
                <r.icon className="size-4" strokeWidth={1.6} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{r.title}</span>
                <span className="block truncate text-xs text-faint">{r.subtitle}</span>
              </span>
              <span className="hidden text-right sm:block">
                <span className="block text-[10px] tracking-wider text-faint uppercase">{r.kind}</span>
                <span className="block text-xs text-muted">{r.meta}</span>
              </span>
              {i === active && <CornerDownLeft className="size-3.5 text-faint" />}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
