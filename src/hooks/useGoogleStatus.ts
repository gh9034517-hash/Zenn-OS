import { useCallback, useEffect, useState } from 'react'
import { isGoogleKeyConfigured } from '@/services/appSettings'
import { isGooglePlacesConfigured } from '@/services/googlePlaces'
import { integrations } from '@/lib/env'

/**
 * Indica se a busca REAL de leads está disponível.
 * - Modo Supabase: sempre (OpenStreetMap, grátis, via Edge Function).
 * - Modo local: apenas se houver GOOGLE_MAPS_API_KEY no build.
 * `google` diz se a fonte é o Google (chave configurada) — caso contrário é OSM.
 */
export function useGoogleStatus() {
  const [configured, setConfigured] = useState(integrations.supabase || isGooglePlacesConfigured())
  const [google, setGoogle] = useState(isGooglePlacesConfigured())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    isGoogleKeyConfigured()
      .then((hasKey) => {
        setGoogle(hasKey || isGooglePlacesConfigured())
        setConfigured(integrations.supabase || hasKey || isGooglePlacesConfigured())
      })
      .catch(() => {
        setConfigured(integrations.supabase || isGooglePlacesConfigured())
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { configured, google, loading, refresh }
}
