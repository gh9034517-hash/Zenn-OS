// Verificação da busca de leads com internet de verdade.
// Roda o MESMO código do app (src/services/osmSearch.ts) contra os
// servidores reais do OpenStreetMap e falha se alguma busca vier vazia
// ou quebrar. Uso: npx tsx scripts/check-lead-search.mts
import { searchPlacesOSM, formatPhoneBR } from '../src/services/osmSearch.ts'

let failures = 0

// 1) Padronização de telefone
const phoneCases: Array<[string, string | null]> = [
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
for (const [input, expected] of phoneCases) {
  const got = formatPhoneBR(input)
  const ok = got === expected
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${JSON.stringify(input).padEnd(22)} -> ${JSON.stringify(got)}${ok ? '' : `  (esperado ${JSON.stringify(expected)})`}`)
}

// 2) Buscas reais — inclui os casos que falharam em produção.
const cases: Array<[string, string]> = [
  ['Barbearias', 'São Paulo'],
  ['Academias', 'São Paulo'],
  ['Pizzarias', 'Campinas'],
  ['Padarias', 'Valinhos'],
  ['Restaurantes', 'Belo Horizonte'],
  ['Salões de beleza', 'Rio de Janeiro'],
  ['Oficinas', 'Curitiba'],
]

console.log('\n== Buscas reais (raio 10 km)')
for (const [niche, city] of cases) {
  const t0 = Date.now()
  try {
    const r = await searchPlacesOSM({ niche, city, radiusKm: 10 })
    const secs = ((Date.now() - t0) / 1000).toFixed(1)
    const total = r.results.length
    const phone = r.results.filter((x) => x.phone).length
    const noSite = r.results.filter((x) => !x.website).length
    const both = r.results.filter((x) => x.phone && !x.website).length
    if (total === 0) failures++
    console.log(
      `${total ? 'OK  ' : 'FAIL'} ${`${niche} / ${city}`.padEnd(34)} ${String(total).padStart(3)} empresas · ${String(phone).padStart(3)} c/ tel · ${String(noSite).padStart(3)} sem site · ${String(both).padStart(3)} tel+sem site · ${secs}s · ${r.endpoint} · cidade: ${r.resolvedCity}`,
    )
    for (const x of r.results.filter((y) => y.phone).slice(0, 3)) {
      console.log(`       ${x.name} — ${x.phone}${x.website ? '' : ' — SEM SITE'}${x.address ? ` — ${x.address}` : ''}`)
    }
  } catch (e) {
    failures++
    console.log(`FAIL ${`${niche} / ${city}`.padEnd(34)} ${e instanceof Error ? e.message : String(e)}`)
  }
  // Educação com os servidores públicos (limite de requisições por IP).
  await new Promise((r) => setTimeout(r, 2500))
}

console.log(`\n${failures ? `❌ ${failures} falha(s)` : '✅ tudo certo'}`)
process.exit(failures ? 1 : 0)
