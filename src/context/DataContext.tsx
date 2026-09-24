// Estado global sincronizado com a camada de persistência.
// Toda mutação grava no banco, registra atividade quando relevante
// e recarrega o snapshot — dashboard, CRM e financeiro ficam sempre
// consistentes.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as db from '@/services/database'
import type {
  Activity,
  Client,
  Lead,
  LeadStatus,
  PaymentMethod,
  PlaceResult,
  Project,
  ProjectStatus,
  Task,
  Transaction,
} from '@/types'
import { generateDemoData } from '@/data/demo'
import { LEAD_STATUS_LABEL, PROJECT_STATUS_LABEL } from '@/data/constants'
import { formatCurrency } from '@/utils/format'

type Snapshot = db.Snapshot

const EMPTY: Snapshot = {
  leads: [],
  clients: [],
  projects: [],
  tasks: [],
  transactions: [],
  payments: [],
  activities: [],
}

interface DataContextValue extends Snapshot {
  loading: boolean
  error: string | null
  providerName: 'local' | 'supabase'
  hasDemoData: boolean
  refresh: () => Promise<void>

  // Leads
  saveLeadFromPlace: (place: PlaceResult) => Promise<Lead>
  findLeadByPlace: (placeId: string) => Lead | undefined
  createLead: (data: db.NewRecord<Lead>) => Promise<Lead>
  updateLead: (id: string, patch: Partial<Lead>) => Promise<Lead>
  setLeadStatus: (id: string, status: LeadStatus) => Promise<Lead>
  registerContact: (id: string, channel: string) => Promise<Lead>
  deleteLead: (id: string) => Promise<void>
  convertLeadToClient: (leadId: string, extra?: Partial<Client>) => Promise<Client>

  // Clientes
  createClient: (data: db.NewRecord<Client>) => Promise<Client>
  updateClient: (id: string, patch: Partial<Client>) => Promise<Client>

  // Projetos / tarefas
  createProject: (data: db.NewRecord<Project>, addToContract?: boolean) => Promise<Project>
  updateProject: (id: string, patch: Partial<Project>) => Promise<Project>
  setProjectStatus: (id: string, status: ProjectStatus) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  createTask: (data: db.NewRecord<Task>) => Promise<Task>
  updateTask: (id: string, patch: Partial<Task>) => Promise<Task>
  deleteTask: (id: string) => Promise<void>

  // Financeiro
  createTransaction: (data: db.NewRecord<Transaction>) => Promise<Transaction>
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<Transaction>
  deleteTransaction: (id: string) => Promise<void>
  markTransactionPaid: (id: string, method?: PaymentMethod) => Promise<Transaction>
  registerPayment: (input: {
    clientId: string | null
    projectId: string | null
    amount: number
    method: PaymentMethod
    description: string
    date: string
  }) => Promise<Transaction>

  // Dados
  seedDemo: () => Promise<void>
  clearDemo: () => Promise<void>
  resetAll: () => Promise<void>
  logActivity: (data: Omit<db.NewRecord<Activity>, 'isDemo'>) => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

// Garante que a semente demo rode uma única vez (StrictMode executa efeitos 2x).
let seeding: Promise<void> | null = null
function ensureSeeded() {
  if (!seeding) {
    seeding = (async () => {
      if (db.provider.name === 'local' && !db.isSeeded()) {
        db.markSeeded()
        await db.importSnapshot(generateDemoData())
      }
    })()
  }
  return seeding
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setSnap(await db.loadAll())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  // Carga inicial + semente demo na primeira execução (somente localStorage)
  useEffect(() => {
    ;(async () => {
      try {
        await ensureSeeded()
        await refresh()
      } finally {
        setLoading(false)
      }
    })()
  }, [refresh])

  // Sincroniza entre abas do navegador
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith(db.STORAGE_PREFIX_KEY)) void refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const logActivity = useCallback(async (data: Omit<db.NewRecord<Activity>, 'isDemo'>) => {
    await db.createActivity(data)
  }, [])

  const value = useMemo<DataContextValue>(() => {
    const findLeadByPlace = (placeId: string) => snap.leads.find((l) => l.placeId === placeId)

    const withRefresh =
      <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
      async (...args: A) => {
        const result = await fn(...args)
        await refresh()
        return result
      }

    const saveLeadFromPlaceRaw = async (place: PlaceResult) => {
      const existing = (await db.getLeads()).find((l) => l.placeId === place.placeId)
      if (existing) return existing
      const lead = await db.createLead({
        name: place.name,
        category: place.category,
        address: place.address,
        city: place.city,
        phone: place.phone,
        rating: place.rating,
        reviewsCount: place.reviewsCount,
        website: place.website,
        googleMapsUrl: place.googleMapsUrl,
        facebook: place.facebook,
        instagram: place.instagram,
        status: 'novo',
        source: place.source,
        placeId: place.placeId,
        notes: '',
        clientId: null,
        lastContactAt: null,
        isDemo: place.source === 'demo',
      })
      await logActivity({
        type: 'lead_created',
        message: `Lead ${lead.name} salvo via ${place.source === 'demo' ? 'busca DEMO' : 'Google Places'}`,
        entityType: 'lead',
        entityId: lead.id,
      })
      return lead
    }

    const setLeadStatusRaw = async (id: string, status: LeadStatus) => {
      const current = (await db.getLeads()).find((l) => l.id === id)
      const lead = await db.updateLead(id, {
        status,
        ...(status === 'contatado' && !current?.lastContactAt ? { lastContactAt: new Date().toISOString() } : {}),
      })
      if (current?.status !== status) {
        await logActivity({
          type: 'lead_status',
          message: `${lead.name}: ${LEAD_STATUS_LABEL[current?.status ?? 'novo']} → ${LEAD_STATUS_LABEL[status]}`,
          entityType: 'lead',
          entityId: id,
        })
      }
      return lead
    }

    const convertRaw = async (leadId: string, extra: Partial<Client> = {}) => {
      const lead = (await db.getLeads()).find((l) => l.id === leadId)
      if (!lead) throw new Error('Lead não encontrado')
      if (lead.clientId) {
        const existing = (await db.getClients()).find((c) => c.id === lead.clientId)
        if (existing) return existing
      }
      const client = await db.createClient({
        company: lead.name,
        contactName: '',
        phone: lead.phone,
        email: null,
        instagram: lead.instagram,
        city: lead.city,
        category: lead.category,
        status: 'onboarding',
        contractedValue: 0,
        leadId: lead.id,
        notes: lead.notes,
        isDemo: lead.isDemo,
        ...extra,
      })
      await db.updateLead(lead.id, { status: 'cliente', clientId: client.id })
      await logActivity({
        type: 'lead_converted',
        message: `${lead.name} convertido em cliente`,
        entityType: 'client',
        entityId: client.id,
      })
      return client
    }

    const createProjectRaw = async (data: db.NewRecord<Project>, addToContract = true) => {
      const project = await db.createProject(data)
      if (addToContract && project.value > 0) {
        const client = (await db.getClients()).find((c) => c.id === project.clientId)
        if (client) await db.updateClient(client.id, { contractedValue: client.contractedValue + project.value })
      }
      await logActivity({
        type: 'project_created',
        message: `Projeto ${project.name} criado`,
        entityType: 'project',
        entityId: project.id,
      })
      return project
    }

    const updateTaskRaw = async (id: string, patch: Partial<Task>) => {
      const before = (await db.getTasks()).find((t) => t.id === id)
      const task = await db.updateTask(id, patch)
      if (patch.status === 'concluida' && before?.status !== 'concluida') {
        await logActivity({ type: 'task_completed', message: `Tarefa concluída: ${task.title}`, entityType: 'task', entityId: id })
      }
      return task
    }

    const markPaidRaw = async (id: string, method?: PaymentMethod) => {
      const trx = (await db.getTransactions()).find((t) => t.id === id)
      if (!trx) throw new Error('Transação não encontrada')
      const paidAt = new Date().toISOString()
      const updated = await db.updateTransaction(id, { status: 'pago', paidAt, method: method ?? trx.method })
      if (trx.type === 'receita') {
        await db.createPayment({
          transactionId: id,
          clientId: trx.clientId,
          amount: trx.amount,
          method: method ?? trx.method,
          paidAt,
          isDemo: trx.isDemo,
        })
        await logActivity({
          type: 'payment_registered',
          message: `Pagamento de ${formatCurrency(trx.amount)} recebido — ${trx.description}`,
          entityType: 'transaction',
          entityId: id,
        })
      }
      return updated
    }

    const registerPaymentRaw: DataContextValue['registerPayment'] = async (input) => {
      const paidAt = new Date(`${input.date}T12:00:00`).toISOString()
      const trx = await db.createTransaction({
        clientId: input.clientId,
        projectId: input.projectId,
        description: input.description,
        amount: input.amount,
        type: 'receita',
        status: 'pago',
        date: input.date,
        paidAt,
        method: input.method,
      })
      await db.createPayment({
        transactionId: trx.id,
        clientId: input.clientId,
        amount: input.amount,
        method: input.method,
        paidAt,
      })
      await logActivity({
        type: 'payment_registered',
        message: `Pagamento de ${formatCurrency(input.amount)} registrado — ${input.description}`,
        entityType: 'transaction',
        entityId: trx.id,
      })
      return trx
    }

    return {
      ...snap,
      loading,
      error,
      providerName: db.provider.name,
      hasDemoData: Object.values(snap).some((rows) => rows.some((r) => r.isDemo)),
      refresh,
      findLeadByPlace,

      saveLeadFromPlace: withRefresh(saveLeadFromPlaceRaw),
      createLead: withRefresh(async (data: db.NewRecord<Lead>) => {
        const lead = await db.createLead(data)
        await logActivity({ type: 'lead_created', message: `Lead ${lead.name} cadastrado`, entityType: 'lead', entityId: lead.id })
        return lead
      }),
      updateLead: withRefresh(db.updateLead),
      setLeadStatus: withRefresh(setLeadStatusRaw),
      registerContact: withRefresh(async (id: string, channel: string) => {
        const lead = (await db.getLeads()).find((l) => l.id === id)
        if (!lead) throw new Error('Lead não encontrado')
        const rank = ['novo', 'qualificado'].includes(lead.status)
        const updated = await db.updateLead(id, {
          lastContactAt: new Date().toISOString(),
          ...(rank ? { status: 'contatado' as const } : {}),
        })
        await logActivity({ type: 'lead_contacted', message: `Contato com ${lead.name} via ${channel}`, entityType: 'lead', entityId: id })
        return updated
      }),
      deleteLead: withRefresh(async (id: string) => {
        const lead = snap.leads.find((l) => l.id === id)
        await db.deleteLead(id)
        await logActivity({ type: 'lead_deleted', message: `Lead ${lead?.name ?? ''} removido`, entityType: 'lead', entityId: null })
      }),
      convertLeadToClient: withRefresh(convertRaw),

      createClient: withRefresh(async (data: db.NewRecord<Client>) => {
        const client = await db.createClient(data)
        await logActivity({ type: 'client_created', message: `Cliente ${client.company} cadastrado`, entityType: 'client', entityId: client.id })
        return client
      }),
      updateClient: withRefresh(db.updateClient),

      createProject: withRefresh(createProjectRaw),
      updateProject: withRefresh(db.updateProject),
      setProjectStatus: withRefresh(async (id: string, status: ProjectStatus) => {
        const before = snap.projects.find((p) => p.id === id)
        const project = await db.updateProject(id, { status })
        if (before?.status !== status) {
          await logActivity({
            type: 'project_status',
            message: `${project.name}: ${PROJECT_STATUS_LABEL[status]}`,
            entityType: 'project',
            entityId: id,
          })
        }
        return project
      }),
      deleteProject: withRefresh(async (id: string) => {
        for (const t of snap.tasks.filter((t) => t.projectId === id)) await db.deleteTask(t.id)
        await db.deleteProject(id)
      }),
      createTask: withRefresh(async (data: db.NewRecord<Task>) => {
        const task = await db.createTask(data)
        await logActivity({ type: 'task_created', message: `Tarefa criada: ${task.title}`, entityType: 'task', entityId: task.id })
        return task
      }),
      updateTask: withRefresh(updateTaskRaw),
      deleteTask: withRefresh(db.deleteTask),

      createTransaction: withRefresh(async (data: db.NewRecord<Transaction>) => {
        const trx = await db.createTransaction(data)
        if (trx.type === 'receita' && trx.status === 'pago') {
          await db.createPayment({ transactionId: trx.id, clientId: trx.clientId, amount: trx.amount, method: trx.method, paidAt: trx.paidAt ?? new Date().toISOString() })
        }
        await logActivity({
          type: 'transaction_created',
          message: `${trx.type === 'receita' ? 'Receita' : 'Despesa'} lançada: ${trx.description} (${formatCurrency(trx.amount)})`,
          entityType: 'transaction',
          entityId: trx.id,
        })
        return trx
      }),
      updateTransaction: withRefresh(db.updateTransaction),
      deleteTransaction: withRefresh(db.deleteTransaction),
      markTransactionPaid: withRefresh(markPaidRaw),
      registerPayment: withRefresh(registerPaymentRaw),

      seedDemo: withRefresh(async () => {
        await db.clearDemoData()
        await db.importSnapshot(generateDemoData())
        db.markSeeded()
      }),
      clearDemo: withRefresh(db.clearDemoData),
      resetAll: withRefresh(async () => {
        await db.clearAll()
        db.markSeeded()
      }),
      logActivity: withRefresh(logActivity),
    }
  }, [snap, loading, error, refresh, logActivity])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData deve ser usado dentro de <DataProvider>')
  return ctx
}
