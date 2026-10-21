// Descobre as funções de um site de referência que fica atrás de login:
// baixa os arquivos JavaScript públicos que o próprio site entrega ao
// navegador e lista rotas, textos de interface e serviços usados. Também
// testa endereços prováveis para ver quais páginas existem.
// Uso: node scripts/inspect-bundle.mjs <url> <pasta-de-saída>
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const START = process.argv[2]
const OUT = process.argv[3] || 'inspect-out'
await mkdir(join(OUT, 'chunks'), { recursive: true })

const origin = new URL(START).origin
const browser = await chromium.launch()
const ctx = await browser.newContext({ locale: 'pt-BR' })
const page = await ctx.newPage()

const scripts = new Set()
page.on('request', (r) => {
  const u = r.url()
  if (u.startsWith(origin) && /\.(js|css)(\?|$)/.test(u)) scripts.add(u.split('?')[0])
})

const seedPages = ['/', '/entrar', '/criar-conta', '/recuperar-senha']
const html = {}
for (const p of seedPages) {
  await page.goto(origin + p, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
  html[p] = await page.content()
}

// Arquivos citados dentro dos próprios arquivos (o carregador do Turbopack
// lista os demais pedaços do app, inclusive os das páginas internas).
const fetchText = (u) =>
  page.evaluate(async (u) => {
    try {
      const r = await fetch(u)
      return { status: r.status, text: r.ok ? await r.text() : '' }
    } catch (e) {
      return { status: 0, text: String(e) }
    }
  }, u)

const done = new Map()
const queue = [...scripts]
while (queue.length && done.size < 400) {
  const u = queue.shift()
  if (done.has(u)) continue
  const { status, text } = await fetchText(u)
  done.set(u, { status, size: text.length })
  if (!text) continue
  await writeFile(join(OUT, 'chunks', u.split('/').pop()), text)
  for (const m of text.matchAll(/["'`]((?:\/_next\/)?static\/[^"'`\s]+?\.(?:js|css))["'`]/g)) {
    const path = m[1].startsWith('/') ? m[1] : `/_next/${m[1]}`
    const full = origin + path
    if (!done.has(full)) queue.push(full)
  }
  for (const m of text.matchAll(/["'`](\/_next\/[^"'`\s]+?\.(?:js|css))["'`]/g)) {
    const full = origin + m[1]
    if (!done.has(full)) queue.push(full)
  }
}

// Análise dos textos.
let all = Object.values(html).join('\n')
for (const [u] of done) {
  try {
    all += '\n' + (await readFile(join(OUT, 'chunks', u.split('/').pop()), 'utf8'))
  } catch {}
}

const uniq = (arr) => [...new Set(arr)].sort()
const routes = uniq([...all.matchAll(/["'`](\/[a-z][a-z0-9-]*(?:\/[a-z0-9\-[\]]+)*)["'`]/g)].map((m) => m[1])).filter(
  (r) => !r.startsWith('/_next') && r.length < 60,
)
const urls = uniq([...all.matchAll(/https?:\/\/[a-zA-Z0-9.-]+(?:\/[^\s"'`)\\]*)?/g)].map((m) => m[0].slice(0, 160)))
const env = uniq([...all.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)].map((m) => m[0]))
const apiRoutes = routes.filter((r) => r.startsWith('/api'))
// Textos de interface em português (têm espaço e alguma letra minúscula).
const pt = uniq(
  [...all.matchAll(/(?:children:|["'`])([A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç][^"'`<>{}\\]{3,140}?)["'`]/g)]
    .map((m) => m[1].trim())
    .filter((s) => /\s/.test(s) && /[a-zà-ú]/.test(s) && /[ãõçáéíóúâêô]|\b(de|do|da|para|com|seu|sua|leads?|busca|cliente|empresa|site|whats)\b/i.test(s))
    .filter((s) => !/function|return|=>|\bvar\b|\bconst\b|webpack|turbopack|stack|Error:/.test(s)),
)

// Endereços prováveis: quais existem (protegidos) e quais não.
const guesses = uniq([
  ...routes.filter((r) => !r.startsWith('/api') && !/\.(js|css|png|svg|ico|json)$/.test(r)),
  '/dashboard', '/painel', '/inicio', '/app', '/leads', '/buscar', '/busca', '/pesquisa', '/pesquisar', '/prospectar',
  '/prospeccao', '/listas', '/lista', '/crm', '/funil', '/pipeline', '/campanhas', '/mensagens', '/whatsapp', '/disparos',
  '/configuracoes', '/config', '/conta', '/perfil', '/planos', '/precos', '/assinatura', '/creditos', '/historico',
  '/exportar', '/favoritos', '/salvos', '/integracoes', '/api-keys', '/chaves', '/admin', '/ajuda', '/sites', '/gerar-site',
  '/analise', '/auditoria', '/relatorios', '/mapa', '/nichos', '/cidades', '/templates', '/modelos', '/robots.txt',
  '/sitemap.xml', '/manifest.json', '/manifest.webmanifest', '/termos', '/privacidade',
])
const probes = []
for (const g of guesses.slice(0, 160)) {
  try {
    const r = await ctx.request.get(origin + g, { maxRedirects: 0, timeout: 15000 })
    const loc = r.headers()['location'] || ''
    const body = r.status() === 200 ? (await r.text()).slice(0, 600) : ''
    probes.push({ path: g, status: r.status(), location: loc, sample: /\.(txt|xml|json|webmanifest)$/.test(g) ? body : undefined })
  } catch (e) {
    probes.push({ path: g, error: String(e).slice(0, 120) })
  }
}

const report = {
  start: START,
  files: [...done].map(([u, v]) => ({ url: u.replace(origin, ''), ...v })),
  routes,
  apiRoutes,
  urls,
  env,
  probes,
  textsPt: pt.slice(0, 1500),
}
await writeFile(join(OUT, 'bundle-report.json'), JSON.stringify(report, null, 2))
for (const [p, h] of Object.entries(html)) await writeFile(join(OUT, `html${p.replace(/\//g, '_') || '_root'}.html`), h)
console.log(
  JSON.stringify(
    { files: report.files.length, routes: routes.length, api: apiRoutes, env, probes: probes.filter((p) => p.status !== 404), texts: pt.length },
    null,
    2,
  ),
)
await browser.close()
