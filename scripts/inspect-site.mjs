// Inspeção de um site de referência: abre num Chrome real, registra textos,
// campos, botões, links internos e as chamadas de rede (que revelam de onde
// vêm os dados), e tira prints no celular e no computador.
// Uso: node scripts/inspect-site.mjs <url> <pasta-de-saída>
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const START = process.argv[2]
const OUT = process.argv[3] || 'inspect-out'
await mkdir(OUT, { recursive: true })

const origin = new URL(START).origin
const browser = await chromium.launch()
const report = { start: START, pages: [], requests: [], console: [] }

async function inspect(url, label, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'pt-BR' })
  const page = await ctx.newPage()
  page.on('request', (r) => {
    const u = r.url()
    if (!/\.(png|jpe?g|webp|gif|svg|woff2?|ttf|ico)(\?|$)/i.test(u)) {
      report.requests.push({ page: label, method: r.method(), url: u.slice(0, 300), type: r.resourceType(), post: (r.postData() || '').slice(0, 400) })
    }
  })
  page.on('console', (m) => report.console.push(`[${label}] ${m.type()}: ${m.text().slice(0, 200)}`))
  let status = null
  try {
    const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
    status = res?.status() ?? null
  } catch (e) {
    report.pages.push({ label, url, error: String(e).slice(0, 300) })
    await ctx.close()
    return []
  }
  await page.waitForTimeout(2500)
  const info = await page.evaluate(() => {
    const txt = (el) => (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 120)
    return {
      title: document.title,
      text: document.body.innerText.replace(/\n{3,}/g, '\n\n').slice(0, 20000),
      headings: [...document.querySelectorAll('h1,h2,h3,h4')].map((h) => `${h.tagName}: ${txt(h)}`),
      buttons: [...document.querySelectorAll('button,[role=button],a.btn,input[type=submit]')].map(txt).filter(Boolean),
      inputs: [...document.querySelectorAll('input,select,textarea')].map((i) => ({
        tag: i.tagName.toLowerCase(),
        type: i.getAttribute('type'),
        name: i.getAttribute('name'),
        placeholder: i.getAttribute('placeholder'),
        label: i.id ? document.querySelector(`label[for="${i.id}"]`)?.innerText?.trim() : null,
        options: i.tagName === 'SELECT' ? [...i.options].map((o) => o.text).slice(0, 40) : undefined,
      })),
      links: [...document.querySelectorAll('a[href]')].map((a) => ({ text: txt(a), href: a.href })).slice(0, 80),
      scripts: [...document.querySelectorAll('script[src]')].map((s) => s.src),
    }
  })
  report.pages.push({ label, url, status, ...info })
  await page.screenshot({ path: join(OUT, `${label}.jpg`), fullPage: true, type: 'jpeg', quality: 60 })
  await ctx.close()
  return info.links.map((l) => l.href).filter((h) => h.startsWith(origin))
}

const desktop = { width: 1366, height: 900 }
const mobile = { width: 390, height: 844 }
const internal = await inspect(START, 'home-desktop', desktop)
await inspect(START, 'home-mobile', mobile)

// Páginas internas (sem âncoras repetidas), até 10.
const seen = new Set([START.replace(/\/$/, '')])
let n = 0
for (const href of internal) {
  const clean = href.split('#')[0].replace(/\/$/, '')
  if (seen.has(clean) || n >= 10) continue
  seen.add(clean)
  n++
  await inspect(href, `page-${n}-desktop`, desktop)
}

await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ pages: report.pages.map((p) => ({ label: p.label, url: p.url, status: p.status, title: p.title, error: p.error })), requests: report.requests.length }, null, 2))
await browser.close()
