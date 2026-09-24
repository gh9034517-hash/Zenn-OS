import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, integrations } from './env'

let client: SupabaseClient | null = null

/** Retorna o client do Supabase, ou null quando não configurado. */
export function getSupabase(): SupabaseClient | null {
  if (!integrations.supabase) return null
  if (!client) client = createClient(env.supabaseUrl, env.supabaseAnonKey)
  return client
}
