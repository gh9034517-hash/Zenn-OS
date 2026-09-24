import {
  BarChart3,
  Briefcase,
  CheckSquare,
  LayoutDashboard,
  Radar,
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
    label: 'Prospecção',
    items: [
      { to: '/prospeccao', label: 'Encontrar Leads', icon: Radar },
      { to: '/leads', label: 'Leads', icon: Contact },
    ],
  },
  { label: 'CRM', items: [{ to: '/clientes', label: 'Clientes', icon: Users }] },
  {
    label: 'Operação',
    items: [
      { to: '/projetos', label: 'Projetos', icon: Briefcase },
      { to: '/tarefas', label: 'Tarefas', icon: CheckSquare },
    ],
  },
  { label: 'Financeiro', items: [{ to: '/financeiro', label: 'Financeiro', icon: Wallet }] },
  { label: 'Analytics', items: [{ to: '/analytics', label: 'Analytics', icon: BarChart3 }] },
  { label: 'Sistema', items: [{ to: '/configuracoes', label: 'Configurações', icon: Settings }] },
]
