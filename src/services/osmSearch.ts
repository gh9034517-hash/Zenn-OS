// ============================================================
// Busca GRÁTIS de empresas via OpenStreetMap — direto no navegador.
//
// Por que no cliente e não numa Edge Function?
//   Os IPs de saída do Supabase (nuvem compartilhada) são bloqueados pelos
//   servidores Overpass públicos (HTTP 406 imediato / timeout). O navegador
//   do usuário usa um IP residencial, que não sofre esse bloqueio, e tanto
//   o Photon quanto o Overpass liberam CORS (Access-Control-Allow-Origin: *).
//
// Fluxo:
//   1) Geocodifica a cidade com Photon (komoot), baseado em OSM.
//   2) Consulta o Overpass por TAG de categoria (índice rápido) numa bbox.
//   3) Filtra por palavra-chave quando o nicho é subconjunto da categoria.
// ============================================================
import type { PlaceResult, SearchParams } from '@/types'

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

async function fetchT(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

interface Plan {
  selectors: string[]
  keywords: string[]
}

// Nicho (pt-BR) -> seletores de tag OSM + palavras-chave (filtro fino).
function osmPlan(niche: string): Plan {
  const n = norm(niche)
  const has = (...w: string[]) => w.some((x) => n.includes(x))
  if (has('pizzar', 'pizza')) return { selectors: ['["amenity"~"^(restaurant|fast_food)$"]'], keywords: ['pizza'] }
  if (has('hamburg', 'burger', 'lanchonete')) return { selectors: ['["amenity"~"^(fast_food|restaurant)$"]'], keywords: ['hamburg', 'burger', 'smash', 'lanche'] }
  if (has('restaurante', 'comida', 'buffet', 'churrasc', 'marmit')) return { selectors: ['["amenity"="restaurant"]'], keywords: [] }
  if (has('bar', 'boteco', 'pub', 'cervej')) return { selectors: ['["amenity"~"^(bar|pub)$"]'], keywords: [] }
  if (has('cafe', 'cafeteria', 'confeitaria')) return { selectors: ['["amenity"="cafe"]'], keywords: [] }
  if (has('padaria', 'panific')) return { selectors: ['["shop"="bakery"]'], keywords: [] }
  if (has('barbear', 'barber')) return { selectors: ['["shop"~"^(hairdresser|barber)$"]'], keywords: [] }
  if (has('salao', 'beleza', 'cabelei', 'estetica', 'manicure')) return { selectors: ['["shop"~"^(hairdresser|beauty)$"]', '["beauty"]'], keywords: [] }
  if (has('academia', 'fitness', 'crossfit', 'musculac')) return { selectors: ['["leisure"="fitness_centre"]', '["sport"="fitness"]'], keywords: [] }
  if (has('pet', 'veterin')) return { selectors: ['["shop"="pet"]', '["amenity"="veterinary"]'], keywords: [] }
  if (has('odont', 'dentist', 'dental')) return { selectors: ['["amenity"="dentist"]', '["healthcare"="dentist"]'], keywords: [] }
  if (has('clinica', 'medic', 'consultorio', 'saude')) return { selectors: ['["amenity"~"^(clinic|doctors)$"]', '["healthcare"~"clinic|doctor"]'], keywords: [] }
  if (has('farmacia', 'drogaria')) return { selectors: ['["amenity"="pharmacy"]'], keywords: [] }
  if (has('oficina', 'mecanic', 'autocenter', 'funilaria')) return { selectors: ['["shop"="car_repair"]'], keywords: [] }
  if (has('lavarapido', 'lava rapido', 'lava-jato')) return { selectors: ['["shop"="car_repair"]', '["amenity"="car_wash"]'], keywords: [] }
  if (has('mercado', 'supermerc', 'merceari', 'hortifr', 'adega')) return { selectors: ['["shop"~"^(supermarket|convenience|greengrocer)$"]'], keywords: [] }
  if (has('roupa', 'moda', 'boutique', 'vestuar')) return { selectors: ['["shop"~"^(clothes|boutique|fashion)$"]'], keywords: [] }
  if (has('otica', 'oculos')) return { selectors: ['["shop"="optician"]'], keywords: [] }
  if (has('tatuagem', 'tattoo', 'piercing')) return { selectors: ['["shop"="tattoo"]'], keywords: [] }
  if (has('escola', 'curso', 'ensino', 'idiomas')) return { selectors: ['["amenity"~"^(school|college|language_school)$"]'], keywords: [] }
  if (has('hotel', 'pousada', 'hostel', 'motel')) return { selectors: ['["tourism"~"^(hotel|guest_house|hostel|motel)$"]'], keywords: [] }
  if (has('imobiliar', 'imovel', 'corretor')) return { selectors: ['["office"="estate_agent"]', '["shop"="estate_agent"]'], keywords: [] }
  if (has('advocacia', 'advogad', 'juridic')) return { selectors: ['["office"="lawyer"]'], keywords: [] }
  if (has('contabil', 'contador')) return { selectors: ['["office"="accountant"]'], keywords: [] }
  if (has('sorvet', 'acai', 'gelateria')) return { selectors: ['["amenity"~"^(ice_cream|cafe)$"]', '["cuisine"~"ice_cream"]'], keywords: [] }
  if (has('floricultura', 'flores')) return { selectors: ['["shop"="florist"]'], keywords: [] }
  if (has('joalheria', 'joias', 'relojoaria')) return { selectors: ['["shop"~"^(jewelry|watches)$"]'], keywords: [] }
  // Sem categoria mapeada: usa o nome como filtro (best-effort).
  return { selectors: [], keywords: [norm(niche).split(/\s+/)[0]] }
}

interface OsmEl {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(city + ', Brasil')}&limit=1`
  const res = await fetchT(url, {}, 9000)
  if (!res.ok) return null
  const data = await res.json()
  const f = data?.features?.[0]
  if (!f?.geometry?.coordinates) return null
  const [lon, lat] = f.geometry.coordinates
  return { lat, lon }
}

function osmAddress(t: Record<string, string>, fallbackCity: string) {
  const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ')
  const parts = [street, t['addr:suburb'] || t['addr:neighbourhood']].filter(Boolean)
  return { address: parts.join(' - '), city: t['addr:city'] || fallbackCity }
}

/** Busca empresas reais (grátis) no OpenStreetMap. Lança erro se indisponível. */
export async function searchPlacesOSM(params: SearchParams): Promise<PlaceResult[]> {
  const { niche, city } = params
  const center = await geocodeCity(city)
  if (!center) throw new Error('Cidade não encontrada no mapa (OpenStreetMap).')

  const km = Math.min(Math.max(params.radiusKm || 10, 1), 50)
  const dLat = km / 111
  const dLon = km / (111 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.2))
  const bbox = `(${center.lat - dLat},${center.lon - dLon},${center.lat + dLat},${center.lon + dLon})`

  const plan = osmPlan(niche)
  const clauses = plan.selectors.length
    ? plan.selectors.map((s) => `nwr${s}${bbox};`)
    : [`nwr["name"~"${plan.keywords[0] || norm(niche)}",i]${bbox};`]
  const query = `[out:json][timeout:25];(${clauses.join('')});out center tags 300;`

  // Vários espelhos: se um estiver sobrecarregado/limitado, tenta o próximo.
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ]
  let data: { elements: OsmEl[] } | null = null
  let lastStatus = 0
  for (const ep of endpoints) {
    try {
      const res = await fetchT(
        ep,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query),
        },
        15000,
      )
      lastStatus = res.status
      if (res.ok) {
        data = (await res.json()) as { elements: OsmEl[] }
        break
      }
    } catch {
      /* timeout/erro: tenta o próximo espelho */
    }
  }
  if (!data) throw new Error(`Servidor de mapas indisponível no momento (HTTP ${lastStatus}). Tente de novo em instantes.`)

  const kws = plan.keywords.map(norm)
  const seen = new Set<string>()
  const results: PlaceResult[] = (data.elements ?? [])
    .filter((e) => e.tags?.name)
    .filter((e) => {
      if (!kws.length) return true
      const hay = norm(`${e.tags!.name} ${e.tags!.cuisine ?? ''}`)
      return kws.some((k) => hay.includes(k))
    })
    .filter((e) => {
      const k = norm(e.tags!.name)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .map((e) => {
      const t = e.tags!
      const addr = osmAddress(t, city)
      const website = t['website'] || t['contact:website'] || null
      const lat = e.lat ?? e.center?.lat
      const lon = e.lon ?? e.center?.lon
      return {
        placeId: `osm_${e.type}_${e.id}`,
        name: t.name,
        category: t.cuisine || t.shop || t.amenity || t.office || t.leisure || t.tourism || niche,
        address: addr.address,
        city: addr.city,
        phone: t['contact:phone'] || t['phone'] || null,
        rating: null,
        reviewsCount: 0,
        website: website && website.trim() ? website : null,
        googleMapsUrl:
          lat && lon
            ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.name + ' ' + addr.city)}`,
        facebook: t['contact:facebook'] || t['facebook'] || null,
        instagram: t['contact:instagram'] || t['instagram'] || null,
        source: 'osm' as const,
      }
    })

  // Prioriza quem NÃO tem site (foco da prospecção).
  results.sort((a, b) => Number(!!a.website) - Number(!!b.website))
  return results.slice(0, 80)
}
