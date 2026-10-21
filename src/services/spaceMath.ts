// Cálculos dos espaços (Pessoal, Trabalho...). Funções puras: recebem os
// registros e devolvem números — nada aqui lê ou grava no banco.
import type { Entry, Job, JobKind, JobStatus, Recurring, SpaceKind, TransactionType, Wallet } from '@/types'

// ------------------------------------------------------------
// Datas (sempre no fuso do aparelho, não em UTC)
// ------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, '0')

export function localISO(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** YYYY-MM de uma data YYYY-MM-DD. */
export const ymOf = (date: string) => date.slice(0, 7)

export const currentYM = (d = new Date()) => ymOf(localISO(d))

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + n)
  return localISO(d)
}

/** Dia do vencimento no mês; meses curtos usam o último dia (31 → 28/fev). */
export function dueDateFor(ym: string, day: number): string {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${ym}-${pad(Math.min(Math.max(day, 1), last))}`
}

export function monthName(ym: string, withYear = true): string {
  const [y, m] = ym.split('-').map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', withYear ? { month: 'long', year: 'numeric' } : { month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function monthShort(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()
}

/** Os últimos n meses terminando em `end` (inclusive), do mais antigo ao mais novo. */
export function monthsEnding(end: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addMonths(end, i - (n - 1)))
}

// ------------------------------------------------------------
// Contas fixas
// ------------------------------------------------------------

/** Até onde as fixas já aparecem: o mês de daqui a 15 dias (assim a conta
 *  do dia 5 aparece em "próximos dias" ainda no fim do mês anterior). */
export const recurringHorizon = (today = localISO()) => ymOf(addDays(today, 15))

/** Meses que ainda faltam lançar para uma conta fixa, em ordem. */
export function monthsToGenerate(r: Pick<Recurring, 'active' | 'startMonth' | 'lastGenerated'>, horizon: string): string[] {
  if (!r.active) return []
  let next = r.lastGenerated ? addMonths(r.lastGenerated, 1) : r.startMonth
  if (next < r.startMonth) next = r.startMonth
  const out: string[] = []
  // Limite de segurança: no máximo 24 meses de uma vez.
  while (next <= horizon && out.length < 24) {
    out.push(next)
    next = addMonths(next, 1)
  }
  return out
}

/** Id fixo por conta+mês: dois aparelhos abrindo ao mesmo tempo não duplicam. */
export const recurringEntryId = (recurringId: string, ym: string) => `ent_${recurringId}_${ym}`

// ------------------------------------------------------------
// Totais
// ------------------------------------------------------------
const sum = (rows: Entry[]) => Math.round(rows.reduce((acc, e) => acc + Number(e.amount), 0) * 100) / 100

/** Receita ou despesa de verdade (transferência entre carteiras não conta). */
export const countsAsResult = (e: Entry) => !e.isTransfer

export const isEntryOverdue = (e: Entry, today = localISO()) => e.status === 'pendente' && e.date < today

export function monthTotals(entries: Entry[], ym: string) {
  const rows = entries.filter((e) => countsAsResult(e) && ymOf(e.date) === ym)
  const inc = rows.filter((e) => e.type === 'receita')
  const out = rows.filter((e) => e.type === 'despesa')
  const income = sum(inc)
  const incomePaid = sum(inc.filter((e) => e.status === 'pago'))
  const expense = sum(out)
  const expensePaid = sum(out.filter((e) => e.status === 'pago'))
  return {
    income,
    incomePaid,
    expense,
    expensePaid,
    /** realizado: o que entrou menos o que saiu de fato */
    profit: Math.round((incomePaid - expensePaid) * 100) / 100,
    /** previsto: contando o que ainda vai entrar e sair no mês */
    forecast: Math.round((income - expense) * 100) / 100,
    toReceive: Math.round((income - incomePaid) * 100) / 100,
    toPay: Math.round((expense - expensePaid) * 100) / 100,
    count: rows.length,
  }
}

export type MonthTotals = ReturnType<typeof monthTotals>

export function walletBalance(wallet: Wallet, entries: Entry[]): number {
  const rows = entries.filter((e) => e.walletId === wallet.id && e.status === 'pago')
  const delta = rows.reduce((acc, e) => acc + (e.type === 'receita' ? 1 : -1) * Number(e.amount), 0)
  return Math.round((Number(wallet.initialBalance) + delta) * 100) / 100
}

export function categoryBreakdown(entries: Entry[], ym: string, type: TransactionType) {
  const map = new Map<string, number>()
  for (const e of entries) {
    if (!countsAsResult(e) || e.type !== type || ymOf(e.date) !== ym) continue
    const key = e.category || 'Sem categoria'
    map.set(key, (map.get(key) ?? 0) + Number(e.amount))
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
}

export function monthlySeries(entries: Entry[], months: string[]) {
  return months.map((ym) => {
    const t = monthTotals(entries, ym)
    return { ym, label: monthShort(ym), receitas: t.income, despesas: t.expense, lucro: t.forecast }
  })
}

/** Divide um total em n parcelas em centavos; a diferença fica na primeira. */
export function splitInstallments(total: number, n: number): number[] {
  const cents = Math.round(total * 100)
  const base = Math.floor(cents / n)
  const rest = cents - base * n
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? rest : 0)) / 100)
}

/** Lê valores digitados do jeito brasileiro: "1.234,56", "1234,5", "R$ 80", "80.5". */
export function parseMoney(input: string): number {
  let s = input.replace(/[^\d.,-]/g, '')
  if (!s) return NaN
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if ((s.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}

// ------------------------------------------------------------
// Categorias sugeridas (o campo aceita qualquer texto)
// ------------------------------------------------------------
export const DEFAULT_CATEGORIES: Record<SpaceKind, Record<TransactionType, string[]>> = {
  empresa: {
    receita: ['Móveis sob medida', 'Fretes', 'Serviços', 'Vendas', 'Outras receitas'],
    despesa: [
      'Chapas e madeira',
      'Ferragens e acessórios',
      'Fita de borda e cola',
      'Combustível',
      'Manutenção do veículo',
      'Ajudante / diárias',
      'Ferramentas e máquinas',
      'Aluguel',
      'Água, luz e internet',
      'Salários',
      'Impostos e taxas',
      'Fornecedores / mercadoria',
      'Tarifas bancárias',
      'Marketing',
      'Outras despesas',
    ],
  },
  pessoal: {
    receita: ['Salário', 'Zenn Works', 'Freelas', 'Rendimentos', 'Outras entradas'],
    despesa: [
      'Moradia',
      'Alimentação',
      'Transporte',
      'Saúde',
      'Lazer',
      'Educação',
      'Assinaturas',
      'Compras',
      'Contas da casa',
      'Outros gastos',
    ],
  },
}

export function categorySuggestions(kind: SpaceKind, type: TransactionType, entries: Entry[]): string[] {
  const used = entries.filter((e) => e.type === type && e.category && !e.isTransfer).map((e) => e.category)
  return [...new Set([...DEFAULT_CATEGORIES[kind][type], ...used])]
}

/** Palavras que mudam conforme o tipo de espaço. */
export function spaceWords(kind: SpaceKind) {
  return kind === 'empresa'
    ? { in: 'Receita', ins: 'Receitas', out: 'Despesa', outs: 'Despesas', result: 'Lucro', counterparty: 'Fornecedor ou cliente' }
    : { in: 'Entrada', ins: 'Entradas', out: 'Gasto', outs: 'Gastos', result: 'Sobra', counterparty: 'Quem / onde' }
}

// ------------------------------------------------------------
// Serviços (móveis, fretes...)
// ------------------------------------------------------------
export const JOB_KIND_LABEL: Record<JobKind, string> = { movel: 'Móvel', frete: 'Frete', outro: 'Outro serviço' }

/** Etapas na ordem; "andamento" muda de nome conforme o tipo. */
export const JOB_FLOW: JobStatus[] = ['orcamento', 'aprovado', 'andamento', 'entregue']

export function jobStatusLabel(status: JobStatus, kind: JobKind): string {
  switch (status) {
    case 'orcamento':
      return 'Orçamento'
    case 'aprovado':
      return 'Aprovado'
    case 'andamento':
      return kind === 'frete' ? 'Agendado' : 'Em produção'
    case 'entregue':
      return 'Entregue'
    case 'cancelado':
      return 'Cancelado'
  }
}

/** Próxima etapa (null quando já entregue ou cancelado). */
export function nextJobStatus(status: JobStatus): JobStatus | null {
  const i = JOB_FLOW.indexOf(status)
  return i >= 0 && i < JOB_FLOW.length - 1 ? JOB_FLOW[i + 1] : null
}

/** Dinheiro de um serviço, a partir dos lançamentos ligados a ele. */
export function jobFinance(job: Pick<Job, 'id' | 'value' | 'costEstimate'>, entries: Entry[]) {
  const mine = entries.filter((e) => e.jobId === job.id && !e.isTransfer)
  const sumOf = (rows: Entry[]) => Math.round(rows.reduce((a, e) => a + Number(e.amount), 0) * 100) / 100
  const received = sumOf(mine.filter((e) => e.type === 'receita' && e.status === 'pago'))
  const toReceive = sumOf(mine.filter((e) => e.type === 'receita' && e.status === 'pendente'))
  const costs = sumOf(mine.filter((e) => e.type === 'despesa'))
  const value = Number(job.value)
  // Sem custo lançado ainda, usa o custo previsto para estimar o lucro.
  const costBasis = costs > 0 ? costs : Number(job.costEstimate)
  return {
    value,
    received,
    toReceive,
    /** quanto do preço combinado ainda nem foi lançado como "a receber" */
    notCharged: Math.max(0, Math.round((value - received - toReceive) * 100) / 100),
    costs,
    costIsEstimate: costs === 0 && Number(job.costEstimate) > 0,
    profit: Math.round((value - costBasis) * 100) / 100,
    margin: value > 0 ? (value - costBasis) / value : 0,
    paidRatio: value > 0 ? Math.min(1, received / value) : 0,
    entries: mine,
  }
}
