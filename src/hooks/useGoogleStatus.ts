import { useCallback, useEffect, useState } from 'react'
import { isGoogleKeyConfigured } from '@/services/appSettings'
import { isGooglePlacesConfigured } from '@/services/googlePlaces'

/** Indica se a busca real do Google está disponível (chave no servidor ou build). */
export function useGoogleStatus() {
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    isGoogleKeyConfigured()
      .then((k) => setConfigured(k || isGooglePlacesConfigured()))
      .catch(() => setConfigured(isGooglePlacesConfigured()))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { configured, loading, refresh }
}
