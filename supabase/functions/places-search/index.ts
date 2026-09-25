// ============================================================
// Edge Function: places-search
// Busca real de empresas para prospecção. Duas fontes:
//   1) OpenStreetMap (Overpass) — GRÁTIS, sem chave, padrão.
//   2) Google Places (New) — só se houver chave em app_settings.
// Sem nenhuma delas disponível => { mode: "demo" }.
// Requer JWT válido (usuário logado).
// ============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// ---------- OpenStreetMap (grátis) ----------
const OSM_UA = "ZennOS/1.0 (prospeccao; contato.zennworks@gmail.com)";

// Mapeia nichos comuns (pt-BR) para tags OSM. Além disso, sempre casa pelo nome.
function osmCategoryFilters(niche: string): string[] {
  const n = norm(niche);
  const has = (...w: string[]) => w.some((x) => n.includes(x));
  if (has("pizzar", "pizza")) return ['["amenity"~"restaurant|fast_food"]'];
  if (has("hamburg", "burger", "lanchonete")) return ['["amenity"~"fast_food|restaurant"]'];
  if (has("restaurante", "comida", "buffet", "churrasc")) return ['["amenity"="restaurant"]'];
  if (has("bar", "pub", "boteco", "cervej")) return ['["amenity"~"bar|pub"]'];
  if (has("cafe", "cafeteria", "confeitaria")) return ['["amenity"="cafe"]'];
  if (has("padaria", "panific")) return ['["shop"="bakery"]'];
  if (has("barbear", "barber")) return ['["shop"="hairdresser"]', '["shop"="barber"]'];
  if (has("salao", "beleza", "cabelei", "estetica", "manicure")) return ['["shop"~"hairdresser|beauty"]', '["beauty"]'];
  if (has("academia", "fitness", "crossfit", "musculac")) return ['["leisure"="fitness_centre"]', '["sport"="fitness"]'];
  if (has("pet", "veterin")) return ['["shop"="pet"]', '["amenity"="veterinary"]'];
  if (has("odont", "dentist", "dental")) return ['["amenity"="dentist"]', '["healthcare"="dentist"]'];
  if (has("clinica", "medic", "saude", "consultorio")) return ['["amenity"~"clinic|doctors"]', '["healthcare"]'];
  if (has("farmacia", "drogaria")) return ['["amenity"="pharmacy"]'];
  if (has("oficina", "mecanic", "autocenter", "auto center", "funilaria")) return ['["shop"="car_repair"]'];
  if (has("mercado", "supermerc", "merceari", "hortifr")) return ['["shop"~"supermarket|convenience|greengrocer"]'];
  if (has("roupa", "moda", "boutique", "vestuar")) return ['["shop"~"clothes|boutique|fashion"]'];
  if (has("otica", "oculos")) return ['["shop"="optician"]'];
  if (has("tatuagem", "tattoo", "piercing")) return ['["shop"="tattoo"]'];
  if (has("escola", "curso", "ensino")) return ['["amenity"~"school|college|language_school"]'];
  if (has("hotel", "pousada", "hostel")) return ['["tourism"~"hotel|guest_house|hostel"]'];
  if (has("imobiliar", "imovel")) return ['["office"="estate_agent"]', '["shop"="estate_agent"]'];
  if (has("advocacia", "advogad", "juridic")) return ['["office"="lawyer"]'];
  if (has("contabil", "contador")) return ['["office"="accountant"]'];
  return []; // sem categoria mapeada: só casa pelo nome
}

interface OsmEl {
  type: string; id: number; lat?: number; lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(city)}`;
  const res = await fetch(url, { headers: { "User-Agent": OSM_UA, "Accept-Language": "pt-BR" } });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}

function osmAddress(t: Record<string, string>, fallbackCity: string) {
  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
  const parts = [street, t["addr:suburb"] || t["addr:neighbourhood"]].filter(Boolean);
  return { address: parts.join(" — "), city: t["addr:city"] || fallbackCity };
}

async function searchOSM(niche: string, city: string, radiusKm: number) {
  const center = await geocodeCity(city);
  if (!center) return null;
  const radius = Math.min(Math.max(radiusKm || 10, 1), 50) * 1000;
  const around = `(around:${radius},${center.lat},${center.lon})`;
  const nameRe = norm(niche).split(/\s+/)[0]; // primeira palavra do nicho
  const clauses = [`nwr["name"~"${nameRe}",i]${around};`];
  for (const cat of osmCategoryFilters(niche)) clauses.push(`nwr${cat}${around};`);
  const query = `[out:json][timeout:25];(${clauses.join("")});out center tags 80;`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": OSM_UA },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const data = (await res.json()) as { elements: OsmEl[] };

  const seen = new Set<string>();
  const results = (data.elements ?? [])
    .filter((e) => e.tags?.name)
    .filter((e) => {
      const k = norm(e.tags!.name);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((e) => {
      const t = e.tags!;
      const { address, city: c } = osmAddress(t, city);
      const website = t["website"] || t["contact:website"] || null;
      const ig = t["contact:instagram"] || t["instagram"] || null;
      const fb = t["contact:facebook"] || t["facebook"] || null;
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      return {
        placeId: `osm_${e.type}_${e.id}`,
        name: t.name,
        category: t.cuisine || t.shop || t.amenity || t.office || t.leisure || niche,
        address,
        city: c,
        phone: t["contact:phone"] || t["phone"] || null,
        rating: null,
        reviewsCount: 0,
        website: website && website.trim() ? website : null,
        googleMapsUrl:
          lat && lon
            ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${t.name} ${c}`)}`,
        facebook: fb,
        instagram: ig,
        source: "osm" as const,
      };
    });
  return results.slice(0, 60);
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

    // Google se houver chave; senão OpenStreetMap (grátis).
    if (key) {
      const results = await searchGoogle(niche, city, Number(radiusKm), key);
      return json({ mode: "live", source: "google", results });
    }
    const osm = await searchOSM(niche, city, Number(radiusKm));
    if (osm === null) return json({ error: "Cidade não encontrada no OpenStreetMap." }, 404);
    return json({ mode: "live", source: "osm", results: osm });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
