import { NavLink } from 'react-router-dom'
import { ChevronsLeft, LogOut } from 'lucide-react'
import { NAVIGATION } from '@/data/navigation'
import { Logo } from '@/components/brand/Logo'
import { useSession } from '@/context/SessionContext'
import { useData } from '@/context/DataContext'
import { cn } from '@/utils/cn'

export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
  mobile,
}: {
  collapsed: boolean
  onToggle?: () => void
  onNavigate?: () => void
  mobile?: boolean
}) {
  const { session, signOut } = useSession()
  const { leads } = useData()
  const newLeads = leads.filter((l) => l.status === 'novo').length
  const isCollapsed = collapsed && !mobile

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-line bg-ink/95 backdrop-blur-xl transition-[width] duration-300 ease-out',
        isCollapsed ? 'w-[76px]' : 'w-[260px]',
      )}
    >
      <div className={cn('flex h-16 items-center border-b border-line', isCollapsed ? 'justify-center px-2' : 'justify-between px-5')}>
        <Logo collapsed={isCollapsed} />
        {!mobile && !isCollapsed && (
          <button
            onClick={onToggle}
            className="rounded-lg p-1.5 text-faint transition hover:bg-white/5 hover:text-fg"
            aria-label="Recolher menu"
            title="Recolher menu"
          >
            <ChevronsLeft className="size-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAVIGATION.map((group) => (
          <div key={group.label} className="mb-4">
            {isCollapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-line" />
            ) : (
              <p className="eyebrow mb-1.5 px-3 text-[9px] text-faint">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-xl py-2.5 text-[13.5px] transition-all duration-200',
                        isCollapsed ? 'justify-center px-2' : 'px-3',
                        isActive
                          ? 'bg-white/[0.07] text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                          : 'text-muted hover:bg-white/[0.035] hover:text-fg',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute top-1/2 left-0 h-5 w-[2px] -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
                        )}
                        <item.icon className="size-[17px] shrink-0" strokeWidth={1.6} />
                        {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                        {!isCollapsed && item.to === '/leads' && newLeads > 0 && (
                          <span className="rounded-md border border-line px-1.5 font-mono text-[10px] text-fg-soft">{newLeads}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn('border-t border-line p-3', isCollapsed && 'flex justify-center')}>
        {isCollapsed ? (
          <button
            onClick={onToggle}
            className="rounded-lg p-2 text-faint transition hover:bg-white/5 hover:text-fg"
            aria-label="Expandir menu"
            title="Expandir menu"
          >
            <ChevronsLeft className="size-4 rotate-180" />
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-white to-[#8a8a90] text-xs font-semibold text-black">
              {(session?.name || 'Z').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{session?.name}</p>
              <p className="truncate text-[11px] text-faint">{session?.mode === 'supabase' ? 'Supabase Auth' : 'Sessão local'}</p>
            </div>
            <button
              onClick={() => void signOut()}
              className="rounded-lg p-1.5 text-faint transition hover:bg-white/5 hover:text-fg"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
