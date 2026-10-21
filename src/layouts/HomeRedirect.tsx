import { Navigate } from 'react-router-dom'
import { usePrefs } from '@/context/PrefsContext'
import { useAccess } from '@/context/AccessContext'
import { useSpaces } from '@/context/SpacesContext'

/** /inicio: abre a página escolhida em Personalizar (se ela ainda existir). */
export function HomeRedirect() {
  const { prefs } = usePrefs()
  const { isAdmin, loading: accessLoading } = useAccess()
  const { spaceById, loading } = useSpaces()
  if (loading || accessLoading) return null
  const home = prefs.homePage
  const spaceId = home.match(/^\/e\/([^/]+)/)?.[1]
  const valid = home === '/geral' || (home === '/' && isAdmin) || (!!spaceId && !!spaceById(spaceId))
  return <Navigate to={valid ? home : '/geral'} replace />
}
