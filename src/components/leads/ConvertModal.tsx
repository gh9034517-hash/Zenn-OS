import { useEffect, useState, type FormEvent } from 'react'
import { UserPlus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Field'

export interface ConvertInput {
  contactName: string
  email: string
  contractedValue: number
}

export function ConvertModal({
  open,
  onClose,
  companyName,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  companyName: string
  onConfirm: (input: ConvertInput) => Promise<void>
}) {
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setContactName('')
      setEmail('')
      setValue('')
    }
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await onConfirm({ contactName, email, contractedValue: Number(value) || 0 })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow="Lead → Cliente" title={`Converter ${companyName}`} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">
          Cria o cliente vinculado a este lead, marca o lead como <span className="text-fg">Cliente</span> e registra a atividade.
        </p>
        <FormField label="Nome do contato">
          <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Ex.: Marcos Almeida" autoFocus />
        </FormField>
        <FormField label="E-mail">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@empresa.com.br" />
        </FormField>
        <FormField label="Valor contratado (R$)" hint="Opcional">
          <Input type="number" min={0} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={busy} icon={<UserPlus className="size-4" />}>
            Converter em cliente
          </Button>
        </div>
      </form>
    </Modal>
  )
}
