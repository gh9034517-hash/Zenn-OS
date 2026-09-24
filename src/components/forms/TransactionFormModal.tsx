import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { PAYMENT_METHODS } from '@/data/constants'
import { useData } from '@/context/DataContext'
import { useToast } from '@/components/ui/Toast'
import { todayISO } from '@/utils/format'
import type { PaymentMethod, TransactionStatus, TransactionType } from '@/types'

/**
 * mode "payment": registra um pagamento recebido (receita paga + payment + atividade).
 * mode "transaction": lançamento livre (receita/despesa, pago/pendente).
 */
export function TransactionFormModal({
  open, onClose, mode = 'transaction', defaultClientId, defaultProjectId,
}: { open: boolean; onClose: () => void; mode?: 'payment' | 'transaction'; defaultClientId?: string; defaultProjectId?: string }) {
  const { clients, projects, createTransaction, registerPayment } = useData()
  const toast = useToast()
  const [type, setType] = useState<TransactionType>('receita')
  const [form, setForm] = useState({ clientId: '', projectId: '', description: '', amount: '', status: 'pago' as TransactionStatus, date: todayISO(), method: 'pix' as PaymentMethod })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setType('receita')
    setForm({ clientId: defaultClientId ?? '', projectId: defaultProjectId ?? '', description: '', amount: '', status: mode === 'payment' ? 'pago' : 'pendente', date: todayISO(), method: 'pix' })
  }, [open, defaultClientId, defaultProjectId, mode])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value
    setForm((f) => {
      const next = { ...f, [k]: value }
      if (k === 'projectId' && value) next.clientId = projects.find((p) => p.id === value)?.clientId ?? f.clientId
      if (k === 'clientId' && f.projectId && projects.find((p) => p.id === f.projectId)?.clientId !== value) next.projectId = ''
      return next
    })
  }

  const clientProjects = projects.filter((p) => !form.clientId || p.clientId === form.clientId)
  const isPayment = mode === 'payment'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!(amount > 0)) return
    setBusy(true)
    try {
      const project = projects.find((p) => p.id === form.projectId)
      const description = form.description.trim() || (isPayment ? `Pagamento${project ? ` — ${project.name}` : ''}` : 'Lançamento')
      if (isPayment) {
        await registerPayment({ clientId: form.clientId || null, projectId: form.projectId || null, amount, method: form.method, description, date: form.date })
        toast.success('Pagamento registrado', description)
      } else {
        await createTransaction({
          clientId: type === 'receita' ? form.clientId || null : null,
          projectId: type === 'receita' ? form.projectId || null : null,
          description, amount, type, status: form.status, date: form.date,
          paidAt: form.status === 'pago' ? new Date(`${form.date}T12:00:00`).toISOString() : null,
          method: form.method,
        })
        toast.success('Transação lançada', description)
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow="Financeiro" title={isPayment ? 'Registrar pagamento' : 'Nova transação'}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {!isPayment && (
          <div className="sm:col-span-2">
            <Segmented<TransactionType> value={type} onChange={setType} options={[{ value: 'receita', label: 'Receita' }, { value: 'despesa', label: 'Despesa' }]} />
          </div>
        )}
        {(isPayment || type === 'receita') && (
          <>
            <FormField label="Cliente">
              <Select value={form.clientId} onChange={set('clientId')} required={isPayment}>
                <option value="">{isPayment ? 'Selecione' : 'Sem cliente'}</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
              </Select>
            </FormField>
            <FormField label="Projeto">
              <Select value={form.projectId} onChange={set('projectId')}>
                <option value="">Sem projeto</option>
                {clientProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </FormField>
          </>
        )}
        <FormField label="Descrição" className="sm:col-span-2">
          <Input value={form.description} onChange={set('description')} placeholder={isPayment ? 'Ex.: Entrada 50%' : 'Ex.: Hospedagem'} />
        </FormField>
        <FormField label="Valor (R$)"><Input type="number" min={0.01} step="0.01" value={form.amount} onChange={set('amount')} required /></FormField>
        <FormField label={isPayment ? 'Data do pagamento' : 'Data / vencimento'}><Input type="date" value={form.date} onChange={set('date')} required /></FormField>
        <FormField label="Método">
          <Select value={form.method} onChange={set('method')}>
            {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </Select>
        </FormField>
        {!isPayment && (
          <FormField label="Status">
            <Select value={form.status} onChange={set('status')}>
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
            </Select>
          </FormField>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={busy}>{isPayment ? 'Registrar pagamento' : 'Lançar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
