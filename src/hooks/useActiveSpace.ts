import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { NAVIGATION, SYSTEM_NAV, TOOLS_NAV, spaceNavigation, type NavGroup } from '@/data/navigation'
import { useAccess } from '@/context/AccessContext'
import { useSpaces } from '@/context/SpacesContext'
import type { Space } from '@/types'

const LAST = 'zenn-os:last-space'

/** 'zenn' (Zenn Works), 'geral' (visão geral) ou o id de um espaço. */
export type SpaceKey = string

function readLast(): SpaceKey {
  try {
    return localStorage.getItem(LAST) || 'zenn'
  } catch {
    return 'zenn'
  }
}

/** Páginas que valem para todos os espaços: o menu continua no último usado. */
const SHARED = ['/configuracoes', '/calculadoras', '/personalizar']

/** Espaço em uso, pela URL. Páginas compartilhadas mantêm o último. */
export function useActiveSpace(): { key: SpaceKey; space: Space | undefined; groups: NavGroup[] } {
  const { pathname } = useLocation()
  const { spaceById } = useSpaces()
  const { isAdmin } = useAccess()
  const match = pathname.match(/^\/e\/([^/]+)/)
  const fromUrl: SpaceKey | null = match
    ? decodeURIComponent(match[1])
    : pathname === '/geral'
      ? 'geral'
      : SHARED.some((p) => pathname.startsWith(p))
        ? null
        : 'zenn'

  useEffect(() => {
    if (!fromUrl) return
    try {
      localStorage.setItem(LAST, fromUrl)
    } catch {
      /* armazenamento indisponível */
    }
  }, [fromUrl])

  let key = fromUrl ?? readLast()
  // Contas de clientes não têm a Zenn Works.
  if (key === 'zenn' && !isAdmin) key = 'geral'
  const space = key === 'zenn' || key === 'geral' ? undefined : spaceById(key)
  // Espaço apagado: volta para o início.
  if (key !== 'zenn' && key !== 'geral' && !space && !fromUrl) key = isAdmin ? 'zenn' : 'geral'

  const groups =
    key === 'zenn'
      ? [...NAVIGATION, TOOLS_NAV, SYSTEM_NAV]
      : space
        ? [...spaceNavigation(space.id, space.kind), TOOLS_NAV, SYSTEM_NAV]
        : [TOOLS_NAV, SYSTEM_NAV]
  return { key, space, groups }
}

/** Rota inicial de cada espaço. */
export const spaceHome = (key: SpaceKey) => (key === 'zenn' ? '/' : key === 'geral' ? '/geral' : `/e/${key}`)
