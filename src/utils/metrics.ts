// Cálculos derivados — sempre a partir dos dados armazenados.
import type { Client, Lead, Project, Task, Transaction } from '@/types'
import { LEAD_STAGE_RANK } from '@/data/constants'
import { hasNoWebsite } from '@/services/googlePlaces'
import { todayISO } from './format'

export const isOverdue = (t: Transaction) =>
  t.status === 'pendente' && t.date < todayISO()

export function financeSummary(transactions: Transaction[]) {
  const income = transactions.filter((t) => t.type === 'receita')
  const expense = transactions.filter((t) => t.type === 'despesa')
  const sum = (rows: Transaction[]) => rows.reduce((acc, t) => acc + t.amount, 0)
  const received = sum(income.filter((t) => t.status === 'pago'))
  const overdue = sum(income.filter(isOverdue))
  const pending = sum(income.filter((t) => t.status === 'pendente' && !isOverdue(t)))
  const expensesTotal = sum(expense)
  const expensesPaid = sum(expense.filter((t) => t.status === 'pago'))
  return {
    revenueTotal: sum(income),
    received,
    pending,
    overdue,
    expenses: expensesTotal,
    expensesPaid,
    profit: received - expensesPaid,
  }
}

export function clientFinance(client: Client, transactions: Transaction[]) {
  const received = transactions
    .filter((t) => t.clientId === client.id && t.type === 'receita' && t.status === 'pago')
    .reduce((acc, t) => acc + t.amount, 0)
  return {
    contracted: client.contractedValue,
    received,
    pending: Math.max(client.contractedValue - received, 0),
  }
}

export function projectProgress(projectId: string, tasks: Task[]) {
  const list = tasks.filter((t) => t.projectId === projectId)
  if (!list.length) return { total: 0, done: 0, progress: 0 }
  const done = list.filter((t) => t.status === 'concluida').length
  return { total: list.length, done, progress: done / list.length }
}

export function leadFunnel(leads: Lead[]) {
  const reached = (rank: number) =>
    leads.filter((l) => l.status !== 'perdido' && LEAD_STAGE_RANK[l.status] >= rank).length
  return {
    total: leads.length,
    withoutSite: leads.filter((l) => hasNoWebsite(l.website)).length,
    qualified: reached(1),
    contacted: reached(2),
    responded: reached(3),
    negotiating: reached(4),
    clients: reached(5),
    lost: leads.filter((l) => l.status === 'perdido').length,
  }
}

export const activeProjects = (projects: Project[]) =>
  projects.filter((p) => p.status !== 'concluido')
