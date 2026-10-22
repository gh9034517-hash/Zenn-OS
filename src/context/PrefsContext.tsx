// Personalização: nome do sistema, cor de destaque, tamanho da letra,
// página inicial e o que aparece no menu. Fica no aparelho e, com login
// no Supabase, também na conta (vale em todos os aparelhos e cada pessoa
// tem a sua).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getSupabase } from '@/lib/supabase'
import { provider } from '@/services/database'

export type Accent = 'prata' | 'grafite' | 'ouro' | 'cobre' | 'verde' | 'azul'
export type FontScale = 'normal' | 'grande' | 'maior'

export interface Prefs {
  appName: string
  appTagline: string
  accent: Accent
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
  const [hi, lo, ink] = (ACCENTS[p.accent] ?? ACCENTS.prata).colors
  root.style.setProperty('--color-accent', hi)
  root.style.setProperty('--color-accent-2', lo)
  root.style.setProperty('--color-accent-ink', ink)
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
