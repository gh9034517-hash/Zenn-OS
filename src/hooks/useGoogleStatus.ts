import { useCallback, useEffect, useState } from 'react'
import { isGoogleKeyConfigured } from '@/services/appSettings'
import { isGooglePlacesConfigured } from '@/services/googlePlaces'

/**
 * Indica se a busca REAL de leads está disponível.
 * A busca grátis via OpenStreetMap roda no navegador e está SEMPRE disponível,
 * então `configured` é sempre verdadeiro. `google` diz se a fonte preferida é
 * o Google Places (chave configurada) — caso contrário, OpenStreetMap.
 */
export function useGoogleStatus() {
  const configured = true
  const [google, setGoogle] = useState(isGooglePlacesConfigured())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    isGoogleKeyConfigured()
      .then((hasKey) => setGoogle(hasKey || isGooglePlacesConfigured()))
      .catch(() => setGoogle(isGooglePlacesConfigured()))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { configured, google, loading, refresh }
}
