import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/Field'
import { CLIENT_STATUSES } from '@/data/constants'
import { useData } from '@/context/DataContext'
import { useToast } from '@/components/ui/Toast'
import type { Client, ClientStatus } from '@/types'

const empty = {
  company: '', contactName: '', phone: '', email: '', instagram: '', city: '', category: '',
  status: 'onboarding' as ClientStatus, contractedValue: '', notes: '',
}

export function ClientFormModal({
  open, onClose, client, onSaved,
}: { open: boolean; onClose: () => void; client?: Client | null; onSaved?: (c: Client) => void }) {
  const { createClient, updateClient } = useData()
  const toast = useToast()
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      client
        ? {
            company: client.company, contactName: client.contactName, phone: client.phone ?? '', email: client.email ?? '',
            instagram: client.instagram ?? '', city: client.city, category: client.category, status: client.status,
            contractedValue: String(client.contractedValue), notes: client.notes,
          }
        : empty,
    )
  }, [open, client])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = {
        company: form.company.trim(), contactName: form.contactName.trim(), phone: form.phone.trim() || null,
        email: form.email.trim() || null, instagram: form.instagram.trim() || null, city: form.city.trim(),
        category: form.category.trim(), status: form.status, contractedValue: Number(form.contractedValue) || 0, notes: form.notes,
      }
      const saved = client ? await updateClient(client.id, payload) : await createClient({ ...payload, leadId: null })
      toast.success(client ? 'Cliente atualizado' : 'Cliente cadastrado', saved.company)
      onSaved?.(saved)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow="CRM" title={client ? `Editar ${client.company}` : 'Novo cliente'} size="lg">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <FormField label="Empresa"><Input value={form.company} onChange={set('company')} required autoFocus /></FormField>
        <FormField label="Contato"><Input value={form.contactName} onChange={set('contactName')} /></FormField>
        <FormField label="Telefone"><Input value={form.phone} onChange={set('phone')} /></FormField>
        <FormField label="E-mail"><Input type="email" value={form.email} onChange={set('email')} /></FormField>
        <FormField label="Instagram"><Input value={form.instagram} onChange={set('instagram')} placeholder="@empresa" /></FormField>
        <FormField label="Cidade"><Input value={form.city} onChange={set('city')} /></FormField>
        <FormField label="Categoria"><Input value={form.category} onChange={set('category')} /></FormField>
        <FormField label="Status">
          <Select value={form.status} onChange={set('status')}>
            {CLIENT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        </FormField>
        <FormField label="Valor contratado (R$)" hint="Recebido e pendente são calculados pelo financeiro">
          <Input type="number" min={0} step="0.01" value={form.contractedValue} onChange={set('contractedValue')} />
        </FormField>
        <FormField label="Observações" className="sm:col-span-2"><Textarea value={form.notes} onChange={set('notes')} rows={3} /></FormField>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={busy}>{client ? 'Salvar' : 'Cadastrar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
