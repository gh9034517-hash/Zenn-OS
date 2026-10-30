// Personalização: nome do sistema, tema, cores, fonte, cantos, fundo, estilo
// dos painéis, tamanho da letra, página inicial e o que aparece no menu. Fica no aparelho e, com login
// no Supabase, também na conta (vale em todos os aparelhos e cada pessoa
// tem a sua).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getSupabase } from '@/lib/supabase'
import { provider } from '@/services/database'

export type Accent = 'prata' | 'grafite' | 'ouro' | 'cobre' | 'verde' | 'azul' | 'rosa' | 'violeta' | 'turquesa'
export type FontScale = 'normal' | 'grande' | 'maior'
export type ThemeId = 'original' | 'meia-noite' | 'esmeralda' | 'vinho' | 'ametista' | 'cafe' | 'oceano' | 'por-do-sol' | 'concreto'
export type FontId = 'padrao' | 'sistema' | 'moderna' | 'suave' | 'elegante' | 'tecnica'
export type RadiusId = 'reto' | 'normal' | 'redondo'
export type BackgroundId = 'liso' | 'grade' | 'pontos' | 'aurora'
export type PanelId = 'vidro' | 'solido' | 'contorno' | 'brilho'

export interface Prefs {
  appName: string
  appTagline: string
  accent: Accent
  /** cor de destaque escolhida à mão (#rrggbb); vazio = usa a cor da lista */
  accentCustom: string
  theme: ThemeId
  font: FontId
  radius: RadiusId
  background: BackgroundId
  panel: PanelId
  fontScale: FontScale
  /** rota aberta ao entrar: /geral, / (Zenn Works) ou /e/<espaço> */
  homePage: string
  hideZenn: boolean
  hiddenSpaces: string[]
  startHidden: boolean
  reduceMotion: boolean
  /** dados que saem no orçamento e no recibo */
  businessName: string
  businessPhone: string
  businessCity: string
  businessDoc: string
  /** WhatsApp de quem recebe o "resumo da semana" (ex.: o dono do negócio) */
  reportPhone: string
}

export const DEFAULT_PREFS: Prefs = {
  appName: 'ZENN OS',
  appTagline: 'Zenn Works',
  accent: 'prata',
  accentCustom: '',
  theme: 'original',
  font: 'padrao',
  radius: 'normal',
  background: 'liso',
  panel: 'vidro',
  fontScale: 'normal',
  homePage: '/geral',
  hideZenn: false,
  hiddenSpaces: [],
  startHidden: false,
  reduceMotion: false,
  businessName: '',
  businessPhone: '',
  businessCity: '',
  businessDoc: '',
  reportPhone: '',
}

/** Cores de destaque: sempre metálicas, nada de neon. [claro, escuro, texto em cima] */
export const ACCENTS: Record<Accent, { label: string; colors: [string, string, string] }> = {
  prata: { label: 'Prata', colors: ['#f4f4f2', '#c9c9ce', '#050505'] },
  grafite: { label: 'Grafite', colors: ['#c4c6cd', '#878a94', '#050505'] },
  ouro: { label: 'Ouro escovado', colors: ['#efdcae', '#bf964d', '#1a1206'] },
  cobre: { label: 'Cobre', colors: ['#eec2a0', '#b06c3c', '#1c0e05'] },
  verde: { label: 'Verde musgo', colors: ['#cfe1c4', '#7c9f70', '#0b1408'] },
  azul: { label: 'Azul aço', colors: ['#cddbee', '#7b99bf', '#07101c'] },
  rosa: { label: 'Rosa vinho', colors: ['#f2c4cc', '#c0566b', '#1f060b'] },
  violeta: { label: 'Violeta', colors: ['#dccbff', '#8f6ad8', '#12082a'] },
  turquesa: { label: 'Turquesa', colors: ['#bff2ee', '#3fb5ae', '#03171a'] },
}

export type ThemeVar = 'void' | 'ink' | 'surface' | 'raised' | 'elevated' | 'fg' | 'fg-soft' | 'muted' | 'faint'
const THEME_VARS: ThemeVar[] = ['void', 'ink', 'surface', 'raised', 'elevated', 'fg', 'fg-soft', 'muted', 'faint']

/** Temas: paletas escuras completas. O "original" é o padrão do sistema. */
export const THEMES: Record<ThemeId, { label: string; tag: string; accent: Accent; vars: Record<ThemeVar, string> }> = {
  original: {
    label: 'Original',
    tag: 'O padrão',
    accent: 'prata',
    vars: { void: '#030303', ink: '#070708', surface: '#0b0b0d', raised: '#111114', elevated: '#17171b', fg: '#f4f4f2', 'fg-soft': '#c9c9cc', muted: '#85858b', faint: '#55555b' },
  },
  'meia-noite': {
    label: 'Meia-noite',
    tag: 'Azul profundo',
    accent: 'azul',
    vars: { void: '#040712', ink: '#070b1a', surface: '#0b1124', raised: '#111a33', elevated: '#18233f', fg: '#eef3ff', 'fg-soft': '#c3cde6', muted: '#8591b0', faint: '#566180' },
  },
  esmeralda: {
    label: 'Esmeralda',
    tag: 'Verde floresta',
    accent: 'verde',
    vars: { void: '#030806', ink: '#06100c', surface: '#0a1712', raised: '#10231b', elevated: '#173026', fg: '#eefaf3', 'fg-soft': '#c4dacd', muted: '#85a091', faint: '#587061' },
  },
  vinho: {
    label: 'Vinho',
    tag: 'Bordô elegante',
    accent: 'rosa',
    vars: { void: '#0a0305', ink: '#12060a', surface: '#1a0a10', raised: '#251017', elevated: '#31161f', fg: '#fbefef', 'fg-soft': '#e2c4c8', muted: '#aa858b', faint: '#7a575d' },
  },
  ametista: {
    label: 'Ametista',
    tag: 'Roxo noturno',
    accent: 'violeta',
    vars: { void: '#07040d', ink: '#0d0716', surface: '#140c22', raised: '#1d1330', elevated: '#281a40', fg: '#f5f0ff', 'fg-soft': '#d3c7ee', muted: '#9a8cb8', faint: '#6c5f88' },
  },
  cafe: {
    label: 'Café',
    tag: 'Marrom quente',
    accent: 'ouro',
    vars: { void: '#090604', ink: '#0f0a07', surface: '#17100b', raised: '#21160f', elevated: '#2d1f15', fg: '#f8efe4', 'fg-soft': '#dcccb8', muted: '#a8937c', faint: '#78664f' },
  },
  oceano: {
    label: 'Oceano',
    tag: 'Verde-água',
    accent: 'turquesa',
    vars: { void: '#030a0b', ink: '#061416', surface: '#0a1e21', raised: '#102a2e', elevated: '#17383d', fg: '#ecfbfb', 'fg-soft': '#bfdcdc', muted: '#7fa4a6', faint: '#547476' },
  },
  'por-do-sol': {
    label: 'Pôr do sol',
    tag: 'Brasa e cobre',
    accent: 'cobre',
    vars: { void: '#0b0504', ink: '#130806', surface: '#1d0e0a', raised: '#2a140e', elevated: '#381c13', fg: '#fff1e8', 'fg-soft': '#f0cdb8', muted: '#b88f7b', faint: '#86614f' },
  },
  concreto: {
    label: 'Concreto',
    tag: 'Cinza mais claro',
    accent: 'grafite',
    vars: { void: '#0c0d10', ink: '#121317', surface: '#181a1f', raised: '#20232a', elevated: '#292d35', fg: '#f2f3f5', 'fg-soft': '#c9ccd3', muted: '#8b909b', faint: '#5d626d' },
  },
}

/** Fontes. As do Google carregam só quando escolhidas. */
export const FONTS: Record<FontId, { label: string; stack: string; google?: string }> = {
  padrao: { label: 'Padrão', stack: "'Inter Tight', ui-sans-serif, system-ui, sans-serif" },
  sistema: { label: 'Do aparelho', stack: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" },
  moderna: { label: 'Moderna', stack: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif", google: 'Space+Grotesk:wght@400;500;600;700' },
  suave: { label: 'Suave', stack: "'Nunito', ui-sans-serif, system-ui, sans-serif", google: 'Nunito:wght@400;500;600;700;800' },
  elegante: { label: 'Elegante', stack: "'Fraunces', Georgia, serif", google: 'Fraunces:wght@400;500;600;700' },
  tecnica: { label: 'Técnica', stack: "'JetBrains Mono', ui-monospace, monospace" },
}

const RADIUS_SCALE: Record<RadiusId, number> = { reto: 0.2, normal: 1, redondo: 1.7 }
const RADIUS_PX: Record<string, number> = { sm: 4, md: 6, lg: 8, xl: 14, '2xl': 20, '3xl': 24 }

export function ensureFont(id: FontId) {
  const g = FONTS[id]?.google
  if (!g || typeof document === 'undefined') return
  const key = `zenn-font-${id}`
  if (document.getElementById(key)) return
  const link = document.createElement('link')
  link.id = key
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${g}&display=swap`
  document.head.appendChild(link)
}

const EXTRA_CSS = String.raw`
html[data-bg='grade'] body::before,html[data-bg='pontos'] body::before,html[data-bg='aurora'] body::before{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none}
html[data-bg='grade'] body::before{background-image:linear-gradient(rgb(255 255 255 / .035) 1px,transparent 1px),linear-gradient(90deg,rgb(255 255 255 / .035) 1px,transparent 1px);background-size:48px 48px}
html[data-bg='pontos'] body::before{background-image:radial-gradient(rgb(255 255 255 / .1) 1px,transparent 1.3px);background-size:22px 22px}
html[data-bg='aurora'] body::before{background-image:radial-gradient(60rem 38rem at 12% -8%,color-mix(in srgb,var(--color-accent-2) 28%,transparent),transparent 62%),radial-gradient(46rem 32rem at 100% 6%,color-mix(in srgb,var(--color-accent) 12%,transparent),transparent 60%),radial-gradient(50rem 40rem at 50% 118%,color-mix(in srgb,var(--color-accent-2) 18%,transparent),transparent 62%)}
html:is([data-bg='grade'],[data-bg='pontos'],[data-bg='aurora']) #root>div{background-color:transparent}
html[data-panel='solido'] .panel{background:var(--color-surface)}
html:is([data-panel='solido'],[data-panel='contorno']) .panel::before{display:none}
html[data-panel='contorno'] .panel{background:transparent;border-color:var(--color-line-strong)}
html[data-panel='brilho'] .panel{box-shadow:0 0 0 1px color-mix(in srgb,var(--color-accent-2) 24%,transparent),0 20px 44px -22px color-mix(in srgb,var(--color-accent-2) 55%,transparent)}
html:not([data-theme='original']) .from-\[\#1a1a1e\]{--tw-gradient-from:var(--color-elevated)}
html:not([data-theme='original']) .hover\:bg-\[\#1c1c21\]:hover{background-color:var(--color-elevated)}
`

function ensureExtraCss() {
  if (document.getElementById('zenn-theme-css')) return
  const el = document.createElement('style')
  el.id = 'zenn-theme-css'
  el.textContent = EXTRA_CSS
  document.head.appendChild(el)
}

const HEX = /^#[0-9a-f]{6}$/i
function rgbOf(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}
function hexOf(c: number[]) {
  return '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}
/** Cor escolhida à mão: o destaque é a própria cor, o tom escuro sai dela. */
function customAccent(hex: string): [string, string, string] {
  const c = rgbOf(hex)
  const lo = hexOf(c.map((v) => v * 0.62))
  const lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255
  return [hex.toLowerCase(), lo, lum > 0.55 ? '#0a0a0c' : '#ffffff']
}

const FONT: Record<FontScale, string> = { normal: '100%', grande: '112.5%', maior: '125%' }
const KEY = 'zenn-os:prefs'

function readLocal(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

function apply(p: Prefs) {
  const root = document.documentElement
  ensureExtraCss()

  // tema: o original usa o CSS de fábrica
  const themeId: ThemeId = THEMES[p.theme] ? p.theme : 'original'
  const theme = THEMES[themeId]
  for (const k of THEME_VARS) {
    if (themeId === 'original') root.style.removeProperty(`--color-${k}`)
    else root.style.setProperty(`--color-${k}`, theme.vars[k])
  }
  root.dataset.theme = themeId
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.vars.void)

  // cor de destaque
  const [hi, lo, ink] = HEX.test(p.accentCustom) ? customAccent(p.accentCustom) : (ACCENTS[p.accent] ?? ACCENTS.prata).colors
  root.style.setProperty('--color-accent', hi)
  root.style.setProperty('--color-accent-2', lo)
  root.style.setProperty('--color-accent-ink', ink)

  // fonte
  const fontId: FontId = FONTS[p.font] ? p.font : 'padrao'
  if (fontId === 'padrao') root.style.removeProperty('--font-sans')
  else root.style.setProperty('--font-sans', FONTS[fontId].stack)
  ensureFont(fontId)

  // cantos
  const scale = RADIUS_SCALE[p.radius] ?? 1
  for (const [name, px] of Object.entries(RADIUS_PX)) {
    if (scale === 1) root.style.removeProperty(`--radius-${name}`)
    else root.style.setProperty(`--radius-${name}`, `${(px * scale).toFixed(1)}px`)
  }

  root.dataset.bg = p.background ?? 'liso'
  root.dataset.panel = p.panel ?? 'vidro'
  root.style.fontSize = FONT[p.fontScale] ?? '100%'
  root.dataset.reduceMotion = p.reduceMotion ? '1' : '0'
  document.title = p.appName.trim() || DEFAULT_PREFS.appName
}

// Antes da primeira tela: sem "piscar" a cor padrão.
const initial = readLocal()
apply(initial)
if (initial.startHidden) document.documentElement.dataset.hideValues = '1'

interface PrefsValue {
  prefs: Prefs
  update: (patch: Partial<Prefs>) => void
  reset: () => void
}

const PrefsContext = createContext<PrefsValue | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Com login: a preferência guardada na conta vale mais que a do aparelho.
  useEffect(() => {
    if (provider.name !== 'supabase') return
    const sb = getSupabase()
    if (!sb) return
    const load = (fromAccount: unknown) => {
      if (!fromAccount || typeof fromAccount !== 'object') return
      const next = { ...DEFAULT_PREFS, ...(fromAccount as Partial<Prefs>) }
      setPrefs(next)
      apply(next)
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* armazenamento indisponível */
      }
    }
    void sb.auth.getSession().then(({ data }) => load(data.session?.user.user_metadata?.prefs))
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') load(session?.user.user_metadata?.prefs)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const save = useCallback((next: Prefs) => {
    setPrefs(next)
    apply(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* armazenamento indisponível */
    }
    // Na conta: espera a pessoa parar de mexer para gravar uma vez só.
    const sb = provider.name === 'supabase' ? getSupabase() : null
    if (!sb) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void sb.auth.updateUser({ data: { prefs: next } })
    }, 800)
  }, [])

  const value = useMemo<PrefsValue>(
    () => ({
      prefs,
      update: (patch) => save({ ...prefs, ...patch }),
      reset: () => save(DEFAULT_PREFS),
    }),
    [prefs, save],
  )

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs() {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs deve ser usado dentro de <PrefsProvider>')
  return ctx
}
