const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const num = new Intl.NumberFormat('pt-BR')

export const formatCurrency = (value: number) => brl.format(value || 0)
export const formatCurrencyCompact = (value: number) => brlCompact.format(value || 0)
export const formatNumber = (value: number) => num.format(value || 0)
export const formatPercent = (value: number, digits = 1) =>
  `${(Number.isFinite(value) ? value * 100 : 0).toFixed(digits).replace('.', ',')}%`

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function formatRelative(value: string): string {
  const diff = Date.now() - new Date(value).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  if (d < 30) return `há ${d} d`
  return formatDate(value)
}

export const todayISO = () => new Date().toISOString().slice(0, 10)

export function monthKey(value: string): string {
  return value.slice(0, 7)
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '')
    .toUpperCase()
}

/** Últimos N meses (inclui o atual) no formato YYYY-MM. */
export function lastMonths(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/** Link do WhatsApp (assume Brasil quando não há DDI). */
export function whatsappLink(phone: string | null, text = ''): string | null {
  const digits = onlyDigits(phone)
  if (digits.length < 10) return null
  const full = digits.startsWith('55') && digits.length > 11 ? digits : `55${digits}`
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}
