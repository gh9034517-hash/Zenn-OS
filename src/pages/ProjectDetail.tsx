import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, CircleDollarSign, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DemoBadge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Field'
import { Progress } from '@/components/ui/Progress'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Segmented } from '@/components/ui/Segmented'
import { PriorityBadge } from '@/components/ProjectCard'
import { TaskList } from '@/components/TaskList'
import { TransactionsTable } from '@/components/TransactionsTable'
import { ProjectFormModal } from '@/components/forms/ProjectFormModal'
import { TaskFormModal } from '@/components/forms/TaskFormModal'
import { TransactionFormModal } from '@/components/forms/TransactionFormModal'
import { useData } from '@/context/DataContext'
import { useToast } from '@/components/ui/Toast'
import { PROJECT_STATUSES, PRIORITY_WEIGHT } from '@/data/constants'
import type { ProjectStatus, TaskStatus } from '@/types'
import { projectProgress } from '@/utils/metrics'
import { formatCurrency, formatDate, todayISO } from '@/utils/format'

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { projects, clients, tasks, transactions, setProjectStatus, deleteProject } = useData()
  const [editing, setEditing] = useState(false)
  const [creatingTask, setCreatingTask] = useState(false)
  const [payment, setPayment] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [filter, setFilter] = useState<'all' | TaskStatus>('all')

  const project = projects.find((p) => p.id === id)
  if (!project) {
    return <Card><EmptyState title="Projeto não encontrado" action={<Button onClick={() => navigate('/projetos')}>Voltar</Button>} /></Card>
  }
  const client = clients.find((c) => c.id === project.clientId)
  const projectTasks = tasks
    .filter((t) => t.projectId === project.id)
    .sort((a, b) => Number(a.status === 'concluida') - Number(b.status === 'concluida') || PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])
  const visibleTasks = projectTasks.filter((t) => filter === 'all' || t.status === filter)
  const prog = projectProgress(project.id, tasks)
  const projectTransactions = transactions.filter((t) => t.projectId === project.id)
  const received = projectTransactions.filter((t) => t.type === 'receita' && t.status === 'pago').reduce((a, t) => a + t.amount, 0)
  const late = project.deadline && project.deadline < todayISO() && project.status !== 'concluido'

  return (
    <>
      <Link to="/projetos" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg"><ArrowLeft className="size-3.5" /> Projetos</Link>
      <PageHeader
        eyebrow={<>Projeto {project.isDemo && <DemoBadge />}</>}
        title={project.name}
        description={
          <>
            {client ? <Link to={`/clientes/${client.id}`} className="text-fg-soft underline decoration-white/20 underline-offset-4 hover:decoration-white">{client.company}</Link> : 'Cliente removido'}
            {project.description && <> · {project.description}</>}
          </>
        }
        actions={
          <>
            <Select
              value={project.status}
              aria-label="Status do projeto"
              onChange={async (e) => {
                await setProjectStatus(project.id, e.target.value as ProjectStatus)
                toast.success('Status atualizado')
              }}
            >
              {PROJECT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
            <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>Editar</Button>
            <Button variant="outline" icon={<CircleDollarSign className="size-4" />} onClick={() => setPayment(true)}>Pagamento</Button>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreatingTask(true)}>Nova tarefa</Button>
          </>
        }
      />

      <Card className="mb-4 p-5 sm:p-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="eyebrow">Progresso</p>
            <p className="text-metal mt-2 font-mono text-4xl">{Math.round(prog.progress * 100)}%</p>
            <Progress value={prog.progress} className="mt-3 h-1.5" />
            <p className="mt-2 text-xs text-muted">{prog.done} de {prog.total} tarefas concluídas</p>
          </div>
          <div>
            <p className="eyebrow">Valor</p>
            <p className="mt-2 font-mono text-xl">{formatCurrency(project.value)}</p>
            <p className="mt-1 text-xs text-muted">{formatCurrency(received)} recebido</p>
          </div>
          <div>
            <p className="eyebrow">Prazo</p>
            <p className={`mt-2 flex items-center gap-2 font-mono text-xl ${late ? 'text-danger' : ''}`}><CalendarClock className="size-4" />{formatDate(project.deadline)}</p>
            {late && <p className="mt-1 text-xs text-danger">Prazo vencido</p>}
          </div>
          <div>
            <p className="eyebrow">Prioridade</p>
            <div className="mt-3"><PriorityBadge priority={project.priority} /></div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader
            eyebrow="Execução"
            title="Tarefas"
            action={
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[{ value: 'all', label: 'Todas' }, { value: 'a_fazer', label: 'A fazer' }, { value: 'em_andamento', label: 'Andamento' }, { value: 'concluida', label: 'Feitas' }]}
              />
            }
          />
          <CardBody className="pt-2">
            {projectTasks.length === 0 ? (
              <EmptyState className="py-8" title="Nenhuma tarefa" description="Divida o projeto em tarefas para acompanhar o progresso." action={<Button variant="primary" size="sm" onClick={() => setCreatingTask(true)}>Criar tarefa</Button>} />
            ) : (
              <TaskList tasks={visibleTasks} />
            )}
          </CardBody>
        </Card>
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader eyebrow="Financeiro" title="Pagamentos do projeto" className="pb-4" />
            <div className="border-t border-line"><TransactionsTable transactions={projectTransactions} showClient={false} /></div>
          </Card>
          <Button variant="danger" className="ml-auto flex" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>Excluir projeto</Button>
        </div>
      </div>

      <ProjectFormModal open={editing} onClose={() => setEditing(false)} project={project} />
      <TaskFormModal open={creatingTask} onClose={() => setCreatingTask(false)} defaultProjectId={project.id} />
      <TransactionFormModal open={payment} onClose={() => setPayment(false)} mode="payment" defaultClientId={project.clientId} defaultProjectId={project.id} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        danger
        title="Excluir projeto?"
        description="O projeto e suas tarefas serão removidos. Transações financeiras são mantidas."
        confirmLabel="Excluir"
        onConfirm={async () => {
          await deleteProject(project.id)
          toast.success('Projeto excluído')
          navigate('/projetos')
        }}
      />
    </>
  )
}
