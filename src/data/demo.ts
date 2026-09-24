// ============================================================
// DADOS DEMO — fictícios, gerados de forma determinística.
// Todos os registros recebem isDemo: true e podem ser removidos
// em Configurações > Dados.
// ============================================================

import type {
  Activity,
  Client,
  ClientStatus,
  Lead,
  LeadStatus,
  PaymentMethod,
  Priority,
  Project,
  ProjectStatus,
  Task,
  TaskStatus,
  Transaction,
} from '@/types'
import { seededRandom } from '@/utils/id'
import type { Snapshot } from '@/services/database'

const DAY = 86_400_000

export const DEMO_CATEGORIES = [
  { category: 'Pizzaria', names: ['Forno di Nonna', 'Bella Massa', 'Pizza Nostra', 'Don Vito', 'Casa da Pizza', 'Margherita 1920'] },
  { category: 'Barbearia', names: ['Navalha de Ouro', 'Barber Kings', 'Old School Barber', 'Corte Fino'] },
  { category: 'Clínica Odontológica', names: ['Sorriso Pleno', 'OdontoVida', 'Clínica Dental Prime'] },
  { category: 'Pet Shop', names: ['Mundo Pet', 'Patas & Cia', 'Bicho Feliz', 'Au Au Center'] },
  { category: 'Academia', names: ['Iron Gym', 'Corpo em Forma', 'Evolution Fit'] },
  { category: 'Salão de Beleza', names: ['Studio Glamour', 'Espaço Bella', 'Charme Hair', 'Donna Salão'] },
  { category: 'Hamburgueria', names: ['Brasa Burger', 'Smash House', 'Black Grill', 'Burger Station'] },
  { category: 'Oficina Mecânica', names: ['Auto Center Silva', 'Mecânica Precisão', 'Turbo Car'] },
  { category: 'Padaria', names: ['Pão Nosso', 'Panificadora Trigo Bom', 'Doce Aroma', 'Padaria Real'] },
  { category: 'Estúdio de Tatuagem', names: ['Ink Lab', 'Tinta Negra', 'Black Needle', 'Traço Fino', 'Studio Ágora'] },
]

export const DEMO_CITIES = [
  'Campinas',
  'Campinas',
  'Campinas',
  'Valinhos',
  'Vinhedo',
  'Sumaré',
  'Hortolândia',
  'Jundiaí',
  'Americana',
  'Paulínia',
]

export const DEMO_STREETS = [
  'Av. Norte-Sul',
  'Rua Barão de Jaguara',
  'Av. Francisco Glicério',
  'Rua José Paulino',
  'Av. Orosimbo Maia',
  'Rua Coronel Quirino',
  'Av. Moraes Salles',
  'Rua Conceição',
  'Av. Brasil',
  'Rua Maria Monteiro',
  'Av. Júlio de Mesquita',
  'Rua Sampainho',
]

const CONTACTS = [
  'Marcos Almeida', 'Juliana Costa', 'Ricardo Nunes', 'Fernanda Lima', 'Paulo Henrique',
  'Camila Rocha', 'André Souza', 'Beatriz Martins', 'Rafael Oliveira', 'Larissa Freitas',
]

const TEAM = ['Você', 'Ana Ribeiro', 'Lucas Prado', 'Marina Teles']

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')

export function generateDemoData(now = Date.now()): Snapshot {
  const rand = seededRandom(20260924)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString()
  const dateOnly = (msOffset: number) => new Date(now + msOffset).toISOString().slice(0, 10)

  // ---------------- LEADS (40) ----------------
  const pool = DEMO_CATEGORIES.flatMap((c) => c.names.map((n) => ({ name: n, category: c.category })))
  // 10 status "cliente" para casar com os clientes convertidos (7) + distribuição do funil
  const statusPlan: LeadStatus[] = [
    ...Array<LeadStatus>(7).fill('cliente'),
    ...Array<LeadStatus>(11).fill('novo'),
    ...Array<LeadStatus>(6).fill('qualificado'),
    ...Array<LeadStatus>(6).fill('contatado'),
    ...Array<LeadStatus>(4).fill('respondeu'),
    ...Array<LeadStatus>(3).fill('negociacao'),
    ...Array<LeadStatus>(3).fill('perdido'),
  ]

  const leads: Lead[] = pool.slice(0, 40).map((p, i) => {
    const city = i < 6 && p.category === 'Pizzaria' ? 'Campinas' : pick(DEMO_CITIES)
    const created = int(1, 175) * DAY + int(0, 20) * 3_600_000
    // ~65% sem site para testar o filtro SEM SITE
    const hasSite = rand() > 0.65
    const s = slug(p.name)
    const status = statusPlan[i]
    return {
      id: `demo_lead_${String(i + 1).padStart(2, '0')}`,
      createdAt: iso(created),
      updatedAt: iso(Math.max(created - int(0, 10) * DAY, 0)),
      isDemo: true,
      name: p.name,
      category: p.category,
      address: `${pick(DEMO_STREETS)}, ${int(40, 2900)}`,
      city,
      phone: rand() > 0.1 ? `(19) 9${int(8000, 9999)}-${int(1000, 9999)}` : null,
      rating: Math.round((3.4 + rand() * 1.6) * 10) / 10,
      reviewsCount: int(4, 1400),
      website: hasSite ? `https://www.${s}.com.br` : null,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${city}`)}`,
      facebook: rand() > 0.5 ? `https://facebook.com/${s}` : null,
      instagram: rand() > 0.3 ? `@${s}` : null,
      status,
      source: 'demo',
      placeId: `demo_place_${s}`,
      notes: '',
      clientId: null,
      lastContactAt: ['contatado', 'respondeu', 'negociacao', 'cliente'].includes(status)
        ? iso(Math.max(created - int(1, 20) * DAY, DAY))
        : null,
    }
  })

  // ---------------- CLIENTES (10) ----------------
  const clientStatuses: ClientStatus[] = ['ativo', 'ativo', 'ativo', 'ativo', 'onboarding', 'ativo', 'pausado', 'ativo', 'onboarding', 'encerrado']
  const convertedLeads = leads.filter((l) => l.status === 'cliente')
  const direct = [
    { name: 'Vértice Arquitetura', category: 'Escritório de Arquitetura', city: 'Campinas' },
    { name: 'Nobre Imóveis', category: 'Imobiliária', city: 'Valinhos' },
    { name: 'Kairós Advocacia', category: 'Escritório de Advocacia', city: 'Campinas' },
  ]
  const clients: Client[] = []
  convertedLeads.forEach((lead, i) => {
    const id = `demo_client_${String(i + 1).padStart(2, '0')}`
    lead.clientId = id
    clients.push({
      id,
      createdAt: lead.lastContactAt ?? lead.createdAt,
      updatedAt: lead.lastContactAt ?? lead.createdAt,
      isDemo: true,
      company: lead.name,
      contactName: CONTACTS[i],
      phone: lead.phone,
      email: `contato@${slug(lead.name)}.com.br`,
      instagram: lead.instagram,
      city: lead.city,
      category: lead.category,
      status: clientStatuses[i],
      contractedValue: 0,
      leadId: lead.id,
      notes: '',
    })
  })
  direct.forEach((d, j) => {
    const i = convertedLeads.length + j
    const created = iso(int(20, 160) * DAY)
    clients.push({
      id: `demo_client_${String(i + 1).padStart(2, '0')}`,
      createdAt: created,
      updatedAt: created,
      isDemo: true,
      company: d.name,
      contactName: CONTACTS[i],
      phone: `(19) 9${int(8000, 9999)}-${int(1000, 9999)}`,
      email: `contato@${slug(d.name)}.com.br`,
      instagram: `@${slug(d.name)}`,
      city: d.city,
      category: d.category,
      status: clientStatuses[i],
      contractedValue: 0,
      leadId: null,
      notes: '',
    })
  })

  // ---------------- PROJETOS (8) ----------------
  const projectDefs: { name: string; desc: string; value: number; status: ProjectStatus; priority: Priority }[] = [
    { name: 'Site institucional', desc: 'Site one-page com cardápio digital e integração WhatsApp.', value: 3800, status: 'desenvolvimento', priority: 'alta' },
    { name: 'Identidade visual', desc: 'Logo, paleta, tipografia e manual de marca.', value: 2900, status: 'revisao', priority: 'media' },
    { name: 'Landing page de agendamento', desc: 'Página de conversão com agenda online.', value: 2400, status: 'planejamento', priority: 'alta' },
    { name: 'E-commerce', desc: 'Loja virtual com catálogo e checkout.', value: 8900, status: 'desenvolvimento', priority: 'urgente' },
    { name: 'Google Meu Negócio + SEO local', desc: 'Otimização de perfil e presença local.', value: 1600, status: 'concluido', priority: 'baixa' },
    { name: 'Site + blog', desc: 'Site institucional com blog gerenciável.', value: 5200, status: 'aguardando_cliente', priority: 'media' },
    { name: 'Redesign do site', desc: 'Nova interface, performance e acessibilidade.', value: 4600, status: 'backlog', priority: 'media' },
    { name: 'Sistema de pedidos', desc: 'Pedidos online com painel administrativo.', value: 7400, status: 'concluido', priority: 'alta' },
  ]
  const projectClients = [0, 1, 2, 3, 4, 7, 8, 5]
  const projects: Project[] = projectDefs.map((d, i) => {
    const client = clients[projectClients[i]]
    const created = new Date(client.createdAt).getTime() + int(1, 6) * DAY
    return {
      id: `demo_project_${i + 1}`,
      createdAt: new Date(Math.min(created, now - DAY)).toISOString(),
      updatedAt: new Date(Math.min(created, now - DAY)).toISOString(),
      isDemo: true,
      name: `${d.name} — ${client.company}`,
      clientId: client.id,
      description: d.desc,
      value: d.value,
      deadline: dateOnly((d.status === 'concluido' ? -int(5, 40) : int(-4, 45)) * DAY),
      priority: d.priority,
      status: d.status,
    }
  })
  // valor contratado = soma dos projetos do cliente (+ um recorrente em alguns)
  clients.forEach((c) => {
    const sum = projects.filter((p) => p.clientId === c.id).reduce((acc, p) => acc + p.value, 0)
    c.contractedValue = sum > 0 ? sum : c.status === 'encerrado' ? 1200 : 1800
  })

  // ---------------- TAREFAS (30) ----------------
  const taskTitles = [
    'Briefing com o cliente', 'Wireframe das páginas', 'Definir paleta e tipografia', 'Layout desktop',
    'Layout mobile', 'Desenvolver componentes', 'Integração WhatsApp', 'Configurar domínio e DNS',
    'Copywriting da home', 'Otimizar imagens', 'Testes em dispositivos', 'Revisão com cliente',
    'Configurar Google Analytics', 'Publicação', 'Treinamento do cliente',
  ]
  const tasks: Task[] = Array.from({ length: 30 }, (_, i) => {
    const project = projects[i % projects.length]
    const done = project.status === 'concluido' || rand() < 0.35
    const status: TaskStatus = done ? 'concluida' : rand() < 0.45 ? 'em_andamento' : 'a_fazer'
    const created = new Date(project.createdAt).getTime() + int(0, 5) * DAY
    return {
      id: `demo_task_${String(i + 1).padStart(2, '0')}`,
      createdAt: new Date(Math.min(created, now - 3_600_000)).toISOString(),
      updatedAt: new Date(Math.min(created, now - 3_600_000)).toISOString(),
      isDemo: true,
      projectId: project.id,
      title: taskTitles[(i * 7) % taskTitles.length],
      description: '',
      deadline: dateOnly(int(-10, 30) * DAY),
      priority: pick<Priority>(['baixa', 'media', 'media', 'alta', 'urgente']),
      assignee: pick(TEAM),
      status,
    }
  })

  // ---------------- TRANSAÇÕES (30) ----------------
  const methods: PaymentMethod[] = ['pix', 'pix', 'pix', 'boleto', 'cartao', 'transferencia']
  const transactions: Transaction[] = []
  // 20 receitas vinculadas a projetos/clientes
  for (let i = 0; i < 20; i++) {
    const project = projects[i % projects.length]
    const offset = int(-165, 25) * DAY
    const date = dateOnly(offset)
    const isPast = offset < 0
    const paid = isPast ? rand() < 0.78 : false
    const parcel = Math.round((project.value / (i < 16 ? 2 : 3)) / 10) * 10
    transactions.push({
      id: `demo_trx_${String(i + 1).padStart(2, '0')}`,
      createdAt: new Date(now + Math.min(offset, 0) - DAY).toISOString(),
      updatedAt: new Date(now + Math.min(offset, 0) - DAY).toISOString(),
      isDemo: true,
      clientId: project.clientId,
      projectId: project.id,
      description: `${i < 8 ? 'Entrada' : 'Parcela'} — ${project.name.split(' — ')[0]}`,
      amount: parcel,
      type: 'receita',
      status: paid ? 'pago' : 'pendente',
      date,
      paidAt: paid ? new Date(`${date}T15:00:00`).toISOString() : null,
      method: pick(methods),
    })
  }
  // 10 despesas operacionais
  const expenses = [
    ['Hospedagem e servidores', 320], ['Licenças de software', 480], ['Domínios', 140], ['Anúncios Meta Ads', 900],
    ['Banco de imagens', 190], ['Freelancer — ilustração', 1200], ['Coworking', 850], ['Contabilidade', 450],
    ['Equipamentos', 2100], ['Ferramentas de IA', 260],
  ] as const
  expenses.forEach(([desc, amount], j) => {
    const offset = int(-160, 10) * DAY
    const date = dateOnly(offset)
    const paid = offset < 0
    transactions.push({
      id: `demo_trx_${String(21 + j).padStart(2, '0')}`,
      createdAt: new Date(now + Math.min(offset, 0) - DAY).toISOString(),
      updatedAt: new Date(now + Math.min(offset, 0) - DAY).toISOString(),
      isDemo: true,
      clientId: null,
      projectId: null,
      description: desc,
      amount,
      type: 'despesa',
      status: paid ? 'pago' : 'pendente',
      date,
      paidAt: paid ? new Date(`${date}T10:00:00`).toISOString() : null,
      method: pick(methods),
    })
  })

  // ---------------- PAGAMENTOS (derivados das receitas pagas) ----------------
  const payments = transactions
    .filter((t) => t.type === 'receita' && t.status === 'pago')
    .map((t) => ({
      id: `demo_pay_${t.id.slice(-2)}`,
      createdAt: t.paidAt!,
      updatedAt: t.paidAt!,
      isDemo: true,
      transactionId: t.id,
      clientId: t.clientId,
      amount: t.amount,
      method: t.method,
      paidAt: t.paidAt!,
    }))

  // ---------------- ATIVIDADES ----------------
  const activities: Activity[] = []
  const act = (a: Omit<Activity, 'id' | 'updatedAt' | 'isDemo'>) =>
    activities.push({ ...a, id: `demo_act_${activities.length + 1}`, updatedAt: a.createdAt, isDemo: true })
  leads.forEach((l) =>
    act({ type: 'lead_created', message: `Lead ${l.name} adicionado`, entityType: 'lead', entityId: l.id, createdAt: l.createdAt }),
  )
  clients.forEach((c) =>
    act({
      type: c.leadId ? 'lead_converted' : 'client_created',
      message: c.leadId ? `${c.company} convertido em cliente` : `Cliente ${c.company} cadastrado`,
      entityType: 'client',
      entityId: c.id,
      createdAt: c.createdAt,
    }),
  )
  projects.forEach((p) =>
    act({ type: 'project_created', message: `Projeto ${p.name} criado`, entityType: 'project', entityId: p.id, createdAt: p.createdAt }),
  )
  payments.forEach((p) =>
    act({
      type: 'payment_registered',
      message: `Pagamento de R$ ${p.amount.toLocaleString('pt-BR')} recebido`,
      entityType: 'transaction',
      entityId: p.transactionId,
      createdAt: p.paidAt,
    }),
  )
  activities.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return { leads, clients, projects, tasks, transactions, payments, activities: activities.slice(0, 60) }
}
