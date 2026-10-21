import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { NAVIGATION, SYSTEM_NAV, spaceNavigation, type NavGroup } from '@/data/navigation'
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

/** Espaço em uso, pela URL. Configurações é de todos: mantém o último. */
export function useActiveSpace(): { key: SpaceKey; space: Space | undefined; groups: NavGroup[] } {
  const { pathname } = useLocation()
  const { spaceById } = useSpaces()
  const match = pathname.match(/^\/e\/([^/]+)/)
  const fromUrl: SpaceKey | null = match
    ? decodeURIComponent(match[1])
    : pathname === '/geral'
      ? 'geral'
      : pathname.startsWith('/configuracoes')
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
  const space = key === 'zenn' || key === 'geral' ? undefined : spaceById(key)
  // Espaço apagado: volta para a Zenn Works.
  if (key !== 'zenn' && key !== 'geral' && !space && !fromUrl) key = 'zenn'

  const groups =
    key === 'zenn'
      ? [...NAVIGATION, SYSTEM_NAV]
      : space
        ? [...spaceNavigation(space.id), SYSTEM_NAV]
        : [SYSTEM_NAV]
  return { key, space, groups }
}

/** Rota inicial de cada espaço. */
export const spaceHome = (key: SpaceKey) => (key === 'zenn' ? '/' : key === 'geral' ? '/geral' : `/e/${key}`)
