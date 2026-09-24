import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, ExternalLink, Globe, MapPin, MessageCircle, Phone, Sparkles, Trash2, UserPlus, Star, Map } from 'lucide-react'
import type { Lead, LeadStatus, PlaceResult } from '@/types'
import { Drawer } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { DemoBadge } from '@/components/ui/Badge'
import { Select, Textarea, FormField, Input } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FacebookIcon, InstagramIcon } from '@/components/ui/BrandIcons'
import { LeadStatusBadge, Rating, WebsiteBadge } from './LeadBadges'
import { LEAD_STATUSES } from '@/data/constants'
import { useData } from '@/context/DataContext'
import { useToast } from '@/components/ui/Toast'
import { useLeadWorkflow } from '@/hooks/useLeadWorkflow'
import { formatDate, formatNumber } from '@/utils/format'
import { lookupFacebookPage, isMetaConfigured, type MetaPageInfo } from '@/services/meta'

function Row({ icon: Icon, label, children }: { icon: typeof Globe; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-line py-3 last:border-0">
      <Icon className="mt-0.5 size-4 shrink-0 text-faint" strokeWidth={1.6} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] tracking-wide text-faint uppercase">{label}</p>
        <div className="mt-0.5 text-sm break-words text-fg-soft">{children}</div>
      </div>
    </div>
  )
}

const ext = (href: string | null, label?: string) =>
  href ? (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-fg underline decoration-white/20 underline-offset-4 hover:decoration-white">
      {label ?? href.replace(/^https?:\/\/(www\.)?/, '')}
      <ExternalLink className="size-3" />
    </a>
  ) : (
    <span className="text-faint">Não informado</span>
  )

/** Detalhe de um lead salvo — ou de um resultado de busca ainda não salvo. */
export function LeadDrawer({ leadId, place, onClose }: { leadId?: string | null; place?: PlaceResult | null; onClose: () => void }) {
  const data = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const workflow = useLeadWorkflow()
  const lead: Lead | undefined = leadId
    ? data.leads.find((l) => l.id === leadId)
    : place
      ? data.findLeadByPlace(place.placeId)
      : undefined
  const target = lead ?? place ?? null
  const open = Boolean(target)

  const [notes, setNotes] = useState('')
  const [metaInput, setMetaInput] = useState('')
  const [meta, setMeta] = useState<MetaPageInfo | null>(null)
  const [metaBusy, setMetaBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setNotes(lead?.notes ?? '')
    setMeta(null)
    setMetaInput(target?.facebook ?? '')
  }, [lead?.id, place?.placeId])

  if (!target) return null
  const isDemo = lead ? lead.isDemo || lead.source === 'demo' : place?.source === 'demo'
  const facebookUrl = target.facebook
  const instagramUrl = target.instagram ? `https://instagram.com/${target.instagram.replace(/^@/, '')}` : null

  const saveNotes = async () => {
    if (!lead) return
    await data.updateLead(lead.id, { notes })
    toast.success('Anotações salvas')
  }

  const runMeta = async () => {
    setMetaBusy(true)
    try {
      const info = await lookupFacebookPage(metaInput)
      setMeta(info)
      if (lead && info.mode === 'live') {
        await data.updateLead(lead.id, {
          facebook: info.link,
          instagram: info.instagramUsername ? `@${info.instagramUsername}` : lead.instagram,
          website: lead.website ?? info.website,
        })
        toast.success('Lead enriquecido com dados da Meta')
      }
    } catch (e) {
      toast.error('Meta Graph API', e instanceof Error ? e.message : undefined)
    } finally {
      setMetaBusy(false)
    }
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        eyebrow={
          <span className="flex items-center gap-2">
            {lead ? 'Lead salvo' : 'Resultado da busca'} {isDemo && <DemoBadge />}
          </span>
        }
        title={target.name}
        footer={
          <>
            {!lead && (
              <Button variant="primary" icon={<Bookmark className="size-4" />} onClick={() => workflow.save(target)}>
                Salvar
              </Button>
            )}
            <Button variant={lead ? 'primary' : 'outline'} icon={<MessageCircle className="size-4" />} onClick={() => workflow.contact(target)}>
              Contatar
            </Button>
            <Button variant="outline" icon={<UserPlus className="size-4" />} onClick={() => workflow.convert(target)}>
              {lead?.clientId ? 'Ver cliente' : 'Converter'}
            </Button>
            {lead && (
              <Button variant="danger" size="icon" className="ml-auto" aria-label="Excluir lead" title="Excluir lead" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <WebsiteBadge website={target.website} />
          {lead && <LeadStatusBadge status={lead.status} />}
          <span className="text-xs text-muted">{target.category}</span>
        </div>

        {lead && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <FormField label="Status no funil">
              <Select
                value={lead.status}
                onChange={async (e) => {
                  const status = e.target.value as LeadStatus
                  if (status === 'cliente' && !lead.clientId) {
                    workflow.convert(lead)
                    return
                  }
                  await data.setLeadStatus(lead.id, status)
                  toast.success('Status atualizado')
                }}
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="text-xs text-muted sm:pt-6">
              <p>Criado em {formatDate(lead.createdAt)}</p>
              <p>Último contato: {lead.lastContactAt ? formatDate(lead.lastContactAt) : 'nunca'}</p>
            </div>
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-line px-4">
          <Row icon={MapPin} label="Endereço">
            {target.address || '—'}
            <span className="block text-muted">{target.city}</span>
          </Row>
          <Row icon={Phone} label="Telefone">
            {target.phone ? <a href={`tel:${target.phone}`} className="text-fg">{target.phone}</a> : <span className="text-faint">Não informado</span>}
          </Row>
          <Row icon={Star} label="Google rating">
            <Rating value={target.rating} /> <span className="ml-2 text-xs text-muted">{formatNumber(target.reviewsCount)} avaliações</span>
          </Row>
          <Row icon={Globe} label="Website">{ext(target.website)}</Row>
          <Row icon={Map} label="Google Maps">{ext(target.googleMapsUrl, 'Abrir no Google Maps')}</Row>
          <Row icon={FacebookIcon as unknown as typeof Globe} label="Facebook">{ext(facebookUrl)}</Row>
          <Row icon={InstagramIcon as unknown as typeof Globe} label="Instagram">{ext(instagramUrl, target.instagram ?? undefined)}</Row>
        </div>

        {lead?.clientId && (
          <button onClick={() => navigate(`/clientes/${lead.clientId}`)} className="mt-4 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 py-3 text-left text-sm transition hover:bg-white/[0.07]">
            Este lead já é cliente → abrir ficha do cliente
          </button>
        )}

        {lead && (
          <div className="mt-6">
            <FormField label="Anotações">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contexto, objeções, próximos passos…" />
            </FormField>
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="secondary" onClick={saveNotes} disabled={notes === lead.notes}>
                Salvar anotações
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-line p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-muted" /> Enriquecer com Meta
            </p>
            {!isMetaConfigured() && <DemoBadge />}
          </div>
          <p className="mt-1 text-xs text-muted">
            Consulta a página via Graph API oficial (seguidores, Instagram vinculado).
            {!isMetaConfigured() && ' Sem META_ACCESS_TOKEN — resultado fictício.'}
          </p>
          <div className="mt-3 flex gap-2">
            <Input value={metaInput} onChange={(e) => setMetaInput(e.target.value)} placeholder="facebook.com/pagina ou @pagina" />
            <Button variant="outline" loading={metaBusy} disabled={!metaInput.trim()} onClick={runMeta}>
              Consultar
            </Button>
          </div>
          {meta && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white/[0.03] p-3">
                <p className="text-faint">Seguidores Facebook</p>
                <p className="mt-1 font-mono text-base">{meta.followers !== null ? formatNumber(meta.followers) : '—'}</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-3">
                <p className="text-faint">Instagram {meta.instagramUsername ? `@${meta.instagramUsername}` : ''}</p>
                <p className="mt-1 font-mono text-base">{meta.instagramFollowers !== null ? formatNumber(meta.instagramFollowers) : '—'}</p>
              </div>
              {meta.mode === 'demo' && <p className="col-span-2 text-faint">DEMO MODE — números fictícios, não salvos no lead.</p>}
            </div>
          )}
        </div>
      </Drawer>
      {workflow.modals}
      {lead && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          danger
          title="Excluir lead?"
          description={`${lead.name} será removido do CRM. Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          onConfirm={async () => {
            await data.deleteLead(lead.id)
            toast.success('Lead excluído')
            onClose()
          }}
        />
      )}
    </>
  )
}
