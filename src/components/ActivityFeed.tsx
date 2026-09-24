import { Link } from 'react-router-dom'
import {
  ArrowRightLeft, Briefcase, CheckCircle2, CircleDollarSign, Contact, MessageCircle, Plus, Trash2, UserPlus, Activity as ActivityIcon, type LucideIcon,
} from 'lucide-react'
import type { Activity, ActivityType } from '@/types'
import { formatRelative } from '@/utils/format'

const ICONS: Partial<Record<ActivityType, LucideIcon>> = {
  lead_created: Plus,
  lead_status: ArrowRightLeft,
  lead_contacted: MessageCircle,
  lead_converted: UserPlus,
  lead_deleted: Trash2,
  lead_updated: Contact,
  client_created: UserPlus,
  project_created: Briefcase,
  project_status: ArrowRightLeft,
  task_created: Plus,
  task_completed: CheckCircle2,
  transaction_created: CircleDollarSign,
  payment_registered: CircleDollarSign,
}

function linkFor(a: Activity) {
  if (!a.entityId) return null
  switch (a.entityType) {
    case 'lead': return `/leads?lead=${a.entityId}`
    case 'client': return `/clientes/${a.entityId}`
    case 'project': return `/projetos/${a.entityId}`
    case 'task': return '/tarefas'
    case 'transaction': return '/financeiro'
    default: return null
  }
}

export function ActivityFeed({ activities, limit = 8 }: { activities: Activity[]; limit?: number }) {
  if (!activities.length) return <p className="py-6 text-center text-sm text-faint">Nenhuma atividade registrada ainda.</p>
  return (
    <ol className="relative">
      <span className="absolute top-2 bottom-2 left-[15px] w-px bg-line" />
      {activities.slice(0, limit).map((a, i) => {
        const Icon = ICONS[a.type] ?? ActivityIcon
        const to = linkFor(a)
        const body = (
          <>
            <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted transition-colors group-hover:border-white/30 group-hover:text-fg">
              <Icon className="size-3.5" strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1 pt-1">
              <span className="block text-[13px] leading-snug text-fg-soft group-hover:text-fg">{a.message}</span>
              <span className="mt-0.5 block font-mono text-[10.5px] text-faint">{formatRelative(a.createdAt)}</span>
            </span>
          </>
        )
        return (
          <li key={a.id} className="animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
            {to ? (
              <Link to={to} className="group flex gap-3 rounded-xl py-2">{body}</Link>
            ) : (
              <div className="group flex gap-3 py-2">{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
