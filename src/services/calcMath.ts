// Contas das calculadoras (porcentagem, gastos, móvel, frete, chapas,
// maquininha, parcelamento). Funções puras: números entram, números saem.

const r2 = (n: number) => Math.round(n * 100) / 100
const ok = (n: number) => Number.isFinite(n)
/** Campo vazio ou inválido conta como zero. */
export const z = (n: number) => (ok(n) ? n : 0)

// ------------------------------------------------------------
// Porcentagem
// ------------------------------------------------------------
export const percentOf = (pct: number, value: number) => r2((value * pct) / 100)
export const whatPercent = (part: number, total: number) => (total ? (part / total) * 100 : NaN)
export const applyPercent = (value: number, pct: number) => ({ up: r2(value * (1 + pct / 100)), down: r2(value * (1 - pct / 100)) })
export const variation = (from: number, to: number) => (from ? ((to - from) / Math.abs(from)) * 100 : NaN)

/** Preço para ter X% de margem sobre a venda (diferente de "custo + X%"). */
export function priceForMargin(cost: number, marginPct: number) {
  if (marginPct >= 100) return NaN
  return r2(cost / (1 - marginPct / 100))
}

// ------------------------------------------------------------
// Gastos: somar despesas de frequências diferentes
// ------------------------------------------------------------
export type Frequency = 'dia' | 'semana' | 'mes' | 'ano'
const PER_MONTH: Record<Frequency, number> = { dia: 30, semana: 52 / 12, mes: 1, ano: 1 / 12 }

export function expensesTotals(rows: { value: number; freq: Frequency }[], people = 1) {
  const month = rows.reduce((a, r) => a + z(r.value) * PER_MONTH[r.freq], 0)
  const n = Math.max(1, Math.floor(z(people)) || 1)
  return { month: r2(month), year: r2(month * 12), day: r2(month / 30), perPerson: r2(month / n) }
}

// ------------------------------------------------------------
// Orçamento de móvel
// ------------------------------------------------------------
export interface FurnitureInput {
  materials: { qty: number; unit: number }[]
  laborHours: number
  hourRate: number
  extras: number
  /** custos da oficina (luz, aluguel, desgaste) sobre o custo direto */
  overheadPct: number
  /** imposto / taxa sobre o preço de venda */
  taxPct: number
  /** lucro desejado sobre o preço de venda */
  marginPct: number
}

export function furniturePrice(i: FurnitureInput) {
  const material = r2(i.materials.reduce((a, m) => a + z(m.qty) * z(m.unit), 0))
  const labor = r2(z(i.laborHours) * z(i.hourRate))
  const extras = r2(z(i.extras))
  const direct = material + labor + extras
  const overhead = r2((direct * z(i.overheadPct)) / 100)
  const cost = r2(direct + overhead)
  const cut = (z(i.taxPct) + z(i.marginPct)) / 100
  const price = cut < 1 ? r2(cost / (1 - cut)) : NaN
  const tax = ok(price) ? r2((price * z(i.taxPct)) / 100) : NaN
  return { material, labor, extras, overhead, cost, price, tax, profit: ok(price) ? r2(price - cost - tax) : NaN, deposit: ok(price) ? r2(price / 2) : NaN }
}

// ------------------------------------------------------------
// Frete
// ------------------------------------------------------------
export interface FreightInput {
  km: number
  roundTrip: boolean
  kmPerLiter: number
  fuelPrice: number
  tolls: number
  helper: number
  /** desgaste do veículo (pneu, óleo, manutenção) por km */
  wearPerKm: number
  hours: number
  hourRate: number
  marginPct: number
  /** opcional: para dar o preço por chapa */
  sheets: number
}

export function freightPrice(i: FreightInput) {
  const km = z(i.km) * (i.roundTrip ? 2 : 1)
  const liters = z(i.kmPerLiter) > 0 ? km / i.kmPerLiter : 0
  const fuel = r2(liters * z(i.fuelPrice))
  const wear = r2(km * z(i.wearPerKm))
  const time = r2(z(i.hours) * z(i.hourRate))
  const cost = r2(fuel + wear + z(i.tolls) + z(i.helper) + time)
  const price = z(i.marginPct) < 100 ? r2(cost / (1 - z(i.marginPct) / 100)) : NaN
  return {
    km,
    liters: r2(liters),
    fuel,
    wear,
    time,
    cost,
    price,
    profit: ok(price) ? r2(price - cost) : NaN,
    perKm: km && ok(price) ? r2(price / km) : NaN,
    perSheet: z(i.sheets) > 0 && ok(price) ? r2(price / i.sheets) : NaN,
  }
}

// ------------------------------------------------------------
// Chapas: quantas preciso (estimativa por área + perda)
// ------------------------------------------------------------
export interface SheetPiece {
  w: number
  h: number
  qty: number
}

export function sheetsNeeded(sheetW: number, sheetH: number, pieces: SheetPiece[], wastePct: number, sheetPrice = 0) {
  const sheetArea = (z(sheetW) * z(sheetH)) / 1e6
  const valid = pieces.filter((p) => z(p.w) > 0 && z(p.h) > 0 && z(p.qty) > 0)
  const area = valid.reduce((a, p) => a + (p.w * p.h * p.qty) / 1e6, 0)
  const withWaste = area * (1 + z(wastePct) / 100)
  const sheets = sheetArea > 0 && area > 0 ? Math.ceil(withWaste / sheetArea - 1e-9) : 0
  // Fita de borda: contorno de todas as peças, com 10% de sobra.
  const edge = valid.reduce((a, p) => a + (2 * (p.w + p.h) * p.qty) / 1000, 0) * 1.1
  // Peça que não cabe na chapa nem girando.
  const tooBig = valid.filter((p) => !((p.w <= sheetW && p.h <= sheetH) || (p.h <= sheetW && p.w <= sheetH)))
  return {
    sheetArea: Math.round(sheetArea * 1000) / 1000,
    area: Math.round(area * 1000) / 1000,
    sheets,
    cost: r2(sheets * z(sheetPrice)),
    edgeMeters: Math.ceil(edge),
    tooBig: tooBig.length,
    usage: sheets ? area / (sheets * sheetArea) : 0,
  }
}

// ------------------------------------------------------------
// Maquininha
// ------------------------------------------------------------
export function cardFee(value: number, feePct: number) {
  const f = z(feePct) / 100
  return {
    youGet: r2(z(value) * (1 - f)),
    fee: r2(z(value) * f),
    /** quanto cobrar para cair exatamente `value` na conta */
    chargeToGet: f < 1 ? r2(z(value) / (1 - f)) : NaN,
  }
}

// ------------------------------------------------------------
// Parcelado ou à vista: juros embutidos no parcelamento
// ------------------------------------------------------------
/** Taxa ao mês que faz n parcelas de `pmt` valerem `pv` hoje (Price). */
export function monthlyRate(pv: number, n: number, pmt: number): number {
  if (!(pv > 0) || !(n >= 1) || !(pmt > 0)) return NaN
  if (pmt * n <= pv + 1e-9) return 0
  let lo = 0
  let hi = 1
  const presentValue = (i: number) => (i === 0 ? pmt * n : (pmt * (1 - (1 + i) ** -n)) / i)
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    if (presentValue(mid) > pv) lo = mid
    else hi = mid
  }
  return ((lo + hi) / 2) * 100
}

export function installmentsVsCash(cash: number, n: number, pmt: number) {
  const total = r2(z(n) * z(pmt))
  return {
    total,
    extra: r2(total - z(cash)),
    extraPct: z(cash) ? ((total - cash) / cash) * 100 : NaN,
    monthly: monthlyRate(z(cash), Math.floor(z(n)), z(pmt)),
  }
}
