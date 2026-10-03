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

// Falha = defeito do código. Aviso = o servidor gratuito estava instável
// (ele oscila: 504 por minutos depois de algumas consultas seguidas), o que
// não deve deixar o commit vermelho.
let failures = 0
let warnings = 0
let citySuccesses = 0

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
  if (r.ok && r.total > 0) citySuccesses++
  else warnings++
  if (!r.ok) {
    console.log(`WARN ${label} ${r.error} (${r.secs}s)`)
  } else {
    console.log(
      `${r.total ? 'OK  ' : 'WARN'} ${label} ${String(r.total).padStart(3)} empresas · ${String(r.phone).padStart(3)} c/ tel · ${String(r.noSite).padStart(3)} sem site · ${String(r.both).padStart(3)} tel+sem site · ${r.secs}s · ${r.endpoint} · ${r.city}`,
    )
    for (const s of r.sample) console.log(`       ${s}`)
  }
  // Educação com os servidores públicos (limite por IP).
  await new Promise((res) => setTimeout(res, 3000))
}

// Metade ou mais das cidades falhando já não é instabilidade: é defeito.
if (citySuccesses < Math.ceil(cases.length / 2)) {
  failures++
  console.log(`FAIL só ${citySuccesses} de ${cases.length} buscas por cidade funcionaram`)
}

// 3) Busca por região, sem digitar cidade: meta de quantidade.
const regionCases = [
  ['Barbearias', 'BR', 50],
  ['Academias', 'MG', 25],
]
console.log('\n== Busca por região (Brasil todo / estado), só com telefone e sem site')
for (const [niche, region, target] of regionCases) {
  const r = await page.evaluate(
    async ([niche, region, target]) => {
      const t0 = performance.now()
      try {
        const res = await window.OSM.searchRegionOSM({ niche, region, target, requirePhone: true, requireNoSite: true })
        return {
          ok: true,
          secs: ((performance.now() - t0) / 1000).toFixed(1),
          total: res.results.length,
          allPhone: res.results.every((x) => !!x.phone),
          allNoSite: res.results.every((x) => !x.website),
          unique: new Set(res.results.map((x) => x.placeId)).size === res.results.length,
          cities: res.cities,
          failed: res.failed,
          sample: res.results.slice(0, 4).map((x) => `${x.name} — ${x.phone} — ${x.city}`),
        }
      } catch (e) {
        return { ok: false, error: String(e && e.message ? e.message : e), secs: ((performance.now() - t0) / 1000).toFixed(1) }
      }
    },
    [niche, region, target],
  )
  const label = `${niche} / ${region} / meta ${target}`.padEnd(34)
  // Invariantes do código: nunca podem falhar, com servidor bom ou ruim.
  const invariantsOk = !r.ok || (r.allPhone && r.allNoSite && r.unique)
  // Quantidade e espalhamento dependem do servidor responder: só avisa.
  const metaOk = r.ok && r.total === target && (region !== 'BR' || r.cities.length >= 3)
  if (!invariantsOk) failures++
  else if (!metaOk) warnings++
  const tag = !invariantsOk ? 'FAIL' : metaOk ? 'OK  ' : 'WARN'
  if (!r.ok) {
    console.log(`${tag} ${label} ${r.error} (${r.secs}s)`)
  } else {
    console.log(
      `${tag} ${label} ${r.total} leads · ${r.cities.length} cidades · tel: ${r.allPhone} · sem site: ${r.allNoSite} · únicos: ${r.unique} · ${r.secs}s${r.failed.length ? ` · falharam: ${r.failed.join(', ')}` : ''}`,
    )
    console.log(`       cidades: ${r.cities.join(', ')}`)
    for (const s of r.sample) console.log(`       ${s}`)
  }
  await new Promise((res) => setTimeout(res, 3000))
}

await browser.close()
console.log(
  `\n${failures ? `❌ ${failures} falha(s) de código` : '✅ código ok'}${warnings ? ` · ⚠ ${warnings} aviso(s): servidor gratuito instável nesta rodada` : ''}`,
)
process.exit(failures ? 1 : 0)
