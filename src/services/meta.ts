// ============================================================
// Meta Graph API (Facebook / Instagram) — integração OFICIAL
// https://developers.facebook.com/docs/graph-api
//
// Somente endpoints oficiais, com token do app (META_ACCESS_TOKEN).
// Nada de scraping. Sem token => DEMO MODE (dados fictícios e
// sinalizados).
// Obs.: consultar páginas públicas exige o recurso
// "Page Public Metadata Access" aprovado na revisão do app.
// ============================================================

import { env, integrations } from '@/lib/env'
import { hashString, seededRandom } from '@/utils/id'

export interface MetaPageInfo {
  mode: 'live' | 'demo'
  id: string
  name: string
  link: string
  followers: number | null
  about: string | null
  phone: string | null
  website: string | null
  instagramUsername: string | null
  instagramFollowers: number | null
}

export const isMetaConfigured = () => integrations.meta

const GRAPH = () => `https://graph.facebook.com/${env.metaGraphVersion}`

/** Extrai o identificador da página de uma URL ou @handle. */
export function extractHandle(value: string): string {
  const trimmed = value.trim()
  const fromUrl = trimmed.match(/facebook\.com\/(?:pg\/)?([^/?#]+)/i)
  return (fromUrl ? fromUrl[1] : trimmed).replace(/^@/, '')
}

function demoPage(handle: string): MetaPageInfo {
  const rand = seededRandom(hashString(handle))
  return {
    mode: 'demo',
    id: `demo_${handle}`,
    name: handle,
    link: `https://facebook.com/${handle}`,
    followers: Math.floor(200 + rand() * 9000),
    about: 'Página fictícia gerada em DEMO MODE.',
    phone: null,
    website: null,
    instagramUsername: rand() > 0.4 ? handle : null,
    instagramFollowers: rand() > 0.4 ? Math.floor(300 + rand() * 15000) : null,
  }
}

export async function lookupFacebookPage(handleOrUrl: string): Promise<MetaPageInfo> {
  const handle = extractHandle(handleOrUrl)
  if (!handle) throw new Error('Informe a URL ou o usuário da página.')
  if (!isMetaConfigured()) return demoPage(handle)

  const fields = [
    'id',
    'name',
    'link',
    'followers_count',
    'fan_count',
    'about',
    'phone',
    'website',
    'instagram_business_account{username,followers_count}',
  ].join(',')
  const url = `${GRAPH()}/${encodeURIComponent(handle)}?fields=${fields}&access_token=${encodeURIComponent(env.metaAccessToken)}`
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok || data.error) {
    throw new Error(`Meta Graph API: ${data?.error?.message ?? res.statusText}`)
  }
  return {
    mode: 'live',
    id: data.id,
    name: data.name,
    link: data.link ?? `https://facebook.com/${handle}`,
    followers: data.followers_count ?? data.fan_count ?? null,
    about: data.about ?? null,
    phone: data.phone ?? null,
    website: data.website ?? null,
    instagramUsername: data.instagram_business_account?.username ?? null,
    instagramFollowers: data.instagram_business_account?.followers_count ?? null,
  }
}
