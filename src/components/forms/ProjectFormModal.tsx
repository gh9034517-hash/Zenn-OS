import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea, Toggle } from '@/components/ui/Field'
import { PRIORITIES, PROJECT_STATUSES } from '@/data/constants'
import { useData } from '@/context/DataContext'
import { useToast } from '@/components/ui/Toast'
import type { Priority, Project, ProjectStatus } from '@/types'

export function ProjectFormModal({
  open, onClose, project, defaultClientId, onSaved,
}: { open: boolean; onClose: () => void; project?: Project | null; defaultClientId?: string; onSaved?: (p: Project) => void }) {
  const { clients, createProject, updateProject } = useData()
  const toast = useToast()
  const [form, setForm] = useState({ name: '', clientId: '', description: '', value: '', deadline: '', priority: 'media' as Priority, status: 'backlog' as ProjectStatus })
  const [addToContract, setAddToContract] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setAddToContract(true)
    setForm(
      project
        ? { name: project.name, clientId: project.clientId, description: project.description, value: String(project.value), deadline: project.deadline ?? '', priority: project.priority, status: project.status }
        : { name: '', clientId: defaultClientId ?? clients[0]?.id ?? '', description: '', value: '', deadline: '', priority: 'media', status: 'backlog' },
    )
  }, [open, project, defaultClientId, clients])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.clientId) return
    setBusy(true)
    try {
      const payload = { ...form, name: form.name.trim(), value: Number(form.value) || 0, deadline: form.deadline || null }
      const saved = project ? await updateProject(project.id, payload) : await createProject(payload, addToContract)
      toast.success(project ? 'Projeto atualizado' : 'Projeto criado', saved.name)
      onSaved?.(saved)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow="Operação" title={project ? 'Editar projeto' : 'Novo projeto'} size="lg">
      {clients.length === 0 ? (
        <p className="text-sm text-muted">Cadastre ou converta um cliente antes de criar projetos.</p>
      ) : (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nome" className="sm:col-span-2"><Input value={form.name} onChange={set('name')} required autoFocus placeholder="Ex.: Site institucional" /></FormField>
          <FormField label="Cliente">
            <Select value={form.clientId} onChange={set('clientId')} required>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </Select>
          </FormField>
          <FormField label="Valor (R$)"><Input type="number" min={0} step="0.01" value={form.value} onChange={set('value')} /></FormField>
          <FormField label="Prazo"><Input type="date" value={form.deadline} onChange={set('deadline')} /></FormField>
          <FormField label="Prioridade">
            <Select value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Status">
            <Select value={form.status} onChange={set('status')}>
              {PROJECT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </FormField>
          {!project && (
            <div className="sm:pt-6">
              <Toggle checked={addToContract} onChange={setAddToContract} label="Somar ao valor contratado" description="Atualiza o contrato do cliente" />
            </div>
          )}
          <FormField label="Descrição" className="sm:col-span-2"><Textarea value={form.description} onChange={set('description')} rows={3} /></FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={busy}>{project ? 'Salvar' : 'Criar projeto'}</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
