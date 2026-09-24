// ============================================================
// ZENN OS — modelos de domínio
// Todos os registros possuem id, createdAt e updatedAt (ISO).
// ============================================================

export interface BaseRecord {
  id: string
  createdAt: string
  updatedAt: string
  /** true quando o registro faz parte do conjunto de dados fictícios */
  isDemo?: boolean
}

export type LeadStatus =
  | 'novo'
  | 'qualificado'
  | 'contatado'
  | 'respondeu'
  | 'negociacao'
  | 'cliente'
  | 'perdido'

export type LeadSource = 'google_places' | 'demo' | 'manual' | 'meta'

export interface Lead extends BaseRecord {
  name: string
  category: string
  address: string
  city: string
  phone: string | null
  rating: number | null
  reviewsCount: number
  website: string | null
  googleMapsUrl: string | null
  facebook: string | null
  instagram: string | null
  status: LeadStatus
  source: LeadSource
  /** id do lugar na API do Google Places (evita duplicidade) */
  placeId: string | null
  notes: string
  clientId: string | null
  lastContactAt: string | null
}

export type ClientStatus = 'ativo' | 'onboarding' | 'pausado' | 'encerrado'

export interface Client extends BaseRecord {
  company: string
  contactName: string
  phone: string | null
  email: string | null
  instagram: string | null
  city: string
  category: string
  status: ClientStatus
  contractedValue: number
  leadId: string | null
  notes: string
}

export type ProjectStatus =
  | 'backlog'
  | 'planejamento'
  | 'desenvolvimento'
  | 'revisao'
  | 'aguardando_cliente'
  | 'concluido'

export type Priority = 'baixa' | 'media' | 'alta' | 'urgente'

export interface Project extends BaseRecord {
  name: string
  clientId: string
  description: string
  value: number
  deadline: string | null
  priority: Priority
  status: ProjectStatus
}

export type TaskStatus = 'a_fazer' | 'em_andamento' | 'concluida'

export interface Task extends BaseRecord {
  projectId: string
  title: string
  description: string
  deadline: string | null
  priority: Priority
  assignee: string
  status: TaskStatus
}

export type TransactionType = 'receita' | 'despesa'
export type TransactionStatus = 'pago' | 'pendente'
export type PaymentMethod = 'pix' | 'boleto' | 'cartao' | 'transferencia' | 'dinheiro'

export interface Transaction extends BaseRecord {
  clientId: string | null
  projectId: string | null
  description: string
  amount: number
  type: TransactionType
  status: TransactionStatus
  /** data de competência / vencimento */
  date: string
  paidAt: string | null
  method: PaymentMethod
}

export interface Payment extends BaseRecord {
  transactionId: string
  clientId: string | null
  amount: number
  method: PaymentMethod
  paidAt: string
}

export type ActivityType =
  | 'lead_created'
  | 'lead_updated'
  | 'lead_status'
  | 'lead_contacted'
  | 'lead_converted'
  | 'lead_deleted'
  | 'client_created'
  | 'client_updated'
  | 'project_created'
  | 'project_status'
  | 'task_created'
  | 'task_completed'
  | 'transaction_created'
  | 'payment_registered'
  | 'system'

export type EntityType = 'lead' | 'client' | 'project' | 'task' | 'transaction' | 'system'

export interface Activity extends BaseRecord {
  type: ActivityType
  message: string
  entityType: EntityType
  entityId: string | null
}

export interface Collections {
  leads: Lead
  clients: Client
  projects: Project
  tasks: Task
  transactions: Transaction
  payments: Payment
  activities: Activity
}

export type CollectionName = keyof Collections

/** Resultado de busca de prospecção (ainda não salvo como lead). */
export interface PlaceResult {
  placeId: string
  name: string
  category: string
  address: string
  city: string
  phone: string | null
  rating: number | null
  reviewsCount: number
  website: string | null
  googleMapsUrl: string | null
  facebook: string | null
  instagram: string | null
  source: 'google_places' | 'demo'
}

export interface SearchParams {
  niche: string
  city: string
  radiusKm: number
}

export interface Session {
  name: string
  email: string
  mode: 'local' | 'supabase'
  startedAt: string
}
