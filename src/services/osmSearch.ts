// ============================================================
// Busca de empresas REAIS via OpenStreetMap — direto no navegador.
//
// Por que no cliente e não numa Edge Function?
//   Os IPs de saída do Supabase são bloqueados pelos servidores Overpass
//   públicos (HTTP 406 imediato / timeout). O navegador do usuário usa um
//   IP residencial, e Photon, Nominatim e Overpass liberam CORS.
//
// Regra inegociável: esta busca NUNCA inventa dados. Se nenhuma fonte
// responder, ela lança um erro claro para a tela mostrar — em vez de
// preencher a lista com empresas fictícias.
//
// Fluxo:
//   1) Geocodifica a cidade (Photon; se falhar, Nominatim), só no Brasil.
//   2) Consulta o Overpass por TAG de categoria (índice rápido) numa bbox,
//      em vários servidores com disparo escalonado — fica a primeira
//      resposta válida.
//   3) Extrai e padroniza o telefone registrado no mapa.
// ============================================================
import type { PlaceResult, SearchParams } from '@/types'

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

async function fetchT(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  // Um sinal externo (ex.: outro servidor já respondeu) também cancela.
  const outer = opts.signal
  const onOuterAbort = () => ctrl.abort()
  outer?.addEventListener('abort', onOuterAbort)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
    outer?.removeEventListener('abort', onOuterAbort)
  }
}

// ---------- Nichos ----------
interface Plan {
  selectors: string[]
  /** Filtra: só entra quem tiver uma destas palavras no nome/cozinha. */
  keywords: string[]
  /** Prioriza (não filtra): quem tiver estas palavras no nome vem antes. */
  prefer?: string[]
}

// Nicho (pt-BR) -> seletores de tag OSM + filtro fino por palavra-chave.
export function osmPlan(niche: string): Plan {
  const n = norm(niche)
  const has = (...w: string[]) => w.some((x) => n.includes(x))
  if (has('pizzar', 'pizza')) return { selectors: ['["amenity"~"^(restaurant|fast_food)$"]', '["cuisine"~"pizza"]'], keywords: ['pizza'] }
  if (has('hamburg', 'burger')) return { selectors: ['["amenity"~"^(fast_food|restaurant)$"]'], keywords: ['hamburg', 'burger', 'smash', 'lanche'] }
  if (has('lanchonete', 'lanche')) return { selectors: ['["amenity"="fast_food"]'], keywords: [] }
  if (has('restaurante', 'comida', 'buffet', 'churrasc', 'marmit')) return { selectors: ['["amenity"="restaurant"]'], keywords: [] }
  if (has('barbear', 'barber')) return { selectors: ['["shop"~"^(hairdresser|barber)$"]'], keywords: [], prefer: ['barb'] }
  if (has('salao', 'saloes', 'beleza', 'cabelei', 'estetica', 'manicure', 'unha')) return { selectors: ['["shop"~"^(hairdresser|beauty|cosmetics)$"]', '["beauty"]'], keywords: [], prefer: ['salao', 'beleza', 'studio', 'espaco'] }
  if (has('academia', 'fitness', 'crossfit', 'musculac', 'pilates')) return { selectors: ['["leisure"~"^(fitness_centre|sports_centre)$"]', '["sport"~"fitness|crossfit|pilates"]', '["amenity"="gym"]'], keywords: [], prefer: ['academia', 'fitness', 'crossfit', 'gym'] }
  if (has('bar', 'boteco', 'pub', 'cervej')) return { selectors: ['["amenity"~"^(bar|pub|biergarten)$"]'], keywords: [] }
  if (has('cafe', 'cafeteria', 'confeitaria', 'doceria')) return { selectors: ['["amenity"="cafe"]', '["shop"~"^(confectionery|pastry)$"]'], keywords: [] }
  if (has('padaria', 'panific')) return { selectors: ['["shop"~"^(bakery|pastry)$"]'], keywords: [] }
  if (has('pet', 'veterin')) return { selectors: ['["shop"="pet"]', '["amenity"="veterinary"]'], keywords: [] }
  if (has('odont', 'dentist', 'dental')) return { selectors: ['["amenity"="dentist"]', '["healthcare"="dentist"]'], keywords: [] }
  if (has('clinica', 'medic', 'consultorio', 'saude')) return { selectors: ['["amenity"~"^(clinic|doctors)$"]', '["healthcare"~"^(clinic|doctor|physiotherapist)$"]'], keywords: [] }
  if (has('farmacia', 'drogaria')) return { selectors: ['["amenity"="pharmacy"]'], keywords: [] }
  if (has('oficina', 'mecanic', 'autocenter', 'funilaria', 'auto pecas', 'autopecas')) return { selectors: ['["shop"~"^(car_repair|tyres|car_parts)$"]'], keywords: [] }
  if (has('lavarapido', 'lava rapido', 'lava-jato', 'lava jato', 'estetica automotiva')) return { selectors: ['["amenity"="car_wash"]'], keywords: [] }
  if (has('mercado', 'supermerc', 'merceari', 'hortifr', 'adega', 'emporio')) return { selectors: ['["shop"~"^(supermarket|convenience|greengrocer|alcohol|deli)$"]'], keywords: [] }
  if (has('roupa', 'moda', 'boutique', 'vestuar', 'calcado', 'sapat')) return { selectors: ['["shop"~"^(clothes|boutique|fashion|shoes)$"]'], keywords: [] }
  if (has('otica', 'oculos')) return { selectors: ['["shop"="optician"]'], keywords: [] }
  if (has('tatuagem', 'tattoo', 'piercing')) return { selectors: ['["shop"="tattoo"]'], keywords: [] }
  if (has('escola', 'curso', 'ensino', 'idiomas')) return { selectors: ['["amenity"~"^(school|college|language_school|driving_school)$"]'], keywords: [] }
  if (has('hotel', 'pousada', 'hostel', 'motel')) return { selectors: ['["tourism"~"^(hotel|guest_house|hostel|motel)$"]'], keywords: [] }
  if (has('imobiliar', 'imovel', 'corretor')) return { selectors: ['["office"="estate_agent"]', '["shop"="estate_agent"]'], keywords: [] }
  if (has('advocacia', 'advogad', 'juridic')) return { selectors: ['["office"="lawyer"]'], keywords: [] }
  if (has('contabil', 'contador')) return { selectors: ['["office"="accountant"]'], keywords: [] }
  if (has('sorvet', 'acai', 'gelateria')) return { selectors: ['["amenity"="ice_cream"]', '["shop"="ice_cream"]', '["cuisine"~"ice_cream|acai"]'], keywords: [] }
  if (has('floricultura', 'flores')) return { selectors: ['["shop"="florist"]'], keywords: [] }
  if (has('joalheria', 'joias', 'relojoaria')) return { selectors: ['["shop"~"^(jewelry|watches)$"]'], keywords: [] }
  if (has('material de construcao', 'construcao', 'ferragem', 'ferragens')) return { selectors: ['["shop"~"^(hardware|doityourself|building_materials)$"]'], keywords: [] }
  if (has('papelaria', 'grafica')) return { selectors: ['["shop"~"^(stationery|copyshop)$"]', '["craft"="printer"]'], keywords: [] }
  // Sem categoria mapeada: usa o nome como filtro (best-effort).
  return { selectors: [], keywords: [norm(niche).split(/\s+/)[0]] }
}

// ---------- Telefone ----------
// Onde o telefone pode estar num ponto do OpenStreetMap, em ordem de confiança.
const PHONE_KEYS = ['contact:phone', 'phone', 'contact:mobile', 'mobile', 'phone:mobile', 'contact:whatsapp', 'whatsapp']

/**
 * Padroniza um telefone brasileiro: "+55 11 98929-8569" -> "(11) 98929-8569".
 * Devolve null se não parecer um telefone válido — melhor sem número do que
 * com número errado.
 */
export function formatPhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  let d = trimmed.replace(/\D/g, '')
  if (!d) return null
  // 0800 / 0300 / 4004: números nacionais, sem DDD.
  if (/^0?(800|300|303|500|900)\d{7}$/.test(d)) {
    d = d.replace(/^0/, '')
    return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
  }
  if (/^(4003|4004|4020|4062)\d{4}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4)}`
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2)
  d = d.replace(/^0+/, '') // prefixo de discagem antigo (011...)
  // DDD válido: 11–99, sem zero no segundo dígito.
  if (!/^[1-9][1-9]/.test(d)) return null
  // Celular: 11 dígitos com 9 na frente. Fixo: 10 dígitos começando em 2–5.
  if (d.length === 11 && d[2] === '9') return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10 && /[2-5]/.test(d[2])) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  // Sem DDD ou formato estranho: melhor não exibir do que exibir errado.
  return null
}

export function pickPhone(tags: Record<string, string>): string | null {
  for (const k of PHONE_KEYS) {
    const v = tags[k]
    if (!v) continue
    // Vários números separados por ";" — o primeiro é o principal.
    for (const part of v.split(/[;,/]| ou /)) {
      const f = formatPhoneBR(part)
      if (f) return f
    }
  }
  return null
}

function pickWebsite(t: Record<string, string>): string | null {
  const w = t['website'] || t['contact:website'] || t['url'] || null
  return w && w.trim() ? w.trim() : null
}

function pickInstagram(t: Record<string, string>): string | null {
  const v = t['contact:instagram'] || t['instagram'] || null
  return v && v.trim() ? v.trim() : null
}

// ---------- Geocodificação ----------
export interface GeoPoint {
  lat: number
  lon: number
  label: string
}

// Caixa aproximada do Brasil (lon mín, lat mín, lon máx, lat máx).
const BR_BBOX = '-74.1,-33.9,-34.7,5.4'

async function geocodePhoton(city: string, signal?: AbortSignal): Promise<GeoPoint | null> {
  const params = new URLSearchParams({ q: city, limit: '1', bbox: BR_BBOX })
  // Só lugares povoados: evita "São Paulo" virar o estado ou uma rua.
  for (const tag of ['place:city', 'place:town', 'place:village', 'place:municipality']) params.append('osm_tag', tag)
  const res = await fetchT(`https://photon.komoot.io/api/?${params}`, { signal }, 9000)
  if (!res.ok) throw new Error(`Photon HTTP ${res.status}`)
  const data = await res.json()
  const f = data?.features?.[0]
  if (!f?.geometry?.coordinates) return null
  const [lon, lat] = f.geometry.coordinates
  const p = f.properties ?? {}
  // "São Paulo · São Paulo" é redundante: só mostra o estado quando difere.
  const label = p.state && p.state !== p.name ? `${p.name} · ${p.state}` : p.name
  return { lat, lon, label: label || city }
}

async function geocodeNominatim(city: string, signal?: AbortSignal): Promise<GeoPoint | null> {
  const params = new URLSearchParams({
    city,
    countrycodes: 'br',
    format: 'jsonv2',
    limit: '1',
    'accept-language': 'pt-BR',
  })
  const res = await fetchT(`https://nominatim.openstreetmap.org/search?${params}`, { signal }, 9000)
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
  const [f] = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>
  if (!f) return null
  return { lat: Number(f.lat), lon: Number(f.lon), label: (f.display_name ?? city).split(',').slice(0, 2).join(' ·') }
}

export async function geocodeCity(city: string, signal?: AbortSignal): Promise<GeoPoint | null> {
  const errors: string[] = []
  for (const fn of [geocodePhoton, geocodeNominatim]) {
    try {
      const p = await fn(city, signal)
      if (p) return p
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }
  if (errors.length === 2) throw new Error(`Não foi possível localizar a cidade agora (${errors.join('; ')}).`)
  return null
}

// ---------- Overpass ----------
interface OsmEl {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

/** Espera entre disparos: o próximo servidor entra se o anterior demorar. */
const STAGGER_MS = 6000
/** Tempo máximo por tentativa. */
const PER_ENDPOINT_MS = 30000
/** 429 / 502 / 503 / 504 = "espere um pouco": costuma liberar em segundos. */
const RETRY_BUSY_MS = 7000
const BUSY_STATUS = new Set([429, 502, 503, 504])

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/**
 * Consulta vários servidores Overpass com disparo escalonado e fica com a
 * primeira resposta válida. Um servidor que falha libera o próximo na hora;
 * um que só está lento ganha concorrência depois de STAGGER_MS. Um 429
 * ("muitas requisições") ou 5xx não é falha definitiva: o mesmo servidor é
 * tentado de novo uma vez, depois de RETRY_BUSY_MS.
 */
export function overpass(
  query: string,
  signal?: AbortSignal,
  opts: { perEndpointMs?: number } = {},
): Promise<{ elements: OsmEl[]; endpoint: string }> {
  const perEndpointMs = opts.perEndpointMs ?? PER_ENDPOINT_MS
  return new Promise((resolve, reject) => {
    const queue = [...OVERPASS_ENDPOINTS]
    const retried = new Set<string>()
    const ctrls: AbortController[] = []
    const timers: Array<ReturnType<typeof setTimeout>> = []
    const errors: string[] = []
    let inflight = 0
    let pendingRetries = 0
    let settled = false
    let stagger: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (stagger) clearTimeout(stagger)
      timers.forEach(clearTimeout)
      ctrls.forEach((c) => c.abort())
    }
    const fail = () => {
      if (settled || inflight > 0 || pendingRetries > 0 || queue.length > 0) return
      settled = true
      cleanup()
      reject(new Error(errors.join(' · ') || 'Nenhum servidor de mapas respondeu'))
    }
    signal?.addEventListener('abort', () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new DOMException('Busca cancelada', 'AbortError'))
    })

    const launchNext = () => {
      if (settled) return
      const ep = queue.shift()
      if (!ep) return fail()
      const host = new URL(ep).host
      const ctrl = new AbortController()
      ctrls.push(ctrl)
      inflight++
      if (stagger) clearTimeout(stagger)
      stagger = setTimeout(launchNext, STAGGER_MS)

      fetchT(ep, { method: 'POST', body: new URLSearchParams({ data: query }), signal: ctrl.signal }, perEndpointMs)
        .then(async (res) => {
          if (!res.ok) throw new HttpError(`${host}: HTTP ${res.status}`, res.status)
          const json = (await res.json()) as { elements?: OsmEl[]; remark?: string }
          // O Overpass pode responder 200 com erro de execução no "remark".
          if (json.remark && /error|timed out/i.test(json.remark)) throw new Error(`${host}: ${json.remark.slice(0, 80)}`)
          if (!Array.isArray(json.elements)) throw new Error(`${host}: resposta inválida`)
          if (settled) return
          settled = true
          cleanup()
          resolve({ elements: json.elements, endpoint: host })
        })
        .catch((e: unknown) => {
          inflight--
          if (settled) return
          // Servidor ocupado (429/5xx): tenta o mesmo de novo uma vez, em vez
          // de só esperar os reservas, que costumam estar mudos quando o
          // principal está sobrecarregado.
          if (e instanceof HttpError && BUSY_STATUS.has(e.status) && !retried.has(ep)) {
            retried.add(ep)
            pendingRetries++
            timers.push(
              setTimeout(() => {
                pendingRetries--
                queue.unshift(ep)
                launchNext()
              }, RETRY_BUSY_MS),
            )
          } else {
            const name = e instanceof Error ? e.name : ''
            errors.push(name === 'AbortError' ? `${host}: sem resposta` : e instanceof Error ? e.message : String(e))
          }
          if (queue.length) launchNext() // falhou: não espera o escalonamento
          else fail()
        })
    }

    launchNext()
  })
}

// ---------- Memória de buscas ----------
// Repetir uma busca recente não gasta requisição: menos chance de 429 e
// resposta instantânea. Guarda poucas buscas para não lotar o armazenamento.
const CACHE_PREFIX = 'zenn-os:osm-cache:v1:'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const CACHE_MAX = 8

function cacheKey(niche: string, city: string, km: number) {
  return `${CACHE_PREFIX}${norm(niche)}|${norm(city)}|${km}`
}

function readCache(key: string): OsmSearchResult | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { at, data } = JSON.parse(raw) as { at: number; data: OsmSearchResult }
    return Date.now() - at < CACHE_TTL_MS ? data : null
  } catch {
    return null
  }
}

function writeCache(key: string, data: OsmSearchResult) {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX) && k !== key)
    // Remove as mais antigas quando passa do limite.
    if (keys.length >= CACHE_MAX) {
      keys
        .map((k) => ({ k, at: (JSON.parse(localStorage.getItem(k) || '{}') as { at?: number }).at ?? 0 }))
        .sort((a, b) => a.at - b.at)
        .slice(0, keys.length - CACHE_MAX + 1)
        .forEach(({ k }) => localStorage.removeItem(k))
    }
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* sem armazenamento: segue sem memória */
  }
}

function osmAddress(t: Record<string, string>, fallbackCity: string) {
  const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ')
  const parts = [street, t['addr:suburb'] || t['addr:neighbourhood']].filter(Boolean)
  return { address: parts.join(' - '), city: t['addr:city'] || fallbackCity }
}

export interface OsmSearchResult {
  results: PlaceResult[]
  /** Cidade que o mapa entendeu (ex.: "Campinas · São Paulo"). */
  resolvedCity: string
  /** Servidor Overpass que respondeu. */
  endpoint: string
  /** Veio da memória local (busca repetida nas últimas horas). */
  cached?: boolean
}

/**
 * Busca empresas do nicho numa área quadrada ao redor de um ponto.
 * Sem filtro de telefone no servidor de propósito: o filtro por etiqueta não
 * usa índice no Overpass e estoura o tempo em cidade grande. Quem chama
 * filtra o telefone na resposta.
 */
async function searchArea(
  center: GeoPoint,
  km: number,
  niche: string,
  cityLabel: string,
  signal?: AbortSignal,
  perEndpointMs?: number,
): Promise<{ results: PlaceResult[]; endpoint: string }> {
  const dLat = km / 111
  const dLon = km / (111 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.2))
  const bbox = `(${(center.lat - dLat).toFixed(5)},${(center.lon - dLon).toFixed(5)},${(center.lat + dLat).toFixed(5)},${(center.lon + dLon).toFixed(5)})`

  const plan = osmPlan(niche)
  const kw = (plan.keywords[0] || norm(niche)).replace(/["\\]/g, '')
  const clauses = plan.selectors.length
    ? plan.selectors.map((s) => `nwr${s}["name"]${bbox};`)
    : [`nwr["name"~"${kw}",i]${bbox};`]
  const query = `[out:json][timeout:25];(${clauses.join('')});out center tags 500;`

  const { elements, endpoint } = await overpass(query, signal, { perEndpointMs })

  const kws = plan.keywords.map(norm)
  const prefer = (plan.prefer ?? []).map(norm)
  const seen = new Set<string>()
  const results: Array<PlaceResult & { _score: number }> = []

  for (const e of elements) {
    const t = e.tags
    if (!t?.name) continue
    const hay = norm(`${t.name} ${t.cuisine ?? ''}`)
    if (kws.length && !kws.some((k) => hay.includes(k))) continue
    // Mesmo nome no mesmo endereço = mesmo negócio mapeado duas vezes.
    const addr = osmAddress(t, cityLabel)
    const dedupe = `${norm(t.name)}|${norm(addr.address)}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)

    const tel = pickPhone(t)
    const website = pickWebsite(t)
    const preferred = prefer.length && prefer.some((k) => hay.includes(k)) ? 1 : 0

    results.push({
      placeId: `osm_${e.type}_${e.id}`,
      name: t.name,
      category: t.cuisine || t.shop || t.amenity || t.office || t.leisure || t.tourism || t.healthcare || niche,
      address: addr.address,
      city: addr.city,
      phone: tel,
      rating: null,
      reviewsCount: 0,
      website,
      // Busca pelo nome + endereço: abre a ficha oficial no Google Maps,
      // onde o dono confere/atualiza o telefone.
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [t.name, addr.address, addr.city].filter(Boolean).join(', '),
      )}`,
      facebook: t['contact:facebook'] || t['facebook'] || null,
      instagram: pickInstagram(t),
      source: 'osm',
      // Com telefone e sem site primeiro: são os leads mais acionáveis.
      _score: (tel ? 4 : 0) + (website ? 0 : 2) + preferred,
    })
  }

  results.sort((a, b) => b._score - a._score || a.name.localeCompare(b.name, 'pt-BR'))
  return { results: results.map(({ _score: _, ...r }) => r), endpoint }
}

/** Busca empresas reais numa cidade. Lança erro claro se não conseguir. */
export async function searchPlacesOSM(params: SearchParams, signal?: AbortSignal): Promise<OsmSearchResult> {
  const { niche, city } = params
  const km = Math.min(Math.max(params.radiusKm || 10, 1), 30)
  const key = cacheKey(niche, city, km)
  const cached = readCache(key)
  if (cached) return { ...cached, cached: true }

  const center = await geocodeCity(city, signal)
  if (!center) throw new Error(`Não encontramos a cidade "${city}" no mapa. Confira a grafia (ex.: "São Paulo", "Campinas").`)

  const { results, endpoint } = await searchArea(center, km, niche, city, signal)
  const out: OsmSearchResult = { results: results.slice(0, 150), resolvedCity: center.label || city, endpoint }
  // Só guarda busca que trouxe algo: uma resposta vazia pode ter sido azar.
  if (out.results.length) writeCache(key, out)
  return out
}

// ---------- Busca por região (Brasil todo / estado) ----------
export const UFS: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
  SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
}

/** Maiores cidades de cada estado, em ordem de tamanho. */
const CIDADES_POR_UF: Record<string, string[]> = {
  AC: ['Rio Branco', 'Cruzeiro do Sul'],
  AL: ['Maceió', 'Arapiraca'],
  AP: ['Macapá', 'Santana'],
  AM: ['Manaus', 'Parintins', 'Itacoatiara'],
  BA: ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Lauro de Freitas', 'Itabuna', 'Juazeiro', 'Ilhéus'],
  CE: ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral', 'Crato'],
  DF: ['Brasília', 'Taguatinga', 'Ceilândia'],
  ES: ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Cachoeiro de Itapemirim', 'Linhares'],
  GO: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia'],
  MA: ['São Luís', 'Imperatriz', 'São José de Ribamar', 'Timon', 'Caxias'],
  MT: ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop'],
  MS: ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá'],
  MG: ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Uberaba', 'Governador Valadares', 'Ipatinga'],
  PA: ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Castanhal'],
  PB: ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos'],
  PR: ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'São José dos Pinhais', 'Foz do Iguaçu'],
  PE: ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Petrolina', 'Paulista'],
  PI: ['Teresina', 'Parnaíba', 'Picos'],
  RJ: ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Campos dos Goytacazes', 'Petrópolis', 'Volta Redonda'],
  RN: ['Natal', 'Mossoró', 'Parnamirim'],
  RS: ['Porto Alegre', 'Caxias do Sul', 'Canoas', 'Pelotas', 'Santa Maria', 'Gravataí', 'Novo Hamburgo'],
  RO: ['Porto Velho', 'Ji-Paraná', 'Ariquemes'],
  RR: ['Boa Vista'],
  SC: ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Chapecó', 'Itajaí', 'Criciúma'],
  SP: ['São Paulo', 'Campinas', 'Guarulhos', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'São José dos Campos', 'Ribeirão Preto', 'Sorocaba', 'Santos', 'São José do Rio Preto', 'Jundiaí', 'Piracicaba', 'Bauru'],
  SE: ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto'],
  TO: ['Palmas', 'Araguaína', 'Gurupi'],
}

/**
 * Ordem do "Brasil todo": alterna regiões para os leads virem espalhados
 * pelo país, e não todos de São Paulo.
 */
const ORDEM_BRASIL: Array<[string, string]> = [
  ['São Paulo', 'SP'], ['Rio de Janeiro', 'RJ'], ['Belo Horizonte', 'MG'], ['Salvador', 'BA'],
  ['Brasília', 'DF'], ['Fortaleza', 'CE'], ['Curitiba', 'PR'], ['Recife', 'PE'], ['Porto Alegre', 'RS'],
  ['Manaus', 'AM'], ['Goiânia', 'GO'], ['Belém', 'PA'], ['Campinas', 'SP'], ['Florianópolis', 'SC'],
  ['Vitória', 'ES'], ['São Luís', 'MA'], ['Natal', 'RN'], ['João Pessoa', 'PB'], ['Maceió', 'AL'],
  ['Teresina', 'PI'], ['Campo Grande', 'MS'], ['Cuiabá', 'MT'], ['Aracaju', 'SE'], ['Uberlândia', 'MG'],
  ['Londrina', 'PR'], ['Joinville', 'SC'], ['Niterói', 'RJ'], ['Ribeirão Preto', 'SP'], ['Feira de Santana', 'BA'],
  ['Juiz de Fora', 'MG'], ['Caxias do Sul', 'RS'], ['Porto Velho', 'RO'], ['Palmas', 'TO'], ['Macapá', 'AP'],
  ['Boa Vista', 'RR'], ['Rio Branco', 'AC'], ['Santos', 'SP'], ['Maringá', 'PR'], ['Sorocaba', 'SP'],
  ['Campina Grande', 'PB'], ['Caruaru', 'PE'], ['Vila Velha', 'ES'], ['Blumenau', 'SC'], ['Anápolis', 'GO'],
]

export type Region = 'BR' | keyof typeof UFS

export function cidadesDaRegiao(region: Region): Array<{ city: string; uf: string }> {
  if (region === 'BR') return ORDEM_BRASIL.map(([city, uf]) => ({ city, uf }))
  return (CIDADES_POR_UF[region] ?? []).map((city) => ({ city, uf: region }))
}

export function nomeDaRegiao(region: Region): string {
  return region === 'BR' ? 'Brasil todo' : UFS[region] ?? region
}

// Preposição de cada estado: "na Bahia", "no Ceará", "em São Paulo".
const ARTIGO: Record<string, 'no' | 'na' | 'em'> = {
  AC: 'no', AL: 'em', AP: 'no', AM: 'no', BA: 'na', CE: 'no', DF: 'no', ES: 'no', GO: 'em',
  MA: 'no', MT: 'em', MS: 'em', MG: 'em', PA: 'no', PB: 'na', PR: 'no', PE: 'em', PI: 'no',
  RJ: 'no', RN: 'no', RS: 'no', RO: 'em', RR: 'em', SC: 'em', SP: 'em', SE: 'em', TO: 'no',
}

/** "no Brasil", "na Bahia", "em Minas Gerais". */
export function naRegiao(region: Region): string {
  if (region === 'BR') return 'no Brasil'
  return `${ARTIGO[region] ?? 'em'} ${UFS[region] ?? region}`
}

// Coordenadas de cidade não mudam: guarda para sempre e poupa requisições.
const GEO_PREFIX = 'zenn-os:geo:v1:'
async function geocodeCached(query: string, signal?: AbortSignal): Promise<GeoPoint | null> {
  try {
    const raw = localStorage.getItem(GEO_PREFIX + norm(query))
    if (raw) return JSON.parse(raw) as GeoPoint
  } catch {
    /* sem armazenamento */
  }
  const p = await geocodeCity(query, signal)
  if (p) {
    try {
      localStorage.setItem(GEO_PREFIX + norm(query), JSON.stringify(p))
    } catch {
      /* sem armazenamento */
    }
  }
  return p
}

export interface RegionSearchOptions {
  niche: string
  region: Region
  /** Quantos leads o usuário quer. */
  target: number
  requirePhone: boolean
  requireNoSite: boolean
  /** Chamado a cada cidade, já com os leads encontrados até agora. */
  onProgress?: (p: RegionProgress) => void
  signal?: AbortSignal
}

export interface RegionProgress {
  found: number
  target: number
  city: string
  done: number
  total: number
  /** Leads encontrados até agora — a tela mostra enquanto a busca segue. */
  partial: PlaceResult[]
}

export interface RegionSearchResult {
  results: PlaceResult[]
  /** Cidades que contribuíram com pelo menos um lead. */
  cities: string[]
  /** Cidades em que a busca falhou (servidor ocupado etc.). */
  failed: string[]
  /** Percorreu todas as cidades sem atingir a meta. */
  exhausted: boolean
  /** O usuário parou a busca e ficou com o que já tinha vindo. */
  stopped?: boolean
}

/** Tempo máximo de uma busca por região antes de entregar o que achou. */
const REGION_BUDGET_MS = 3 * 60 * 1000
/**
 * Cidades consultadas ao mesmo tempo. Uma: em teste real, consultas
 * seguidas em ritmo alto fazem o servidor público responder 504 por minutos.
 */
const REGION_CONCURRENCY = 1
/** Raio por cidade na busca por região: o centro já tem leads de sobra. */
const REGION_RADIUS_KM = 6
/** Na região, falha rápido e deixa a cidade para a 2ª chance. */
const REGION_ENDPOINT_MS = 15000

// A busca de região é guardada inteira (uma entrada), não cidade a cidade:
// o "Brasil todo" passa de 40 cidades e estouraria o limite da memória.
const REGION_CACHE_PREFIX = 'zenn-os:region-cache:v1:'
const REGION_CACHE_MAX = 5

function regionCacheKey(o: RegionSearchOptions) {
  return `${REGION_CACHE_PREFIX}${norm(o.niche)}|${o.region}|${o.target}|${o.requirePhone ? 1 : 0}${o.requireNoSite ? 1 : 0}`
}

function readRegionCache(key: string): RegionSearchResult | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { at, data } = JSON.parse(raw) as { at: number; data: RegionSearchResult }
    return Date.now() - at < CACHE_TTL_MS ? data : null
  } catch {
    return null
  }
}

function writeRegionCache(key: string, data: RegionSearchResult) {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(REGION_CACHE_PREFIX) && k !== key)
    if (keys.length >= REGION_CACHE_MAX) {
      keys
        .map((k) => ({ k, at: (JSON.parse(localStorage.getItem(k) || '{}') as { at?: number }).at ?? 0 }))
        .sort((x, y) => x.at - y.at)
        .slice(0, keys.length - REGION_CACHE_MAX + 1)
        .forEach(({ k }) => localStorage.removeItem(k))
    }
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* sem armazenamento: segue sem memória */
  }
}

/**
 * Busca no Brasil todo ou num estado sem o usuário digitar cidade: percorre
 * as maiores cidades da região, uma por vez, até juntar a quantidade pedida.
 *
 * Cada cidade contribui com no máximo uma "cota", para os leads virem
 * espalhados. Se as cidades acabarem antes da meta, completa com as sobras
 * já baixadas — sem nenhuma requisição a mais.
 */
export async function searchRegionOSM(opts: RegionSearchOptions): Promise<RegionSearchResult> {
  const { niche, region, target, requirePhone, requireNoSite, onProgress, signal } = opts
  const cities = cidadesDaRegiao(region)
  const memKey = regionCacheKey(opts)
  const remembered = readRegionCache(memKey)
  if (remembered) {
    onProgress?.({ found: remembered.results.length, target, city: '', done: cities.length, total: cities.length, partial: remembered.results })
    return remembered
  }
  const quota = Math.max(5, Math.ceil(target / Math.min(cities.length, region === 'BR' ? 8 : 4)))
  const started = Date.now()

  const picked: PlaceResult[] = []
  const reserve: PlaceResult[] = []
  const seen = new Set<string>()
  const contributing: string[] = []
  const failedCities: Array<{ city: string; uf: string }> = []
  let failsInARow = 0

  const matches = (r: PlaceResult) => (!requirePhone || !!r.phone) && (!requireNoSite || !r.website)
  const labelOf = (c: { city: string; uf: string }) => `${c.city} - ${c.uf}`
  const aborted = () => !!signal?.aborted
  const report = (city: string, done: number) =>
    onProgress?.({ found: picked.length, target, city, done, total: cities.length, partial: picked.slice() })

  // O telefone é filtrado aqui, e não no servidor: o filtro por etiqueta de
  // telefone não usa índice no Overpass e estourava o tempo em cidade grande
  // (no teste real, São Paulo, BH, Fortaleza e Curitiba falharam com ele).
  const fetchCity = async (c: { city: string; uf: string }) => {
    const center = await geocodeCached(`${c.city}, ${UFS[c.uf]}`, signal)
    if (!center) throw new Error('cidade não localizada')
    return (await searchArea(center, REGION_RADIUS_KM, niche, labelOf(c), signal, REGION_ENDPOINT_MS)).results
  }

  const absorb = (label: string, list: PlaceResult[]) => {
    let taken = 0
    for (const r of list) {
      if (seen.has(r.placeId) || !matches(r)) continue
      seen.add(r.placeId)
      if (taken < quota && picked.length < target) {
        picked.push(r)
        taken++
      } else {
        reserve.push(r)
      }
    }
    if (taken) contributing.push(label)
  }

  // 1ª passada, na ordem que espalha os leads pelo país.
  for (let i = 0; i < cities.length && picked.length < target; i += REGION_CONCURRENCY) {
    if (aborted() || Date.now() - started > REGION_BUDGET_MS) break
    const batch = cities.slice(i, i + REGION_CONCURRENCY)
    report(batch.map(labelOf).join(' e '), i)

    const settled = await Promise.allSettled(batch.map(fetchCity))
    if (aborted()) break

    settled.forEach((res, k) => {
      if (res.status === 'rejected') {
        failedCities.push(batch[k])
        failsInARow++
      } else {
        failsInARow = 0
        absorb(labelOf(batch[k]), res.value)
      }
    })

    // Várias cidades seguidas falhando sem nenhum lead = servidores fora do ar.
    if (failsInARow >= 4 && picked.length === 0) {
      throw new Error('Os servidores de mapa estão sobrecarregados agora. Tente de novo em alguns minutos.')
    }
    report('', Math.min(i + REGION_CONCURRENCY, cities.length))
    if (picked.length < target && i + REGION_CONCURRENCY < cities.length) await new Promise((r) => setTimeout(r, 400))
  }

  // 2ª chance para as cidades que falharam: o servidor público oscila e,
  // minutos depois, costuma responder. Uma por vez, para não pesar.
  for (const c of [...failedCities]) {
    if (picked.length >= target || aborted() || Date.now() - started > REGION_BUDGET_MS) break
    report(`${labelOf(c)} (nova tentativa)`, cities.length)
    try {
      absorb(labelOf(c), await fetchCity(c))
      failedCities.splice(failedCities.indexOf(c), 1)
    } catch {
      if (aborted()) break
    }
  }

  // Parou antes de achar qualquer coisa: é cancelamento de verdade.
  if (aborted() && picked.length === 0) throw new DOMException('Busca cancelada', 'AbortError')
  const failed = failedCities.map(labelOf)

  // Completa a meta com o que sobrou das cidades já consultadas.
  for (const r of aborted() ? [] : reserve) {
    if (picked.length >= target) break
    picked.push(r)
  }

  // Parou no meio: entrega o que já veio, sem completar com sobras.
  const stopped = aborted()
  report('', cities.length)
  const out: RegionSearchResult = { results: picked, cities: contributing, failed, exhausted: !stopped && picked.length < target, stopped }
  // Só lembra buscas completas: parcial (parada ou com falhas) merece nova tentativa.
  if (picked.length && !failed.length && !stopped) writeRegionCache(memKey, out)
  return out
}
