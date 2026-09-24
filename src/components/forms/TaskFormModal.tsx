import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/Field'
import { PRIORITIES, TASK_STATUSES } from '@/data/constants'
import { useData } from '@/context/DataContext'
import { useSession } from '@/context/SessionContext'
import { useToast } from '@/components/ui/Toast'
import type { Priority, Task, TaskStatus } from '@/types'

export function TaskFormModal({
  open, onClose, task, defaultProjectId,
}: { open: boolean; onClose: () => void; task?: Task | null; defaultProjectId?: string }) {
  const { projects, createTask, updateTask } = useData()
  const { session } = useSession()
  const toast = useToast()
  const [form, setForm] = useState({ projectId: '', title: '', description: '', deadline: '', priority: 'media' as Priority, assignee: '', status: 'a_fazer' as TaskStatus })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      task
        ? { projectId: task.projectId, title: task.title, description: task.description, deadline: task.deadline ?? '', priority: task.priority, assignee: task.assignee, status: task.status }
        : { projectId: defaultProjectId ?? projects[0]?.id ?? '', title: '', description: '', deadline: '', priority: 'media', assignee: session?.name ?? '', status: 'a_fazer' },
    )
  }, [open, task, defaultProjectId, projects, session])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = { ...form, title: form.title.trim(), deadline: form.deadline || null }
      if (task) await updateTask(task.id, payload)
      else await createTask(payload)
      toast.success(task ? 'Tarefa atualizada' : 'Tarefa criada', payload.title)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow="Operação" title={task ? 'Editar tarefa' : 'Nova tarefa'}>
      {projects.length === 0 ? (
        <p className="text-sm text-muted">Crie um projeto antes de adicionar tarefas.</p>
      ) : (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Título" className="sm:col-span-2"><Input value={form.title} onChange={set('title')} required autoFocus /></FormField>
          <FormField label="Projeto" className="sm:col-span-2">
            <Select value={form.projectId} onChange={set('projectId')} required>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Responsável"><Input value={form.assignee} onChange={set('assignee')} /></FormField>
          <FormField label="Prazo"><Input type="date" value={form.deadline} onChange={set('deadline')} /></FormField>
          <FormField label="Prioridade">
            <Select value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Status">
            <Select value={form.status} onChange={set('status')}>
              {TASK_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Descrição" className="sm:col-span-2"><Textarea value={form.description} onChange={set('description')} rows={3} /></FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={busy}>{task ? 'Salvar' : 'Criar tarefa'}</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
