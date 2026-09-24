import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Stat } from '@/components/ui/Stat'
import { Progress } from '@/components/ui/Progress'
import { EmptyState } from '@/components/ui/EmptyState'
import { TaskList } from '@/components/TaskList'
import { TaskFormModal } from '@/components/forms/TaskFormModal'
import { useData } from '@/context/DataContext'
import { PRIORITIES, PRIORITY_WEIGHT, TASK_STATUSES } from '@/data/constants'
import type { Priority, TaskStatus } from '@/types'
import { normalize, todayISO } from '@/utils/format'

export default function Tasks() {
  const { tasks, projects } = useData()
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<TaskStatus | 'open' | 'all'>('open')
  const [projectId, setProjectId] = useState('all')
  const [priority, setPriority] = useState<Priority | 'all'>('all')
  const [assignee, setAssignee] = useState('all')

  const assignees = useMemo(() => [...new Set(tasks.map((t) => t.assignee).filter(Boolean))].sort(), [tasks])
  const filtered = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            (status === 'all' || (status === 'open' ? t.status !== 'concluida' : t.status === status)) &&
            (projectId === 'all' || t.projectId === projectId) &&
            (priority === 'all' || t.priority === priority) &&
            (assignee === 'all' || t.assignee === assignee) &&
            (!query || normalize(`${t.title} ${t.description}`).includes(normalize(query))),
        )
        .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]),
    [tasks, status, projectId, priority, assignee, query],
  )

  const done = tasks.filter((t) => t.status === 'concluida').length
  const late = tasks.filter((t) => t.status !== 'concluida' && t.deadline && t.deadline < todayISO()).length

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Tarefas"
        description="Todas as tarefas dos projetos. Concluir uma tarefa atualiza o progresso do projeto na hora."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nova tarefa</Button>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tarefas" value={tasks.length} />
        <Stat label="Em aberto" value={tasks.length - done} />
        <Stat label="Atrasadas" value={late} hint="Prazo vencido e não concluídas" />
        <Stat emphasis label="Concluídas" value={`${tasks.length ? Math.round((done / tasks.length) * 100) : 0}%`} hint={<Progress value={tasks.length ? done / tasks.length : 0} className="mt-1" />} />
      </div>
      <Card className="mb-4 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input icon={<Search />} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tarefa…" />
        <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | 'open' | 'all')}>
          <option value="open">Em aberto</option>
          <option value="all">Todos os status</option>
          {TASK_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="all">Todos os projetos</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority | 'all')}>
          <option value="all">Todas as prioridades</option>
          {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </Select>
        <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="all">Todos os responsáveis</option>
          {assignees.map((a) => <option key={a}>{a}</option>)}
        </Select>
      </Card>
      <Card>
        <CardBody className="py-2">
          {tasks.length === 0 ? (
            <EmptyState title="Nenhuma tarefa" description="Crie tarefas dentro dos projetos." action={<Button variant="primary" onClick={() => setCreating(true)}>Nova tarefa</Button>} />
          ) : (
            <TaskList tasks={filtered} showProject />
          )}
        </CardBody>
      </Card>
      <TaskFormModal open={creating} onClose={() => setCreating(false)} />
    </>
  )
}
