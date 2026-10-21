// Quem está usando e o que pode fazer.
// Administrador (tabela app_members): vê e altera tudo, inclusive a Zenn Works.
// Outras contas (clientes, família): só os espaços liberados para elas —
// "editor" lança e edita, "leitor" só vê. O banco garante isso (RLS);
// aqui é só para a tela esconder o que a pessoa não pode usar.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSupabase } from '@/lib/supabase'
import { provider } from '@/services/database'

export type SpaceRole = 'editor' | 'leitor'

interface AccessValue {
  loading: boolean
  isAdmin: boolean
  /** papel em cada espaço liberado (contas que não são administradoras) */
  roles: Record<string, SpaceRole>
  canWrite: (spaceId: string) => boolean
  refresh: () => Promise<void>
}

const AccessContext = createContext<AccessValue | null>(null)

export function AccessProvider({ children }: { children: ReactNode }) {
  const local = provider.name === 'local'
  const [loading, setLoading] = useState(!local)
  const [isAdmin, setIsAdmin] = useState(local)
  const [roles, setRoles] = useState<Record<string, SpaceRole>>({})

  const refresh = useCallback(async () => {
    if (local) return
    const sb = getSupabase()
    if (!sb) return
    try {
      const { data } = await sb.auth.getSession()
      const uid = data.session?.user.id
      if (!uid) {
        setIsAdmin(false)
        setRoles({})
        return
      }
      const [admin, members] = await Promise.all([
        sb.from('app_members').select('user_id').eq('user_id', uid).maybeSingle(),
        sb.from('space_members').select('space_id, role').eq('user_id', uid),
      ])
      setIsAdmin(!!admin.data)
      setRoles(Object.fromEntries((members.data ?? []).map((m: { space_id: string; role: SpaceRole }) => [m.space_id, m.role])))
    } finally {
      setLoading(false)
    }
  }, [local])

  useEffect(() => {
    void refresh()
    if (local) return
    const sb = getSupabase()
    if (!sb) return
    const { data } = sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void refresh()
    })
    return () => data.subscription.unsubscribe()
  }, [refresh, local])

  const value = useMemo<AccessValue>(
    () => ({
      loading,
      isAdmin,
      roles,
      canWrite: (spaceId: string) => isAdmin || roles[spaceId] === 'editor',
      refresh,
    }),
    [loading, isAdmin, roles, refresh],
  )

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
}

export function useAccess() {
  const ctx = useContext(AccessContext)
  if (!ctx) throw new Error('useAccess deve ser usado dentro de <AccessProvider>')
  return ctx
}
