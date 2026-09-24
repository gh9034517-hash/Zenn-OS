import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import type { Project } from '@/types'
import { useData } from '@/context/DataContext'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'
import { PRIORITY_LABEL, PROJECT_STATUS_LABEL } from '@/data/constants'
import { projectProgress } from '@/utils/metrics'
import { formatCurrency, formatDateShort, todayISO } from '@/utils/format'
import { cn } from '@/utils/cn'

export function PriorityBadge({ priority }: { priority: Project['priority'] }) {
  const tone = priority === 'urgente' ? 'solid' : priority === 'alta' ? 'bright' : priority === 'media' ? 'default' : 'muted'
  return <Badge tone={tone}>{PRIORITY_LABEL[priority]}</Badge>
}

export function ProjectCard({ project, compact, showStatus }: { project: Project; compact?: boolean; showStatus?: boolean }) {
  const { tasks, clients } = useData()
  const client = clients.find((c) => c.id === project.clientId)
  const prog = projectProgress(project.id, tasks)
  const late = project.deadline && project.deadline < todayISO() && project.status !== 'concluido'

  return (
    <Link to={`/projetos/${project.id}`} className={cn('panel panel-hover block', compact ? 'p-3' : 'p-4')} draggable={false}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug font-medium">{project.name}</p>
        <PriorityBadge priority={project.priority} />
      </div>
      <p className="mt-1 truncate text-xs text-muted">{client?.company ?? 'Cliente removido'}</p>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="font-mono text-fg-soft">{formatCurrency(project.value)}</span>
        <span className={cn('flex items-center gap-1 font-mono', late ? 'text-danger' : 'text-faint')}>
          <CalendarClock className="size-3" />
          {formatDateShort(project.deadline)}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Progress value={prog.progress} />
        <span className="shrink-0 font-mono text-[10px] text-muted">{prog.done}/{prog.total}</span>
      </div>
      {showStatus && <p className="mt-2 text-[11px] text-faint">{PROJECT_STATUS_LABEL[project.status]}</p>}
    </Link>
  )
}
