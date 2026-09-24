import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useSession } from '@/context/SessionContext'
import { useData } from '@/context/DataContext'
import { Mascot } from '@/components/brand/Mascot'

export function AppLayout() {
  const { session, onboarded } = useSession()
  const { loading, error } = useData()
  const [collapsed, setCollapsed] = useLocalStorage('zenn-os:sidebar-collapsed', false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setMobileOpen(false), [pathname])
  useEffect(() => window.scrollTo({ top: 0 }), [pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (!onboarded) return <Navigate to="/welcome" replace />
  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="min-h-dvh bg-void">
      {/* Sidebar desktop */}
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>

      {/* Menu mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 animate-[slide-in-left_0.35s_cubic-bezier(0.22,1,0.36,1)_both]">
            <Sidebar collapsed={false} mobile onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className={`transition-[padding] duration-300 ease-out ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-[260px]'}`}>
        <Topbar onOpenMenu={() => setMobileOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {loading ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
              <Mascot size={96} />
              <p className="eyebrow">Carregando dados</p>
            </div>
          ) : error ? (
            <div className="panel mx-auto max-w-lg p-6 text-sm">
              <p className="font-medium">Não foi possível carregar os dados.</p>
              <p className="mt-2 text-muted">{error}</p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
