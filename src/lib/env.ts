// Leitura centralizada das variáveis de ambiente (ver .env.example).
// Nenhuma chave é embutida no código: sem variável => DEMO MODE.

const read = (key: string): string => {
  const value = (import.meta.env as Record<string, string | undefined>)[key]
  return typeof value === 'string' ? value.trim() : ''
}

export const env = {
  googleMapsApiKey: read('GOOGLE_MAPS_API_KEY'),
  supabaseUrl: read('SUPABASE_URL'),
  supabaseAnonKey: read('SUPABASE_ANON_KEY'),
  dataProvider: read('VITE_DATA_PROVIDER') || 'local',
  metaAppId: read('META_APP_ID'),
  metaAccessToken: read('META_ACCESS_TOKEN'),
  metaGraphVersion: read('META_GRAPH_VERSION') || 'v21.0',
}

export const integrations = {
  googlePlaces: Boolean(env.googleMapsApiKey),
  supabase: Boolean(env.supabaseUrl && env.supabaseAnonKey),
  meta: Boolean(env.metaAccessToken),
}

export const useSupabaseProvider = integrations.supabase && env.dataProvider === 'supabase'
