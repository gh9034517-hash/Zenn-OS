// Resumo da semana em texto, para mandar no WhatsApp para quem é dono do
// negócio (quem administra manda; quem recebe entende sem abrir o sistema).
import type { Entry, Job, Space, StockItem } from '@/types'
import { addDays, isLowStock, jobFinance, monthName, monthTotals, ymOf } from '@/services/spaceMath'
import { formatCurrency } from '@/utils/format'

const short = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

export function weeklySummary(space: Space, entries: Entry[], jobs: Job[], stock: StockItem[], today: string): string {
  const mine = entries.filter((e) => e.spaceId === space.id)
  const myJobs = jobs.filter((j) => j.spaceId === space.id)
  const weekEnd = addDays(today, 6)
  const t = monthTotals(mine, ymOf(today))
  const result = space.kind === 'empresa' ? 'Lucro' : 'Sobra'

  const open = mine.filter((e) => e.status === 'pendente' && !e.isTransfer)
  const late = open.filter((e) => e.type === 'despesa' && e.date < today)
  const payWeek = open.filter((e) => e.type === 'despesa' && e.date >= today && e.date <= weekEnd)
  const receiveWeek = open.filter((e) => e.type === 'receita' && e.date <= weekEnd)
  const sum = (rows: Entry[]) => rows.reduce((a, e) => a + Number(e.amount), 0)

  const deliveries = myJobs
    .filter((j) => j.deadline && j.deadline <= weekEnd && j.status !== 'entregue' && j.status !== 'cancelado')
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
  const quotes = myJobs.filter((j) => j.status === 'orcamento')
  const active = myJobs.filter((j) => j.status === 'aprovado' || j.status === 'andamento')
  const owed = myJobs
    .filter((j) => j.status !== 'orcamento' && j.status !== 'cancelado')
    .reduce((a, j) => {
      const f = jobFinance(j, entries)
      return a + f.toReceive + f.notCharged
    }, 0)
  const low = stock.filter((i) => i.spaceId === space.id && isLowStock(i))
  const sheets = stock.filter((i) => i.spaceId === space.id && i.kind === 'chapa').reduce((a, i) => a + Number(i.qty), 0)

  const lines: string[] = [`*Resumo — ${space.name}* (${short(today)} a ${short(weekEnd)})`, '']
  lines.push(`*${monthName(ymOf(today), false)} até agora*`)
  lines.push(`Entrou: ${formatCurrency(t.income)} · Saiu: ${formatCurrency(t.expense)}`)
  lines.push(`${result}: ${formatCurrency(t.forecast)}`)
  lines.push('')

  if (late.length) lines.push(`⚠️ Contas atrasadas: ${late.length} (${formatCurrency(sum(late))})`)
  lines.push(`Para pagar esta semana: ${payWeek.length ? `${payWeek.length} (${formatCurrency(sum(payWeek))})` : 'nada'}`)
  for (const e of payWeek.slice(0, 6)) lines.push(`• ${short(e.date)} ${e.description} — ${formatCurrency(e.amount)}`)
  if (receiveWeek.length) lines.push(`Para receber: ${receiveWeek.length} (${formatCurrency(sum(receiveWeek))})`)

  if (space.kind === 'empresa') {
    lines.push('')
    lines.push(`*Serviços*`)
    lines.push(`Em andamento: ${active.length} · Para fechar: ${quotes.length}${quotes.length ? ` (${formatCurrency(quotes.reduce((a, j) => a + Number(j.value), 0))})` : ''}`)
    if (owed > 0) lines.push(`Clientes devem: ${formatCurrency(owed)}`)
    if (deliveries.length) {
      lines.push(`Entregas até ${short(weekEnd)}:`)
      for (const j of deliveries.slice(0, 8)) lines.push(`• ${short(j.deadline!)} ${j.title}${j.client ? ` (${j.client})` : ''}${j.deadline! < today ? ' — ATRASADO' : ''}`)
    }
    if (stock.some((i) => i.spaceId === space.id)) {
      lines.push('')
      lines.push(`*Estoque*: ${sheets.toLocaleString('pt-BR')} chapas`)
      if (low.length) lines.push(`Acabando: ${low.map((i) => `${i.name} (${Number(i.qty)} ${i.unit})`).join(', ')}`)
    }
  }
  return lines.join('\n')
}
