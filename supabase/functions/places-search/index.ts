// ============================================================
// Edge Function: places-search
// Busca real de empresas para prospecção. Duas fontes:
//   1) OpenStreetMap (Photon + Overpass) — GRÁTIS, sem chave, padrão.
//   2) Google Places (New) — só se houver chave em app_settings.
// Requer JWT válido (usuário logado).
//
// Estratégia OSM (rápida e confiável):
//   - Geocodifica a cidade via Photon (permite uso em servidor).
//   - Consulta o Overpass por TAG de categoria (indexada) numa bounding box.
//   - Filtra por palavra-chave no código quando o nicho é um subconjunto
//     da categoria (ex.: pizzaria dentro de restaurantes).
// ============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const UA = "ZennOS/1.0 (prospeccao; contato.zennworks@gmail.com)";
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// ---------- OpenStreetMap ----------
interface Plan { selectors: string[]; keywords: string[] }

// Nicho (pt-BR) -> seletores de tag OSM (busca rápida) + palavras-chave (filtro fino).
function osmPlan(niche: string): Plan {
  const n = norm(niche);
  const has = (...w: string[]) => w.some((x) => n.includes(x));
  if (has("pizzar", "pizza")) return { selectors: ['["amenity"~"^(restaurant|fast_food)$"]'], keywords: ["pizza"] };
  if (has("hamburg", "burger", "lanchonete")) return { selectors: ['["amenity"~"^(fast_food|restaurant)$"]'], keywords: ["hamburg", "burger", "smash", "lanche"] };
  if (has("restaurante", "comida", "buffet", "churrasc", "marmit")) return { selectors: ['["amenity"="restaurant"]'], keywords: [] };
  if (has("bar", "boteco", "pub", "cervej")) return { selectors: ['["amenity"~"^(bar|pub)$"]'], keywords: [] };
  if (has("cafe", "cafeteria", "confeitaria")) return { selectors: ['["amenity"="cafe"]'], keywords: [] };
  if (has("padaria", "panific")) return { selectors: ['["shop"="bakery"]'], keywords: [] };
  if (has("barbear", "barber")) return { selectors: ['["shop"~"^(hairdresser|barber)$"]'], keywords: [] };
  if (has("salao", "beleza", "cabelei", "estetica", "manicure")) return { selectors: ['["shop"~"^(hairdresser|beauty)$"]', '["beauty"]'], keywords: [] };
  if (has("academia", "fitness", "crossfit", "musculac")) return { selectors: ['["leisure"="fitness_centre"]', '["sport"="fitness"]'], keywords: [] };
  if (has("pet", "veterin")) return { selectors: ['["shop"="pet"]', '["amenity"="veterinary"]'], keywords: [] };
  if (has("odont", "dentist", "dental")) return { selectors: ['["amenity"="dentist"]', '["healthcare"="dentist"]'], keywords: [] };
  if (has("clinica", "medic", "consultorio", "saude")) return { selectors: ['["amenity"~"^(clinic|doctors)$"]', '["healthcare"~"clinic|doctor"]'], keywords: [] };
  if (has("farmacia", "drogaria")) return { selectors: ['["amenity"="pharmacy"]'], keywords: [] };
  if (has("oficina", "mecanic", "autocenter", "funilaria")) return { selectors: ['["shop"="car_repair"]'], keywords: [] };
  if (has("lavarapido", "lava rapido", "lava-jato", "estetica automotiva")) return { selectors: ['["shop"="car_repair"]', '["amenity"="car_wash"]'], keywords: [] };
  if (has("mercado", "supermerc", "merceari", "hortifr", "adega")) return { selectors: ['["shop"~"^(supermarket|convenience|greengrocer)$"]'], keywords: [] };
  if (has("roupa", "moda", "boutique", "vestuar")) return { selectors: ['["shop"~"^(clothes|boutique|fashion)$"]'], keywords: [] };
  if (has("otica", "oculos")) return { selectors: ['["shop"="optician"]'], keywords: [] };
  if (has("tatuagem", "tattoo", "piercing")) return { selectors: ['["shop"="tattoo"]'], keywords: [] };
  if (has("escola", "curso", "ensino", "idiomas")) return { selectors: ['["amenity"~"^(school|college|language_school)$"]'], keywords: [] };
  if (has("hotel", "pousada", "hostel", "motel")) return { selectors: ['["tourism"~"^(hotel|guest_house|hostel|motel)$"]'], keywords: [] };
  if (has("imobiliar", "imovel", "corretor")) return { selectors: ['["office"="estate_agent"]', '["shop"="estate_agent"]'], keywords: [] };
  if (has("advocacia", "advogad", "juridic")) return { selectors: ['["office"="lawyer"]'], keywords: [] };
  if (has("contabil", "contador", "contabilidade")) return { selectors: ['["office"="accountant"]'], keywords: [] };
  if (has("sorvet", "acai", "gelateria")) return { selectors: ['["amenity"~"^(ice_cream|cafe)$"]', '["cuisine"~"ice_cream"]'], keywords: [] };
  if (has("floricultura", "flores")) return { selectors: ['["shop"="florist"]'], keywords: [] };
  if (has("joalheria", "joias", "relojoaria")) return { selectors: ['["shop"~"^(jewelry|watches)$"]'], keywords: [] };
  // Sem categoria mapeada: usa o nome como filtro (mais lento, best-effort).
  return { selectors: [], keywords: [norm(niche).split(/\s+/)[0]] };
}

interface OsmEl {
  type: string; id: number; lat?: number; lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// Geocodifica a cidade (Photon, baseado em OSM, permite uso em servidor).
async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(city + ", Brasil")}&limit=1&lang=pt`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const data = await res.json();
  const f = data?.features?.[0];
  if (!f?.geometry?.coordinates) return null;
  const [lon, lat] = f.geometry.coordinates;
  return { lat, lon };
}

function osmAddress(t: Record<string, string>, fallbackCity: string) {
  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
  const parts = [street, t["addr:suburb"] || t["addr:neighbourhood"]].filter(Boolean);
  return { address: parts.join(" - "), city: t["addr:city"] || fallbackCity };
}

async function searchOSM(niche: string, city: string, radiusKm: number) {
  const center = await geocodeCity(city);
  if (!center) return null;

  const km = Math.min(Math.max(radiusKm || 10, 1), 50);
  const dLat = km / 111;
  const dLon = km / (111 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.2));
  const bbox = `(${center.lat - dLat},${center.lon - dLon},${center.lat + dLat},${center.lon + dLon})`;

  const plan = osmPlan(niche);
  let clauses: string[];
  if (plan.selectors.length) {
    clauses = plan.selectors.map((s) => `nwr${s}${bbox};`);
  } else {
    // Fallback por nome (sem categoria conhecida).
    const kw = plan.keywords[0] || norm(niche);
    clauses = [`nwr["name"~"${kw}",i]${bbox};`];
  }
  const query = `[out:json][timeout:25];(${clauses.join("")});out center tags 300;`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const data = (await res.json()) as { elements: OsmEl[] };

  const kws = plan.keywords.map(norm);
  const seen = new Set<string>();
  const results = (data.elements ?? [])
    .filter((e) => e.tags?.name)
    .filter((e) => {
      if (!kws.length) return true;
      const hay = norm(`${e.tags!.name} ${e.tags!.cuisine ?? ""}`);
      return kws.some((k) => hay.includes(k));
    })
    .filter((e) => {
      const k = norm(e.tags!.name);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((e) => {
      const t = e.tags!;
      const addr = osmAddress(t, city);
      const website = t["website"] || t["contact:website"] || null;
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      return {
        placeId: `osm_${e.type}_${e.id}`,
        name: t.name,
        category: t.cuisine || t.shop || t.amenity || t.office || t.leisure || t.tourism || niche,
        address: addr.address,
        city: addr.city,
        phone: t["contact:phone"] || t["phone"] || null,
        rating: null,
        reviewsCount: 0,
        website: website && website.trim() ? website : null,
        googleMapsUrl: lat && lon
          ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.name + " " + addr.city)}`,
        facebook: t["contact:facebook"] || t["facebook"] || null,
        instagram: t["contact:instagram"] || t["instagram"] || null,
        source: "osm" as const,
      };
    });

  // Prioriza quem NÃO tem site (foco da prospecção).
  results.sort((a, b) => Number(!!a.website) - Number(!!b.website));
  return results.slice(0, 80);
}

// ---------- Google Places (opcional, pago) ----------
const FIELD_MASK = [
  "places.id", "places.displayName", "places.formattedAddress", "places.addressComponents",
  "places.nationalPhoneNumber", "places.internationalPhoneNumber", "places.rating",
  "places.userRatingCount", "places.websiteUri", "places.googleMapsUri",
  "places.primaryTypeDisplayName", "nextPageToken",
].join(",");

interface GPlace {
  id: string; displayName?: { text: string }; formattedAddress?: string;
  addressComponents?: Array<{ longText: string; types: string[] }>;
  nationalPhoneNumber?: string; internationalPhoneNumber?: string;
  rating?: number; userRatingCount?: number; websiteUri?: string;
  googleMapsUri?: string; primaryTypeDisplayName?: { text: string };
  location?: { latitude: number; longitude: number };
}
async function gplaces(body: Record<string, unknown>, key: string, mask: string) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": mask },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let d = res.statusText;
    try { d = (await res.json())?.error?.message ?? d; } catch { /* noop */ }
    throw new Error(`Google Places: ${d} (HTTP ${res.status})`);
  }
  return res.json() as Promise<{ places?: GPlace[]; nextPageToken?: string }>;
}
async function searchGoogle(niche: string, city: string, radiusKm: number, key: string) {
  let center: { latitude: number; longitude: number } | null = null;
  try {
    const g = await gplaces({ textQuery: city, languageCode: "pt-BR", regionCode: "BR", pageSize: 1 }, key, "places.location");
    center = g.places?.[0]?.location ?? null;
  } catch { /* sem bias */ }
  const radius = Math.min(Math.max(radiusKm || 10, 1), 50) * 1000;
  const base: Record<string, unknown> = { textQuery: `${niche} em ${city}`, languageCode: "pt-BR", regionCode: "BR", pageSize: 20 };
  if (center) base.locationBias = { circle: { center, radius } };
  const out: unknown[] = [];
  let token: string | undefined;
  for (let p = 0; p < 3; p++) {
    const data = await gplaces(token ? { ...base, pageToken: token } : base, key, FIELD_MASK);
    for (const pl of data.places ?? []) {
      const c = pl.addressComponents?.find((x) => x.types.includes("administrative_area_level_2") || x.types.includes("locality"));
      out.push({
        placeId: pl.id, name: pl.displayName?.text ?? "Sem nome",
        category: pl.primaryTypeDisplayName?.text ?? niche, address: pl.formattedAddress ?? "",
        city: c?.longText ?? city, phone: pl.nationalPhoneNumber ?? pl.internationalPhoneNumber ?? null,
        rating: typeof pl.rating === "number" ? pl.rating : null, reviewsCount: pl.userRatingCount ?? 0,
        website: pl.websiteUri?.trim() ? pl.websiteUri : null, googleMapsUrl: pl.googleMapsUri ?? null,
        facebook: null, instagram: null, source: "google_places" as const,
      });
    }
    if (!data.nextPageToken) break;
    token = data.nextPageToken;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { niche, city, radiusKm } = await req.json();
    if (!niche || !city) return json({ error: "Informe nicho e cidade." }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.google_maps_api_key&select=value`,
      { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
    const rows = (await r.json()) as Array<{ value: string | null }>;
    const key = rows?.[0]?.value?.trim();

    if (key) {
      const results = await searchGoogle(niche, city, Number(radiusKm), key);
      return json({ mode: "live", source: "google", results });
    }
    const osm = await searchOSM(niche, city, Number(radiusKm));
    if (osm === null) return json({ error: "Cidade nao encontrada." }, 404);
    return json({ mode: "live", source: "osm", results: osm });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
