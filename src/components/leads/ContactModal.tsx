import { useEffect, useState } from 'react'
import { Copy, MessageCircle, Phone, ExternalLink, RotateCcw, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea, FormField } from '@/components/ui/Field'
import { InstagramIcon } from '@/components/ui/BrandIcons'
import { whatsappLink } from '@/utils/format'
import { useToast } from '@/components/ui/Toast'
import { templatesPara, mensagemPadrao, type OutreachContext } from '@/services/outreach'
import { cn } from '@/utils/cn'

export interface Contactable extends OutreachContext {
  name: string
  phone: string | null
  instagram: string | null
  website: string | null
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
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Cada lead recomeça no modelo padrão — senão a mensagem do lead anterior
  // vazaria para o próximo, com o nome da empresa errada.
  useEffect(() => {
    if (!target) return
    setMessage(mensagemPadrao(target))
    setTemplateId(templatesPara(target)[0]?.id ?? null)
    setCopied(false)
  }, [target])

  if (!target) return null

  const templates = templatesPara(target)
  const text = message
  const wa = whatsappLink(target.phone, text)
  const igHandle = target.instagram?.replace(/^@/, '').replace(/.*instagram\.com\//, '').replace(/\/$/, '')

  const aplicarTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    setMessage(t.build(target))
    setTemplateId(id)
  }

  const copiarMensagem = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Mensagem copiada', 'Cole onde quiser enviar')
    } catch {
      toast.error('Não foi possível copiar', 'Selecione o texto e copie manualmente')
    }
  }

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
      {templates.length > 1 && (
        <div className="mb-3">
          <p className="eyebrow mb-2">Modelo</p>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => aplicarTemplate(t.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition-colors',
                  templateId === t.id
                    ? 'border-white/60 bg-white text-black'
                    : 'border-line text-muted hover:border-white/30 hover:text-fg',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <FormField label="Mensagem" hint="Enviada no WhatsApp — edite à vontade">
        <Textarea value={text} onChange={(e) => setMessage(e.target.value)} rows={8} />
      </FormField>

      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant="ghost" icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} onClick={copiarMensagem}>
          {copied ? 'Copiado' : 'Copiar mensagem'}
        </Button>
        {templateId && (
          <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => aplicarTemplate(templateId)}>
            Restaurar modelo
          </Button>
        )}
      </div>

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
