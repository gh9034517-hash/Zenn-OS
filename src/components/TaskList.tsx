import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Check, Pencil, Trash2, User } from 'lucide-react'
import type { Task, TaskStatus } from '@/types'
import { useData } from '@/context/DataContext'
import { useToast } from '@/components/ui/Toast'
import { PriorityBadge } from '@/components/ProjectCard'
import { TaskFormModal } from '@/components/forms/TaskFormModal'
import { TASK_STATUSES } from '@/data/constants'
import { formatDateShort, todayISO } from '@/utils/format'
import { cn } from '@/utils/cn'

export function TaskList({ tasks, showProject }: { tasks: Task[]; showProject?: boolean }) {
  const { updateTask, deleteTask, projects } = useData()
  const toast = useToast()
  const [editing, setEditing] = useState<Task | null>(null)

  if (!tasks.length) return <p className="py-8 text-center text-sm text-faint">Nenhuma tarefa.</p>

  return (
    <>
      <ul className="divide-y divide-line">
        {tasks.map((t) => {
          const done = t.status === 'concluida'
          const late = !done && t.deadline && t.deadline < todayISO()
          const project = projects.find((p) => p.id === t.projectId)
          return (
            <li key={t.id} className="group flex items-start gap-3 py-3">
              <button
                onClick={async () => {
                  await updateTask(t.id, { status: done ? 'a_fazer' : 'concluida' })
                  if (!done) toast.success('Tarefa concluída', t.title)
                }}
                className={cn(
                  'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-all',
                  done ? 'border-white bg-white text-black' : 'border-line-strong hover:border-white/60',
                )}
                aria-label={done ? 'Reabrir tarefa' : 'Concluir tarefa'}
              >
                {done && <Check className="size-3.5" strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm', done && 'text-faint line-through')}>{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
                  {showProject && project && (
                    <Link to={`/projetos/${project.id}`} className="truncate text-muted hover:text-fg">{project.name}</Link>
                  )}
                  <span className="flex items-center gap-1"><User className="size-3" />{t.assignee || '—'}</span>
                  <span className={cn('flex items-center gap-1 font-mono', late && 'text-danger')}><CalendarClock className="size-3" />{formatDateShort(t.deadline)}</span>
                  <PriorityBadge priority={t.priority} />
                </div>
              </div>
              <select
                value={t.status}
                onChange={(e) => updateTask(t.id, { status: e.target.value as TaskStatus })}
                className="hidden rounded-lg border border-line bg-ink px-2 py-1 text-xs text-muted sm:block"
                aria-label="Status da tarefa"
              >
                {TASK_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <div className="flex gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                <button onClick={() => setEditing(t)} className="rounded-lg p-1.5 text-faint hover:bg-white/5 hover:text-fg" aria-label="Editar tarefa"><Pencil className="size-3.5" /></button>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Excluir a tarefa "${t.title}"?`)) return
                    await deleteTask(t.id)
                    toast.success('Tarefa excluída')
                  }}
                  className="rounded-lg p-1.5 text-faint hover:bg-white/5 hover:text-danger"
                  aria-label="Excluir tarefa"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <TaskFormModal open={!!editing} task={editing} onClose={() => setEditing(null)} />
    </>
  )
}
