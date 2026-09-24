import type {
  ClientStatus,
  LeadStatus,
  PaymentMethod,
  Priority,
  ProjectStatus,
  TaskStatus,
} from '@/types'

export const LEAD_STATUSES: { id: LeadStatus; label: string }[] = [
  { id: 'novo', label: 'Novo' },
  { id: 'qualificado', label: 'Qualificado' },
  { id: 'contatado', label: 'Contatado' },
  { id: 'respondeu', label: 'Respondeu' },
  { id: 'negociacao', label: 'Negociação' },
  { id: 'cliente', label: 'Cliente' },
  { id: 'perdido', label: 'Perdido' },
]

export const LEAD_STATUS_LABEL = Object.fromEntries(
  LEAD_STATUSES.map((s) => [s.id, s.label]),
) as Record<LeadStatus, string>

/** Ordem do funil comercial (perdido fica fora). */
export const LEAD_STAGE_RANK: Record<LeadStatus, number> = {
  novo: 0,
  qualificado: 1,
  contatado: 2,
  respondeu: 3,
  negociacao: 4,
  cliente: 5,
  perdido: -1,
}

export const PROJECT_STATUSES: { id: ProjectStatus; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'planejamento', label: 'Planejamento' },
  { id: 'desenvolvimento', label: 'Desenvolvimento' },
  { id: 'revisao', label: 'Revisão' },
  { id: 'aguardando_cliente', label: 'Aguardando cliente' },
  { id: 'concluido', label: 'Concluído' },
]

export const PROJECT_STATUS_LABEL = Object.fromEntries(
  PROJECT_STATUSES.map((s) => [s.id, s.label]),
) as Record<ProjectStatus, string>

export const TASK_STATUSES: { id: TaskStatus; label: string }[] = [
  { id: 'a_fazer', label: 'A fazer' },
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'concluida', label: 'Concluída' },
]

export const TASK_STATUS_LABEL = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.id, s.label]),
) as Record<TaskStatus, string>

export const PRIORITIES: { id: Priority; label: string }[] = [
  { id: 'baixa', label: 'Baixa' },
  { id: 'media', label: 'Média' },
  { id: 'alta', label: 'Alta' },
  { id: 'urgente', label: 'Urgente' },
]

export const PRIORITY_LABEL = Object.fromEntries(PRIORITIES.map((p) => [p.id, p.label])) as Record<
  Priority,
  string
>

export const PRIORITY_WEIGHT: Record<Priority, number> = { baixa: 1, media: 2, alta: 3, urgente: 4 }

export const CLIENT_STATUSES: { id: ClientStatus; label: string }[] = [
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'ativo', label: 'Ativo' },
  { id: 'pausado', label: 'Pausado' },
  { id: 'encerrado', label: 'Encerrado' },
]

export const CLIENT_STATUS_LABEL = Object.fromEntries(
  CLIENT_STATUSES.map((s) => [s.id, s.label]),
) as Record<ClientStatus, string>

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'pix', label: 'PIX' },
  { id: 'boleto', label: 'Boleto' },
  { id: 'cartao', label: 'Cartão' },
  { id: 'transferencia', label: 'Transferência' },
  { id: 'dinheiro', label: 'Dinheiro' },
]

export const PAYMENT_METHOD_LABEL = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.id, m.label]),
) as Record<PaymentMethod, string>
