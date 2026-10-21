import {
  BarChart3,
  Bell,
  Briefcase,
  Calculator,
  Hammer,
  Palette,
  CalendarClock,
  CheckSquare,
  FileText,
  LayoutDashboard,
  ListOrdered,
  PiggyBank,
  Repeat,
  Settings,
  Users,
  Wallet,
  Contact,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAVIGATION: NavGroup[] = [
  { label: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'CRM',
    items: [
      { to: '/leads', label: 'Leads', icon: Contact },
      { to: '/clientes', label: 'Clientes', icon: Users },
    ],
  },
  {
    label: 'Operação',
    items: [
      { to: '/projetos', label: 'Projetos', icon: Briefcase },
      { to: '/tarefas', label: 'Tarefas', icon: CheckSquare },
    ],
  },
  { label: 'Financeiro', items: [{ to: '/financeiro', label: 'Financeiro', icon: Wallet }] },
  { label: 'Analytics', items: [{ to: '/analytics', label: 'Analytics', icon: BarChart3 }] },
]

export const TOOLS_NAV: NavGroup = { label: 'Ferramentas', items: [{ to: '/calculadoras', label: 'Calculadoras', icon: Calculator }] }

export const SYSTEM_NAV: NavGroup = {
  label: 'Sistema',
  items: [
    { to: '/personalizar', label: 'Personalizar', icon: Palette },
    { to: '/configuracoes', label: 'Configurações', icon: Settings },
  ],
}

/** Menu de um espaço separado (Pessoal, Trabalho...). Empresas têm Serviços. */
export function spaceNavigation(spaceId: string, kind: 'pessoal' | 'empresa'): NavGroup[] {
  const base = `/e/${spaceId}`
  return [
    {
      label: 'Dinheiro',
      items: [
        { to: base, label: 'Resumo', icon: LayoutDashboard },
        ...(kind === 'empresa' ? [{ to: `${base}/servicos`, label: 'Serviços', icon: Hammer }] : []),
        { to: `${base}/movimentacoes`, label: 'Movimentações', icon: ListOrdered },
        { to: `${base}/contas`, label: 'Contas a pagar', icon: CalendarClock },
        { to: `${base}/fixas`, label: 'Contas fixas', icon: Repeat },
        { to: `${base}/carteiras`, label: 'Carteiras', icon: Wallet },
      ],
    },
    {
      label: 'Planejar',
      items: [
        { to: `${base}/planejamento`, label: 'Orçamento e metas', icon: PiggyBank },
        { to: `${base}/relatorio`, label: 'Relatório', icon: FileText },
        { to: `${base}/lembretes`, label: 'Lembretes', icon: Bell },
      ],
    },
  ]
}
