// ============================================================
// Google Places API (New) — Text Search
// https://developers.google.com/maps/documentation/places/web-service/text-search
//
// Busca de empresas. Nunca inventa dados: sem Google configurado, a busca
// usa o OpenStreetMap (real e gratuito); se nenhuma fonte responder, lança
// erro para a tela mostrar — em vez de preencher com empresas fictícias.
// ============================================================

import type { PlaceResult, SearchParams } from '@/types'
import { env, integrations } from '@/lib/env'

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
  mode: 'live'
  /** Fonte dos dados: Google (pago, opcional) ou OpenStreetMap (grátis). */
  source: 'google' | 'osm'
  results: PlaceResult[]
  query: SearchParams
  fetchedAt: string
  /** Cidade como o mapa entendeu (ex.: "São Paulo · São Paulo"). */
  resolvedCity?: string
  /** Aviso quando uma fonte falhou e outra real assumiu. */
  notice?: string
  /** 'city' = uma cidade digitada; 'region' = Brasil todo ou um estado. */
  scope?: 'city' | 'region'
  /** Quantos leads o usuário pediu. */
  target?: number
  /** Na busca por região: cidades que contribuíram. */
  cities?: string[]
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

/**
 * Google Places via Edge Function do Supabase (proxy). Só é usada quando há
 * chave do Google gravada em app_settings — a chave fica no servidor e o
 * navegador nunca a vê. Retorna null quando não há chave / Supabase.
 */
async function searchGoogleViaEdge(params: SearchParams): Promise<PlacesSearchResponse | null> {
  if (!integrations.supabase) return null
  const { isGoogleKeyConfigured } = await import('@/services/appSettings')
  if (!(await isGoogleKeyConfigured())) return null
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
  if (body.mode !== 'live') return null
  return {
    mode: 'live',
    source: 'google',
    results: body.results as PlaceResult[],
    query: params,
    fetchedAt,
  }
}

/**
 * Busca leads. Ordem de preferência:
 *   1) Google Places (chave de build) — desenvolvimento local com chave.
 *   2) Google Places via Edge (chave gravada em app_settings) — opcional.
 *   3) OpenStreetMap no navegador — grátis, é o padrão.
 * Se o Google falhar, o OpenStreetMap (também real) assume, com aviso.
 * Se tudo falhar, lança erro. NUNCA devolve dados fictícios.
 */
export async function searchPlaces(params: SearchParams, signal?: AbortSignal): Promise<PlacesSearchResponse> {
  const fetchedAt = new Date().toISOString()
  let notice: string | undefined

  try {
    if (isGooglePlacesConfigured()) {
      return { mode: 'live', source: 'google', results: await searchLive(params), query: params, fetchedAt }
    }
    const viaEdge = await searchGoogleViaEdge(params)
    if (viaEdge) return viaEdge
  } catch (e) {
    notice = `Google indisponível (${e instanceof Error ? e.message : 'erro'}). Usando OpenStreetMap.`
  }

  const { searchPlacesOSM } = await import('@/services/osmSearch')
  const r = await searchPlacesOSM(params, signal)
  return {
    mode: 'live',
    source: 'osm',
    results: r.results,
    query: params,
    fetchedAt: new Date().toISOString(),
    resolvedCity: r.resolvedCity,
    notice,
  }
}

/** Considera "sem site" quando website é vazio, null ou undefined. */
export const hasNoWebsite = (website: string | null | undefined) => !website || !website.trim()
