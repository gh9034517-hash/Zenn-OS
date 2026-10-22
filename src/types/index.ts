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

export type LeadSource = 'google_places' | 'osm' | 'demo' | 'manual' | 'meta'

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

// ------------------------------------------------------------
// Espaços separados (Pessoal, Trabalho...) com finanças próprias.
// Zenn Works é o espaço "embutido" e continua com os modelos acima.
// ------------------------------------------------------------

export type SpaceKind = 'pessoal' | 'empresa'

export interface Space extends BaseRecord {
  name: string
  kind: SpaceKind
  position: number
}

export type WalletKind = 'banco' | 'caixa' | 'cartao' | 'investimento'

export interface Wallet extends BaseRecord {
  spaceId: string
  name: string
  kind: WalletKind
  initialBalance: number
  archived: boolean
}

export interface Entry extends BaseRecord {
  spaceId: string
  type: TransactionType
  description: string
  amount: number
  category: string
  /** vencimento / data do movimento (YYYY-MM-DD) */
  date: string
  status: TransactionStatus
  paidAt: string | null
  walletId: string | null
  method: PaymentMethod
  /** fornecedor, cliente ou pessoa */
  counterparty: string
  notes: string
  recurringId: string | null
  /** liga os dois lados de uma transferência ou de "meu pagamento" */
  linkId: string | null
  /** movimento entre carteiras: mexe no saldo, não é receita nem despesa */
  isTransfer: boolean
  /** "2/10" quando parcelado */
  installment: string | null
  /** serviço (móvel, frete...) a que o lançamento pertence */
  jobId?: string | null
}

export interface Recurring extends BaseRecord {
  spaceId: string
  type: TransactionType
  description: string
  amount: number
  category: string
  /** dia do vencimento (1–31; meses curtos usam o último dia) */
  day: number
  walletId: string | null
  method: PaymentMethod
  counterparty: string
  active: boolean
  /** YYYY-MM */
  startMonth: string
  /** último mês (YYYY-MM) já lançado */
  lastGenerated: string | null
}

export interface Budget extends BaseRecord {
  spaceId: string
  category: string
  monthlyLimit: number
}

export interface Goal extends BaseRecord {
  spaceId: string
  name: string
  target: number
  saved: number
  deadline: string | null
}

export interface Reminder extends BaseRecord {
  spaceId: string
  title: string
  dueDate: string | null
  done: boolean
  notes: string
}

export type JobKind = 'movel' | 'frete' | 'outro'
export type JobStatus = 'orcamento' | 'aprovado' | 'andamento' | 'entregue' | 'cancelado'

/** Serviço de um espaço: um móvel sob medida, um frete... do orçamento à entrega. */
export interface Job extends BaseRecord {
  spaceId: string
  kind: JobKind
  title: string
  client: string
  phone: string | null
  /** endereço de entrega / destino do frete */
  address: string
  description: string
  /** preço combinado com o cliente */
  value: number
  /** custo previsto (material, combustível...) */
  costEstimate: number
  deadline: string | null
  status: JobStatus
  notes: string
  /** etapas do cartão no quadro (cortar, montar, entregar...) */
  checklist: ChecklistItem[]
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export type StockKind = 'chapa' | 'fita' | 'ferragem' | 'outro'

/** Item do estoque: chapa, fita de borda, ferragem... qty é o saldo atual. */
export interface StockItem extends BaseRecord {
  spaceId: string
  name: string
  kind: StockKind
  /** un, m, cx, kg... */
  unit: string
  qty: number
  /** abaixo disso aparece o alerta de estoque baixo */
  minQty: number
  unitCost: number
  supplier: string
  supplierPhone: string | null
  notes: string
}

export type StockReason = 'compra' | 'uso' | 'ajuste' | 'perda'

/** Entrada (+) ou saída (−) do estoque. */
export interface StockMove extends BaseRecord {
  spaceId: string
  itemId: string
  delta: number
  reason: StockReason
  jobId: string | null
  date: string
  note: string
}

export interface Collections {
  leads: Lead
  clients: Client
  projects: Project
  tasks: Task
  transactions: Transaction
  payments: Payment
  activities: Activity
  spaces: Space
  wallets: Wallet
  entries: Entry
  recurrings: Recurring
  budgets: Budget
  goals: Goal
  reminders: Reminder
  jobs: Job
  stock_items: StockItem
  stock_moves: StockMove
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
  source: 'google_places' | 'osm' | 'demo'
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
