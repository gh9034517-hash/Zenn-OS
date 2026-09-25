import { Menu, Search, Plus } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { NAVIGATION } from '@/data/navigation'
import { DemoBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useData } from '@/context/DataContext'

export function Topbar({ onOpenMenu, onOpenSearch }: { onOpenMenu: () => void; onOpenSearch: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { hasDemoData } = useData()
  const current = NAVIGATION.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))).find((i) =>
    i.to === '/' ? pathname === '/' : pathname.startsWith(i.to),
  )
  const demoMode = hasDemoData

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-void/75 px-4 backdrop-blur-xl sm:px-6">
      <button
        onClick={onOpenMenu}
        className="rounded-lg p-2 text-muted transition hover:bg-white/5 hover:text-fg lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="hidden min-w-0 items-center gap-2 text-sm md:flex">
        <span className="eyebrow text-faint">{current?.group ?? 'Zenn OS'}</span>
        <span className="text-faint">/</span>
        <span className="truncate text-fg-soft">{current?.label ?? ''}</span>
      </div>

      <button
        onClick={onOpenSearch}
        className="group ml-auto flex h-9 w-full min-w-0 max-w-sm items-center gap-2.5 rounded-xl border border-line bg-ink px-3 text-sm text-faint transition hover:border-line-strong hover:text-muted md:w-80"
      >
        <Search className="size-4" />
        <span className="flex-1 truncate text-left">Buscar empresa, telefone, cidade…</span>
        <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </button>

      {demoMode && (
        <button onClick={() => navigate('/configuracoes')} className="hidden sm:block" title="Ver status das integrações">
          <DemoBadge label="Demo mode" />
        </button>
      )}

      <div className="hidden sm:block">
        <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />} onClick={() => navigate('/prospeccao')}>
          Prospectar
        </Button>
      </div>
    </header>
  )
}
