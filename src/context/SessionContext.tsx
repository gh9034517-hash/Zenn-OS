// Sessão do operador.
// Modo "local": perfil salvo no navegador (sem autenticação real — indicado na UI).
// Modo "supabase": autenticação real via Supabase Auth (e-mail + senha).

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { Session } from '@/types'
import { getSupabase } from '@/lib/supabase'
import { integrations } from '@/lib/env'

const KEY = 'zenn-os:session'
const ONBOARDED = 'zenn-os:onboarded'

interface SessionContextValue {
  session: Session | null
  onboarded: boolean
  completeOnboarding: () => void
  signInLocal: (name: string, email: string) => void
  signInSupabase: (email: string, password: string) => Promise<void>
  updateProfile: (patch: Partial<Pick<Session, 'name' | 'email'>>) => void
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession)
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(ONBOARDED) === '1')

  const persist = useCallback((s: Session | null) => {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
    setSession(s)
  }, [])

  const value: SessionContextValue = {
    session,
    onboarded,
    completeOnboarding: () => {
      localStorage.setItem(ONBOARDED, '1')
      setOnboarded(true)
    },
    signInLocal: (name, email) =>
      persist({ name: name.trim(), email: email.trim(), mode: 'local', startedAt: new Date().toISOString() }),
    signInSupabase: async (email, password) => {
      const sb = getSupabase()
      if (!sb || !integrations.supabase) throw new Error('Supabase não configurado.')
      const { data, error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw error
      persist({
        name: (data.user.user_metadata?.name as string) || email.split('@')[0],
        email,
        mode: 'supabase',
        startedAt: new Date().toISOString(),
      })
    },
    updateProfile: (patch) => session && persist({ ...session, ...patch }),
    signOut: async () => {
      if (session?.mode === 'supabase') await getSupabase()?.auth.signOut()
      persist(null)
    },
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession deve ser usado dentro de <SessionProvider>')
  return ctx
}
