import { useState } from 'react'
import { Kanban as KanbanIcon, List, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Segmented'
import { Kanban } from '@/components/ui/Kanban'
import { EmptyState } from '@/components/ui/EmptyState'
import { DemoBadge } from '@/components/ui/Badge'
import { Stat } from '@/components/ui/Stat'
import { ProjectCard } from '@/components/ProjectCard'
import { ProjectFormModal } from '@/components/forms/ProjectFormModal'
import { useData } from '@/context/DataContext'
import { useToast } from '@/components/ui/Toast'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL } from '@/data/constants'
import { formatCurrencyCompact } from '@/utils/format'
import { projectProgress } from '@/utils/metrics'

export default function Projects() {
  const { projects, tasks, setProjectStatus } = useData()
  const toast = useToast()
  const [view, setView] = useLocalStorage<'kanban' | 'grid'>('zenn-os:projects-view', 'kanban')
  const [creating, setCreating] = useState(false)

  const active = projects.filter((p) => p.status !== 'concluido')
  const avgProgress = active.length ? active.reduce((acc, p) => acc + projectProgress(p.id, tasks).progress, 0) / active.length : 0

  return (
    <>
      <PageHeader
        eyebrow={<>Operação {projects.some((p) => p.isDemo) && <DemoBadge label="Inclui dados demo" />}</>}
        title="Projetos"
        description="Arraste entre as etapas. O progresso é calculado automaticamente pelas tarefas concluídas."
        actions={
          <>
            <Segmented value={view} onChange={setView} options={[{ value: 'kanban', label: 'Kanban', icon: <KanbanIcon /> }, { value: 'grid', label: 'Grade', icon: <List /> }]} />
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Novo projeto</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Projetos" value={projects.length} />
        <Stat label="Ativos" value={active.length} />
        <Stat label="Em carteira" value={formatCurrencyCompact(active.reduce((a, p) => a + p.value, 0))} hint="Valor dos projetos ativos" />
        <Stat emphasis label="Progresso médio" value={`${Math.round(avgProgress * 100)}%`} hint="Projetos ativos" />
      </div>

      {projects.length === 0 ? (
        <Card><EmptyState title="Nenhum projeto" description="Crie um projeto vinculado a um cliente." action={<Button variant="primary" onClick={() => setCreating(true)}>Novo projeto</Button>} /></Card>
      ) : view === 'kanban' ? (
        <Kanban
          columns={PROJECT_STATUSES}
          items={projects}
          getStatus={(p) => p.status}
          onMove={async (p, status) => {
            await setProjectStatus(p.id, status)
            toast.success(p.name, `Movido para ${PROJECT_STATUS_LABEL[status]}`)
          }}
          columnMeta={(_, items) => <span className="font-mono text-[10px] text-faint">{formatCurrencyCompact(items.reduce((a, p) => a + p.value, 0))}</span>}
          renderCard={(p) => <ProjectCard project={p} compact />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => <ProjectCard key={p.id} project={p} showStatus />)}
        </div>
      )}

      <ProjectFormModal open={creating} onClose={() => setCreating(false)} />
    </>
  )
}
