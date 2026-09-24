import { useState } from 'react'
import { Copy, MessageCircle, Phone, ExternalLink } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea, FormField } from '@/components/ui/Field'
import { InstagramIcon } from '@/components/ui/BrandIcons'
import { whatsappLink } from '@/utils/format'
import { useToast } from '@/components/ui/Toast'

export interface Contactable {
  name: string
  phone: string | null
  instagram: string | null
  website: string | null
}

function defaultMessage(c: Contactable) {
  return c.website
    ? `Olá, equipe ${c.name}! Sou da Zenn Works. Vi o site de vocês e tenho algumas ideias para aumentar as conversões. Posso compartilhar?`
    : `Olá, equipe ${c.name}! Sou da Zenn Works. Percebi que vocês ainda não têm um site — criamos sites que trazem clientes pelo Google. Posso mostrar um exemplo?`
}

/**
 * Abre o canal real (WhatsApp, telefone, Instagram) e registra o contato no CRM.
 * onContact recebe o canal usado; quem chama salva o lead se necessário.
 */
export function ContactModal({
  open,
  onClose,
  target,
  onContact,
}: {
  open: boolean
  onClose: () => void
  target: Contactable | null
  onContact: (channel: string) => Promise<void>
}) {
  const toast = useToast()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  if (!target) return null
  const text = message || defaultMessage(target)
  const wa = whatsappLink(target.phone, text)
  const igHandle = target.instagram?.replace(/^@/, '').replace(/.*instagram\.com\//, '').replace(/\/$/, '')

  const run = async (channel: string, open?: string) => {
    setBusy(channel)
    try {
      if (open) window.open(open, '_blank', 'noopener,noreferrer')
      await onContact(channel)
      toast.success('Contato registrado', `${target.name} · ${channel}`)
      onClose()
    } catch (e) {
      toast.error('Não foi possível registrar', e instanceof Error ? e.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow="Contatar" title={target.name}>
      <FormField label="Mensagem" hint="Usada no WhatsApp">
        <Textarea value={text} onChange={(e) => setMessage(e.target.value)} rows={4} />
      </FormField>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Button variant="primary" disabled={!wa} loading={busy === 'WhatsApp'} icon={<MessageCircle className="size-4" />} onClick={() => run('WhatsApp', wa!)}>
          WhatsApp
        </Button>
        <Button variant="outline" disabled={!target.phone} loading={busy === 'Telefone'} icon={<Phone className="size-4" />} onClick={() => run('Telefone', `tel:${target.phone}`)}>
          Ligar
        </Button>
        <Button
          variant="outline"
          disabled={!igHandle}
          loading={busy === 'Instagram'}
          icon={<InstagramIcon className="size-4" />}
          onClick={() => run('Instagram', `https://instagram.com/${igHandle}`)}
        >
          Instagram
        </Button>
        <Button
          variant="outline"
          disabled={!target.phone}
          icon={<Copy className="size-4" />}
          onClick={async () => {
            await navigator.clipboard?.writeText(target.phone ?? '')
            toast.info('Telefone copiado', target.phone ?? '')
          }}
        >
          Copiar telefone
        </Button>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-dashed border-line px-3.5 py-3">
        <p className="text-xs text-muted">Contato feito por outro canal (e-mail, presencial)?</p>
        <Button size="sm" variant="ghost" loading={busy === 'Outro canal'} icon={<ExternalLink className="size-3.5" />} onClick={() => run('Outro canal')}>
          Registrar
        </Button>
      </div>
      {!target.phone && <p className="mt-3 text-xs text-faint">Sem telefone cadastrado — WhatsApp e ligação indisponíveis.</p>}
    </Modal>
  )
}
