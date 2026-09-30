// Faz a busca do OpenStreetMap de DENTRO de um Chrome real, com a origem
// do site publicado — mesmos cabeçalhos (Origin, Referer, User-Agent) que o
// navegador do usuário envia. Só o IP difere (datacenter do GitHub).
import { chromium } from 'playwright'

const SITE = 'https://gh9034517-hash.github.io/Zenn-OS/'
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(SITE, { waitUntil: 'domcontentloaded' })

const result = await page.evaluate(async () => {
  // Restaurantes no centro de Campinas (bbox pequena, consulta leve).
  const query = '[out:json][timeout:20];nwr["amenity"="restaurant"]["name"](-22.93,-47.09,-22.88,-47.03);out center tags 50;'
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]
  const out = []
  for (const ep of endpoints) {
    const t0 = performance.now()
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 30000)
      const res = await fetch(ep, { method: 'POST', body: new URLSearchParams({ data: query }), signal: ctrl.signal })
      clearTimeout(timer)
      let count = null
      let comPhone = null
      if (res.ok) {
        const j = await res.json()
        count = j.elements?.length ?? 0
        comPhone = (j.elements ?? []).filter((e) => e.tags && (e.tags.phone || e.tags['contact:phone'])).length
      }
      out.push({ ep, status: res.status, ms: Math.round(performance.now() - t0), count, comPhone })
    } catch (e) {
      out.push({ ep, erro: String(e), ms: Math.round(performance.now() - t0) })
    }
  }
  return { ua: navigator.userAgent, out }
})

console.log('User-Agent do Chrome:', result.ua)
for (const r of result.out) console.log(JSON.stringify(r))
await browser.close()
