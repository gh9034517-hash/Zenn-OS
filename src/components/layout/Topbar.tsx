import { Eye, EyeOff, Menu, Plus, Search } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { DemoBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useData } from '@/context/DataContext'
import { useActiveSpace } from '@/hooks/useActiveSpace'
import { useHideValues } from '@/components/space/Money'
import { openNewEntry } from '@/utils/events'

export function Topbar({ onOpenMenu, onOpenSearch }: { onOpenMenu: () => void; onOpenSearch: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { hasDemoData } = useData()
  const { key, space, groups } = useActiveSpace()
  const [hidden, toggleHidden] = useHideValues()
  const items = groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })))
  // O item mais específico que casa com a URL (Resumo /e/x não engole /e/x/contas).
  const current = items
    .filter((i) => (i.to === '/' || /^\/e\/[^/]+$/.test(i.to) ? pathname === i.to : pathname.startsWith(i.to)))
    .sort((a, b) => b.to.length - a.to.length)[0]
  const where = key === 'geral' ? 'Visão geral' : key === 'zenn' ? (current?.group ?? 'Zenn OS') : (space?.name ?? 'Zenn OS')

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-void/75 px-4 backdrop-blur-xl sm:gap-3 sm:px-6">
      <button
        onClick={onOpenMenu}
        className="rounded-lg p-2 text-muted transition hover:bg-white/5 hover:text-fg lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="hidden min-w-0 items-center gap-2 text-sm md:flex">
        <span className="eyebrow text-faint">{where}</span>
        {current && key !== 'geral' && (
          <>
            <span className="text-faint">/</span>
            <span className="truncate text-fg-soft">{current.label}</span>
          </>
        )}
      </div>

      <button
        onClick={onOpenSearch}
        className="group ml-auto flex h-9 w-full min-w-0 max-w-sm items-center gap-2.5 rounded-xl border border-line bg-ink px-3 text-sm text-faint transition hover:border-line-strong hover:text-muted md:w-80"
      >
        <Search className="size-4" />
        <span className="flex-1 truncate text-left">Buscar empresa, telefone, lançamento…</span>
        <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </button>

      <button
        onClick={toggleHidden}
        className="grid size-9 shrink-0 place-items-center rounded-xl border border-line text-muted transition hover:border-line-strong hover:text-fg"
        aria-label={hidden ? 'Mostrar valores' : 'Ocultar valores'}
        aria-pressed={hidden}
        title={hidden ? 'Mostrar valores' : 'Ocultar valores'}
      >
        {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>

      {hasDemoData && key === 'zenn' && (
        <button onClick={() => navigate('/configuracoes')} className="hidden sm:block" title="Ver status das integrações">
          <DemoBadge label="Demo mode" />
        </button>
      )}

      <div className="hidden sm:block">
        {key === 'zenn' ? (
          <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />} onClick={() => navigate('/prospeccao')}>
            Prospectar
          </Button>
        ) : space ? (
          <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />} onClick={openNewEntry}>
            Lançar
          </Button>
        ) : null}
      </div>
    </header>
  )
}
