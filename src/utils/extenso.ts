// Valor em reais por extenso, para recibos: 1250.5 → "mil duzentos e
// cinquenta reais e cinquenta centavos".

const UNITS = [
  '',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
]
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const HUNDREDS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function upTo999(n: number): string {
  if (n === 100) return 'cem'
  const parts: string[] = []
  const h = Math.floor(n / 100)
  const r = n % 100
  if (h) parts.push(HUNDREDS[h])
  if (r) {
    if (r < 20) parts.push(UNITS[r])
    else parts.push(r % 10 ? `${TENS[Math.floor(r / 10)]} e ${UNITS[r % 10]}` : TENS[Math.floor(r / 10)])
  }
  return parts.join(' e ')
}

function wholeNumber(n: number): string {
  if (n === 0) return 'zero'
  const groups: { value: number; text: string }[] = []
  const billions = Math.floor(n / 1e9)
  const millions = Math.floor(n / 1e6) % 1000
  const thousands = Math.floor(n / 1000) % 1000
  const rest = n % 1000
  if (billions) groups.push({ value: billions, text: billions === 1 ? 'um bilhão' : `${upTo999(billions)} bilhões` })
  if (millions) groups.push({ value: millions, text: millions === 1 ? 'um milhão' : `${upTo999(millions)} milhões` })
  if (thousands) groups.push({ value: thousands, text: thousands === 1 ? 'mil' : `${upTo999(thousands)} mil` })
  if (rest) groups.push({ value: rest, text: upTo999(rest) })
  if (groups.length === 1) return groups[0].text
  const last = groups.pop()!
  // "mil e cem", "dois mil e cinco", mas "mil duzentos e cinquenta".
  const joiner = last.value < 100 || last.value % 100 === 0 ? ' e ' : ' '
  return groups.map((g) => g.text).join(' ') + joiner + last.text
}

export function valorPorExtenso(value: number): string {
  const total = Math.round(Math.abs(value) * 100)
  const reais = Math.floor(total / 100)
  const centavos = total % 100
  const parts: string[] = []
  if (reais) {
    const exactMillions = reais >= 1e6 && reais % 1e6 === 0
    parts.push(`${wholeNumber(reais)} ${exactMillions ? 'de reais' : reais === 1 ? 'real' : 'reais'}`)
  }
  if (centavos) parts.push(`${upTo999(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  return parts.length ? parts.join(' e ') : 'zero reais'
}
