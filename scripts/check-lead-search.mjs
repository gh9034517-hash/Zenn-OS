// Verificação da busca de leads como o usuário a vê: o código EXATO do app
// (src/services/osmSearch.ts) roda DENTRO de um Chrome real, na origem do
// site publicado. É isso que importa: fora do navegador o Overpass recusa
// a conexão (HTTP 406 por cabeçalho), dentro dele responde normalmente.
//
// Uso (CI): npm i && npx playwright install --with-deps chromium && node scripts/check-lead-search.mjs
import { build } from 'esbuild'
import { chromium } from 'playwright'

const SITE = 'https://gh9034517-hash.github.io/Zenn-OS/'

const bundle = await build({
  entryPoints: ['src/services/osmSearch.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'OSM',
  write: false,
  platform: 'browser',
  target: 'es2020',
})
const code = bundle.outputFiles[0].text

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(SITE, { waitUntil: 'domcontentloaded' })
await page.addScriptTag({ content: code })

let failures = 0

// 1) Padronização de telefone
const phoneCases = [
  ['+55 11 98929-8569', '(11) 98929-8569'],
  ['+55 11 9 8929-8569', '(11) 98929-8569'],
  ['+55 19 3232-1234', '(19) 3232-1234'],
  ['(19) 99999-0000', '(19) 99999-0000'],
  ['011 3333-4444', '(11) 3333-4444'],
  ['+551932321234', '(19) 3232-1234'],
  ['0800 123 4567', '0800 123 4567'],
  ['3232-1234', null], // sem DDD: não dá para garantir
  ['123', null],
]
console.log('== Telefones')
const phones = await page.evaluate((cases) => cases.map(([i]) => window.OSM.formatPhoneBR(i)), phoneCases)
phoneCases.forEach(([input, expected], i) => {
  const ok = phones[i] === expected
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${JSON.stringify(input).padEnd(22)} -> ${JSON.stringify(phones[i])}`)
})

// 2) Buscas reais — inclui os casos que falharam em produção.
const cases = [
  ['Barbearias', 'São Paulo'],
  ['Academias', 'São Paulo'],
  ['Pizzarias', 'Campinas'],
  ['Padarias', 'Valinhos'],
  ['Restaurantes', 'Belo Horizonte'],
  ['Salões de beleza', 'Rio de Janeiro'],
  ['Oficinas', 'Curitiba'],
]

console.log('\n== Buscas reais no Chrome, origem do site (raio 10 km)')
for (const [niche, city] of cases) {
  const r = await page.evaluate(
    async ([niche, city]) => {
      const t0 = performance.now()
      try {
        const res = await window.OSM.searchPlacesOSM({ niche, city, radiusKm: 10 })
        const list = res.results
        return {
          ok: true,
          secs: ((performance.now() - t0) / 1000).toFixed(1),
          total: list.length,
          phone: list.filter((x) => x.phone).length,
          noSite: list.filter((x) => !x.website).length,
          both: list.filter((x) => x.phone && !x.website).length,
          endpoint: res.endpoint,
          city: res.resolvedCity,
          sample: list.filter((x) => x.phone).slice(0, 3).map((x) => `${x.name} — ${x.phone}${x.website ? '' : ' — SEM SITE'}`),
        }
      } catch (e) {
        return { ok: false, error: String(e && e.message ? e.message : e), secs: ((performance.now() - t0) / 1000).toFixed(1) }
      }
    },
    [niche, city],
  )
  const label = `${niche} / ${city}`.padEnd(34)
  if (!r.ok || r.total === 0) failures++
  if (!r.ok) {
    console.log(`FAIL ${label} ${r.error} (${r.secs}s)`)
  } else {
    console.log(
      `${r.total ? 'OK  ' : 'FAIL'} ${label} ${String(r.total).padStart(3)} empresas · ${String(r.phone).padStart(3)} c/ tel · ${String(r.noSite).padStart(3)} sem site · ${String(r.both).padStart(3)} tel+sem site · ${r.secs}s · ${r.endpoint} · ${r.city}`,
    )
    for (const s of r.sample) console.log(`       ${s}`)
  }
  // Educação com os servidores públicos (limite por IP).
  await new Promise((res) => setTimeout(res, 3000))
}

await browser.close()
console.log(`\n${failures ? `❌ ${failures} falha(s)` : '✅ tudo certo'}`)
process.exit(failures ? 1 : 0)
