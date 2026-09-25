// Configurações persistidas (ex.: chave do Google Places).
// Em modo Supabase: tabela app_settings. Em modo local: localStorage.
import { getSupabase } from '@/lib/supabase'
import { integrations } from '@/lib/env'

const LOCAL_PREFIX = 'zenn-os:setting:'
export const GOOGLE_KEY = 'google_maps_api_key'

export async function getSetting(key: string): Promise<string | null> {
  const sb = getSupabase()
  if (integrations.supabase && sb) {
    const { data, error } = await sb.from('app_settings').select('value').eq('key', key).maybeSingle()
    if (error) return null
    return (data?.value ?? null) as string | null
  }
  try {
    return localStorage.getItem(LOCAL_PREFIX + key)
  } catch {
    return null
  }
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  const sb = getSupabase()
  if (integrations.supabase && sb) {
    if (value === null || value === '') {
      await sb.from('app_settings').delete().eq('key', key)
    } else {
      await sb.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() })
    }
    return
  }
  try {
    if (value === null || value === '') localStorage.removeItem(LOCAL_PREFIX + key)
    else localStorage.setItem(LOCAL_PREFIX + key, value)
  } catch {
    /* indisponível */
  }
}

/** True quando existe chave do Google configurada (real search disponível). */
export async function isGoogleKeyConfigured(): Promise<boolean> {
  const v = await getSetting(GOOGLE_KEY)
  return Boolean(v && v.trim())
}
