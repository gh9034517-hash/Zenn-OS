// ============================================================
// Edge Function: places-search
// Proxy oficial para a Google Places API (New) — Text Search.
// A chave do Google fica guardada na tabela app_settings
// (definida pelo app em Configurações) e NUNCA vai ao navegador.
// Sem chave configurada => responde { mode: "demo" } e o app usa
// dados fictícios. Requer JWT válido (usuário logado).
// ============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.primaryTypeDisplayName",
  "nextPageToken",
].join(",");

interface AddressComponent { longText: string; types: string[] }
interface GPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text: string };
}

async function places(body: Record<string, unknown>, key: string, mask: string) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": mask },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json())?.error?.message ?? detail; } catch { /* noop */ }
    throw new Error(`Google Places: ${detail} (HTTP ${res.status})`);
  }
  return res.json() as Promise<{ places?: GPlace[]; nextPageToken?: string }>;
}

function mapPlace(p: GPlace, fallbackCity: string, niche: string) {
  const city = p.addressComponents?.find(
    (c) => c.types.includes("administrative_area_level_2") || c.types.includes("locality"),
  );
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "Sem nome",
    category: p.primaryTypeDisplayName?.text ?? niche,
    address: p.formattedAddress ?? "",
    city: city?.longText ?? fallbackCity,
    phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
    rating: typeof p.rating === "number" ? p.rating : null,
    reviewsCount: p.userRatingCount ?? 0,
    website: p.websiteUri?.trim() ? p.websiteUri : null,
    googleMapsUrl: p.googleMapsUri ?? null,
    facebook: null,
    instagram: null,
    source: "google_places" as const,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { niche, city, radiusKm } = await req.json();
    if (!niche || !city) return json({ error: "Informe nicho e cidade." }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Lê a chave do Google guardada em app_settings (service role ignora RLS).
    const settingsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/app_settings?key=eq.google_maps_api_key&select=value`,
      { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
    );
    const rows = (await settingsRes.json()) as Array<{ value: string | null }>;
    const key = rows?.[0]?.value?.trim();

    if (!key) return json({ mode: "demo", results: [] });

    // Geocodifica a cidade para aplicar o raio como locationBias.
    let center: { latitude: number; longitude: number } | null = null;
    try {
      const geo = await places({ textQuery: city, languageCode: "pt-BR", regionCode: "BR", pageSize: 1 }, key, "places.location");
      center = geo.places?.[0]?.["location" as keyof GPlace] as never ?? null;
    } catch { /* segue sem bias */ }

    const radius = Math.min(Math.max(Number(radiusKm) || 10, 1), 50) * 1000;
    const baseBody: Record<string, unknown> = {
      textQuery: `${niche} em ${city}`,
      languageCode: "pt-BR",
      regionCode: "BR",
      pageSize: 20,
    };
    if (center) baseBody.locationBias = { circle: { center, radius } };

    const results: ReturnType<typeof mapPlace>[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 3; page++) {
      const data = await places(pageToken ? { ...baseBody, pageToken } : baseBody, key, FIELD_MASK);
      results.push(...(data.places ?? []).map((p) => mapPlace(p, city, niche)));
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }

    return json({ mode: "live", results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
