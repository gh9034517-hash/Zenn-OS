import { NavLink, useNavigate } from 'react-router-dom'
import { Building2, ChevronsLeft, Layers, LogOut, User, type LucideIcon } from 'lucide-react'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { useSession } from '@/context/SessionContext'
import { useData } from '@/context/DataContext'
import { useSpaces } from '@/context/SpacesContext'
import { useAccess } from '@/context/AccessContext'
import { usePrefs } from '@/context/PrefsContext'
import { useActiveSpace, spaceHome } from '@/hooks/useActiveSpace'
import { isEntryOverdue, localISO } from '@/services/spaceMath'
import { cn } from '@/utils/cn'
import type { Space } from '@/types'

export const spaceIcon = (space: Pick<Space, 'kind'>): LucideIcon => (space.kind === 'empresa' ? Building2 : User)

/** Contas vencidas ou vencendo hoje, por espaço. */
export function useDueCounts() {
  const { entries } = useSpaces()
  const today = localISO()
  const counts: Record<string, number> = {}
  for (const e of entries) {
    if (e.status === 'pendente' && !e.isTransfer && e.type === 'despesa' && (isEntryOverdue(e, today) || e.date === today)) {
      counts[e.spaceId] = (counts[e.spaceId] ?? 0) + 1
    }
  }
  return counts
}

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
  const { spaces, reminders } = useSpaces()
  const { key, groups } = useActiveSpace()
  const { isAdmin } = useAccess()
  const { prefs } = usePrefs()
  const navigate = useNavigate()
  const due = useDueCounts()
  const newLeads = leads.filter((l) => l.status === 'novo').length
  const isCollapsed = collapsed && !mobile
  const today = localISO()

  const switcher: { key: string; label: string; icon: LucideIcon | 'zenn'; badge?: number }[] = [
    { key: 'geral', label: 'Visão geral', icon: Layers },
    ...(isAdmin && !prefs.hideZenn ? [{ key: 'zenn', label: 'Zenn Works', icon: 'zenn' as const }] : []),
    ...spaces
      // Escondido em Personalizar (o que está aberto agora continua aparecendo).
      .filter((s) => !prefs.hiddenSpaces.includes(s.id) || s.id === key)
      .map((s) => ({ key: s.id, label: s.name, icon: spaceIcon(s), badge: due[s.id] })),
  ]

  const badgeFor = (to: string) => {
    if (to === '/leads') return newLeads
    const m = to.match(/^\/e\/([^/]+)\/(contas|lembretes)$/)
    if (!m) return 0
    if (m[2] === 'contas') return due[m[1]] ?? 0
    return reminders.filter((r) => r.spaceId === m[1] && !r.done && r.dueDate && r.dueDate <= today).length
  }

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-line bg-ink/95 backdrop-blur-xl transition-[width] duration-300 ease-out',
        isCollapsed ? 'w-[76px]' : 'w-[260px]',
      )}
    >
      <div
        className={cn('flex h-16 shrink-0 items-center border-b border-line', isCollapsed ? 'justify-center px-2' : 'justify-between px-5')}
      >
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

      {/* Espaços: Zenn Works, Pessoal, Trabalho... */}
      <div className={cn('shrink-0 border-b border-line', isCollapsed ? 'px-2 py-3' : 'px-3 py-3')}>
        {!isCollapsed && <p className="eyebrow mb-2 px-1 text-[9px] text-faint">Espaços</p>}
        <div className={cn('flex flex-col gap-1', isCollapsed && 'items-center gap-1.5')}>
          {switcher.map((item) => {
            const active = item.key === key
            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => {
                  navigate(spaceHome(item.key))
                  onNavigate?.()
                }}
                title={item.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-w-0 items-center gap-2.5 rounded-xl border text-left text-[13px] transition-all duration-200',
                  isCollapsed ? 'size-10 justify-center' : 'px-3 py-2',
                  active ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted hover:border-line-strong hover:text-fg',
                )}
              >
                {Icon === 'zenn' ? (
                  <LogoMark className={cn('size-4 shrink-0', active && 'invert')} />
                ) : (
                  <Icon className="size-4 shrink-0" strokeWidth={1.7} />
                )}
                {!isCollapsed && <span className="truncate">{item.label}</span>}
                {!!item.badge && (
                  <span
                    className={cn(
                      'grid min-w-4 place-items-center rounded-full px-1 font-mono text-[9px] leading-4',
                      isCollapsed ? 'absolute -top-1 -right-1' : 'ml-auto',
                      active ? 'bg-accent-ink text-accent' : 'bg-accent text-accent-ink',
                    )}
                    title="Contas vencidas ou vencendo hoje"
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            {isCollapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-line" />
            ) : (
              <p className="eyebrow mb-1.5 px-3 text-[9px] text-faint">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const badge = badgeFor(item.to)
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/' || /^\/e\/[^/]+$/.test(item.to)}
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
                            <span className="absolute top-1/2 left-0 h-5 w-[2px] -translate-y-1/2 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
                          )}
                          <item.icon className="size-[17px] shrink-0" strokeWidth={1.6} />
                          {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                          {!isCollapsed && badge > 0 && (
                            <span className="rounded-md border border-line px-1.5 font-mono text-[10px] text-fg-soft">{badge}</span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}
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
              <p className="truncate text-[11px] text-faint">Administrador</p>
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
