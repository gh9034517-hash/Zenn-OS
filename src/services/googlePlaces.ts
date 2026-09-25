// ============================================================
// Google Places API (New) — Text Search
// https://developers.google.com/maps/documentation/places/web-service/text-search
//
// Com GOOGLE_MAPS_API_KEY configurada a busca é REAL.
// Sem a chave, resultados DEMO (fictícios) são gerados e marcados
// com source: 'demo' — a interface exibe "DEMO MODE".
// ============================================================

import type { PlaceResult, SearchParams } from '@/types'
import { env, integrations } from '@/lib/env'
import { hashString, seededRandom } from '@/utils/id'
import { DEMO_STREETS, slug } from '@/data/demo'

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.rating',
  'places.userRatingCount',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.primaryTypeDisplayName',
  'nextPageToken',
].join(',')

export interface PlacesSearchResponse {
  mode: 'live' | 'demo'
  /** Fonte dos dados quando ao vivo: Google (pago) ou OpenStreetMap (grátis). */
  source?: 'google' | 'osm' | 'demo'
  results: PlaceResult[]
  query: SearchParams
  fetchedAt: string
}

export const isGooglePlacesConfigured = () => integrations.googlePlaces

interface GoogleAddressComponent {
  longText: string
  types: string[]
}

interface GooglePlace {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  addressComponents?: GoogleAddressComponent[]
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  rating?: number
  userRatingCount?: number
  websiteUri?: string
  googleMapsUri?: string
  primaryTypeDisplayName?: { text: string }
}

async function placesRequest(body: Record<string, unknown>, fieldMask: string) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.googleMapsApiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const err = await res.json()
      detail = err?.error?.message ?? detail
    } catch {
      /* resposta sem JSON */
    }
    throw new Error(`Google Places: ${detail} (HTTP ${res.status})`)
  }
  return res.json() as Promise<{ places?: GooglePlace[]; nextPageToken?: string }>
}

/** Localiza o centro da cidade para aplicar o raio como locationBias. */
async function geocodeCity(city: string) {
  const data = (await placesRequest(
    { textQuery: city, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 1 },
    'places.location',
  )) as { places?: Array<{ location?: { latitude: number; longitude: number } }> }
  return data.places?.[0]?.location ?? null
}

function mapPlace(p: GooglePlace, fallbackCity: string, niche: string): PlaceResult {
  const cityComponent = p.addressComponents?.find(
    (c) => c.types.includes('administrative_area_level_2') || c.types.includes('locality'),
  )
  return {
    placeId: p.id,
    name: p.displayName?.text ?? 'Sem nome',
    category: p.primaryTypeDisplayName?.text ?? niche,
    address: p.formattedAddress ?? '',
    city: cityComponent?.longText ?? fallbackCity,
    phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
    rating: typeof p.rating === 'number' ? p.rating : null,
    reviewsCount: p.userRatingCount ?? 0,
    website: p.websiteUri?.trim() ? p.websiteUri : null,
    googleMapsUrl: p.googleMapsUri ?? null,
    facebook: null,
    instagram: null,
    source: 'google_places',
  }
}

async function searchLive(params: SearchParams): Promise<PlaceResult[]> {
  const center = await geocodeCity(params.city)
  const radius = Math.min(Math.max(params.radiusKm, 1), 50) * 1000
  const baseBody: Record<string, unknown> = {
    textQuery: `${params.niche} em ${params.city}`,
    languageCode: 'pt-BR',
    regionCode: 'BR',
    pageSize: 20,
  }
  if (center) baseBody.locationBias = { circle: { center, radius } }

  const results: PlaceResult[] = []
  let pageToken: string | undefined
  // A API retorna no máximo 3 páginas (60 resultados).
  for (let page = 0; page < 3; page++) {
    const data = await placesRequest(pageToken ? { ...baseBody, pageToken } : baseBody, FIELD_MASK)
    results.push(...(data.places ?? []).map((p) => mapPlace(p, params.city, params.niche)))
    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }
  return results
}

// ------------------------------------------------------------
// DEMO
// ------------------------------------------------------------
const DEMO_SUFFIXES = [
  'Central', 'do Bairro', 'Premium', 'Express', 'da Praça', 'Família', 'Artesanal', 'Prime',
  'Nova Era', 'Tradição', 'Top', 'Master', 'da Vila', 'Real', 'Imperial', 'Primavera',
  'Estação', 'Ponto Certo', 'Bom Gosto', 'Villa', 'Mix', 'Point', 'Clássica', 'Moderna',
  'Aurora', 'Horizonte', 'Jardim', 'Paulista', 'Brasil', 'Dom Pedro', 'Bela Vista', 'Da Esquina',
  'Gourmet', 'Império', 'São José', 'Santa Rita', 'Vitória', 'Esperança', 'Boa Vista', 'Norte',
]
const DEMO_NEIGHBORHOODS = ['Cambuí', 'Centro', 'Taquaral', 'Barão Geraldo', 'Guanabara', 'Castelo', 'Botafogo', 'Nova Campinas', 'Jardim Proença', 'Vila Industrial']

function singular(niche: string) {
  return niche
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 4 && /s$/i.test(w) ? w.slice(0, -1) : w))
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w.toLowerCase()))
    .join(' ')
}

export function generateDemoPlaces(params: SearchParams): PlaceResult[] {
  const rand = seededRandom(hashString(`${params.niche}|${params.city}|${params.radiusKm}`.toLowerCase()))
  const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min
  const category = singular(params.niche || 'Empresa')
  const city = params.city.trim() || 'Campinas'
  const count = Math.min(40, Math.max(10, Math.round(12 + params.radiusKm * 1.1)))
  const suffixes = [...DEMO_SUFFIXES].sort(() => rand() - 0.5)
  const ddd = city.toLowerCase().includes('paulo') ? '11' : '19'

  return Array.from({ length: count }, (_, i) => {
    const suffix = suffixes[i % suffixes.length]
    const name = `${category} ${suffix}`
    const s = slug(`${name}${city}`)
    // ~60% sem site para exercitar o filtro SEM SITE
    const hasSite = rand() > 0.6
    return {
      placeId: `demo_${s}_${i}`,
      name,
      category,
      address: `${DEMO_STREETS[int(0, DEMO_STREETS.length - 1)]}, ${int(20, 3200)} — ${DEMO_NEIGHBORHOODS[int(0, DEMO_NEIGHBORHOODS.length - 1)]}`,
      city,
      phone: rand() > 0.15 ? `(${ddd}) 9${int(8000, 9999)}-${int(1000, 9999)}` : null,
      rating: rand() > 0.05 ? Math.round((3.2 + rand() * 1.8) * 10) / 10 : null,
      reviewsCount: int(0, 1800),
      website: hasSite ? `https://www.${slug(name)}.com.br` : null,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${city}`)}`,
      facebook: rand() > 0.55 ? `https://facebook.com/${slug(name)}` : null,
      instagram: rand() > 0.35 ? `@${slug(name)}` : null,
      source: 'demo' as const,
    }
  })
}

/**
 * Busca via Edge Function do Supabase (proxy oficial do Google).
 * A chave do Google fica no servidor; o navegador nunca a vê.
 * Retorna null quando o Supabase não está configurado (usa caminho local).
 */
async function searchViaEdge(params: SearchParams): Promise<PlacesSearchResponse | null> {
  if (!integrations.supabase) return null
  const { getSupabase } = await import('@/lib/supabase')
  const sb = getSupabase()
  if (!sb) return null
  const { data: sessionData } = await sb.auth.getSession()
  const token = sessionData.session?.access_token ?? env.supabaseAnonKey
  const res = await fetch(`${env.supabaseUrl}/functions/v1/places-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error ?? `Edge function (HTTP ${res.status})`)
  const fetchedAt = new Date().toISOString()
  // A função responde "demo" só se nenhuma fonte real estiver disponível.
  if (body.mode !== 'live') {
    return { mode: 'demo', source: 'demo', results: generateDemoPlaces(params), query: params, fetchedAt }
  }
  return {
    mode: 'live',
    source: body.source === 'google' ? 'google' : 'osm',
    results: body.results as PlaceResult[],
    query: params,
    fetchedAt,
  }
}

/** Busca leads — real quando há chave configurada, DEMO caso contrário. */
export async function searchPlaces(params: SearchParams): Promise<PlacesSearchResponse> {
  const fetchedAt = new Date().toISOString()
  // 1) Modo Supabase (deploy): usa a Edge Function.
  const viaEdge = await searchViaEdge(params)
  if (viaEdge) return viaEdge
  // 2) Modo local com chave de build configurada.
  if (isGooglePlacesConfigured()) {
    return { mode: 'live', results: await searchLive(params), query: params, fetchedAt }
  }
  // 3) DEMO.
  return { mode: 'demo', results: generateDemoPlaces(params), query: params, fetchedAt }
}

/** Considera "sem site" quando website é vazio, null ou undefined. */
export const hasNoWebsite = (website: string | null | undefined) => !website || !website.trim()
