import { useMemo } from 'react'
import { useData } from '@/context/DataContext'
import { activeProjects, financeSummary, leadFunnel } from '@/utils/metrics'
import { lastMonths, monthKey, monthLabel } from '@/utils/format'
import { PROJECT_STATUSES } from '@/data/constants'
import { hasNoWebsite } from '@/services/googlePlaces'

/** Métricas consolidadas para Dashboard e Analytics. */
export function useMetrics(months = 6) {
  const { leads, clients, projects, transactions } = useData()

  return useMemo(() => {
    const funnel = leadFunnel(leads)
    const finance = financeSummary(transactions)
    const keys = lastMonths(months)

    const leadsByMonth = keys.map((key) => {
      const monthLeads = leads.filter((l) => monthKey(l.createdAt) === key)
      return {
        key,
        label: monthLabel(key),
        leads: monthLeads.length,
        semSite: monthLeads.filter((l) => hasNoWebsite(l.website)).length,
        clientes: clients.filter((c) => monthKey(c.createdAt) === key).length,
      }
    })

    const revenueByMonth = keys.map((key) => {
      const rows = transactions.filter((t) => monthKey(t.date) === key)
      const sum = (f: (t: (typeof rows)[number]) => boolean) =>
        rows.filter(f).reduce((acc, t) => acc + t.amount, 0)
      return {
        key,
        label: monthLabel(key),
        recebido: sum((t) => t.type === 'receita' && t.status === 'pago'),
        pendente: sum((t) => t.type === 'receita' && t.status === 'pendente'),
        despesas: sum((t) => t.type === 'despesa'),
      }
    })

    const conversionByMonth = leadsByMonth.map((m) => ({
      label: m.label,
      taxa: m.leads ? m.clientes / m.leads : 0,
    }))

    const projectsByStatus = PROJECT_STATUSES.map((s) => ({
      label: s.label,
      id: s.id,
      total: projects.filter((p) => p.status === s.id).length,
    }))

    const paidIncome = transactions.filter((t) => t.type === 'receita' && t.status === 'pago')
    const payingClients = new Set(paidIncome.map((t) => t.clientId).filter(Boolean)).size
    const averageTicket = clients.length
      ? clients.reduce((acc, c) => acc + c.contractedValue, 0) / clients.length
      : 0

    return {
      funnel,
      finance,
      leadsByMonth,
      revenueByMonth,
      conversionByMonth,
      projectsByStatus,
      clientsCount: clients.length,
      activeProjectsCount: activeProjects(projects).length,
      conversionRate: funnel.total ? funnel.clients / funnel.total : 0,
      averageTicket,
      payingClients,
    }
  }, [leads, clients, projects, transactions, months])
}
