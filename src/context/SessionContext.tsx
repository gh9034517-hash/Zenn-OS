// Sessão do operador.
// Modo "local": perfil salvo no navegador (sem autenticação real — indicado na UI).
// Modo "supabase": autenticação real via Supabase Auth (e-mail + senha).

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@/types'
import { getSupabase } from '@/lib/supabase'
import { integrations } from '@/lib/env'

const KEY = 'zenn-os:session'
const ONBOARDED = 'zenn-os:onboarded'
/** Marca para a tela de entrada explicar por que voltou para ela. */
export const EXPIRED_FLAG = 'zenn-os:session-expired'

interface SessionContextValue {
  session: Session | null
  onboarded: boolean
  completeOnboarding: () => void
  signInLocal: (name: string, email: string) => void
  signInSupabase: (email: string, password: string) => Promise<void>
  /** cria a conta; devolve true quando precisa confirmar o e-mail antes de entrar */
  signUpSupabase: (name: string, email: string, password: string) => Promise<boolean>
  updateProfile: (patch: Partial<Pick<Session, 'name' | 'email'>>) => void
  /** Troca a senha do usuário logado (somente modo Supabase). */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

/** As mensagens do Supabase Auth vêm em inglês: traduz as comuns. */
function authError(e: { message?: string } | null | undefined): Error {
  const m = e?.message ?? ''
  if (/invalid login credentials/i.test(m)) return new Error('E-mail ou senha não conferem.')
  if (/email not confirmed/i.test(m)) return new Error('Confirme seu e-mail pelo link que enviamos e tente de novo.')
  if (/already registered|already been registered/i.test(m)) return new Error('Esse e-mail já tem conta. Use “Entrar”.')
  if (/signups? not allowed|signup is disabled/i.test(m)) return new Error('O cadastro está fechado. Peça ao administrador para liberar.')
  if (/password should be at least/i.test(m)) return new Error('A senha precisa ter pelo menos 8 caracteres.')
  if (/rate limit|too many/i.test(m)) return new Error('Muitas tentativas seguidas. Espere um minuto e tente de novo.')
  if (/invalid email|unable to validate email/i.test(m)) return new Error('Esse e-mail não parece certo.')
  if (/failed to fetch|network/i.test(m)) return new Error('Sem conexão com o servidor. Confira a internet.')
  return new Error(m || 'Não deu para entrar agora. Tente de novo.')
}

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

  // Login real: se o Supabase perder a sessão (expirou, foi encerrada em
  // outro aparelho, senha trocada), volta para a tela de entrada em vez de
  // mostrar o sistema vazio como se fosse um visitante.
  useEffect(() => {
    if (!integrations.supabase) return
    const sb = getSupabase()
    if (!sb) return
    const expire = () => {
      if (readSession()?.mode !== 'supabase') return
      try {
        sessionStorage.setItem(EXPIRED_FLAG, '1')
      } catch {
        /* armazenamento indisponível */
      }
      persist(null)
    }
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !s)) expire()
    })
    return () => data.subscription.unsubscribe()
  }, [persist])

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
      if (error) throw authError(error)
      persist({
        name: (data.user.user_metadata?.name as string) || email.split('@')[0],
        email,
        mode: 'supabase',
        startedAt: new Date().toISOString(),
      })
    },
    signUpSupabase: async (name, email, password) => {
      const sb = getSupabase()
      if (!sb || !integrations.supabase) throw new Error('Supabase não configurado.')
      if (password.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.')
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name: name.trim() } } })
      if (error) throw authError(error)
      // E-mail já cadastrado: o Supabase devolve um usuário sem identidades.
      if (data.user && data.user.identities?.length === 0) throw new Error('Esse e-mail já tem conta. Use “Entrar”.')
      if (!data.session) return true
      persist({ name: name.trim() || email.split('@')[0], email, mode: 'supabase', startedAt: new Date().toISOString() })
      return false
    },
    updateProfile: (patch) => session && persist({ ...session, ...patch }),
    changePassword: async (currentPassword, newPassword) => {
      const sb = getSupabase()
      if (!sb || !integrations.supabase) {
        throw new Error('Troca de senha disponível apenas no modo Supabase (login real).')
      }
      if (!session?.email) throw new Error('Nenhuma sessão ativa.')
      if (newPassword.length < 8) throw new Error('A nova senha precisa ter pelo menos 8 caracteres.')
      // Reconfere a senha atual antes de trocar: o Supabase permite atualizar
      // com a sessão já aberta, então sem esta checagem qualquer pessoa com o
      // aparelho desbloqueado trocaria a senha sem conhecer a antiga.
      const { error: checkError } = await sb.auth.signInWithPassword({
        email: session.email,
        password: currentPassword,
      })
      if (checkError) throw new Error('Senha atual incorreta.')
      const { error } = await sb.auth.updateUser({ password: newPassword })
      if (error) throw error
    },
    signOut: async () => {
      // Sair de propósito não é "sessão expirada".
      const local = { ...session }
      persist(null)
      if (local?.mode === 'supabase') await getSupabase()?.auth.signOut()
    },
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession deve ser usado dentro de <SessionProvider>')
  return ctx
}
