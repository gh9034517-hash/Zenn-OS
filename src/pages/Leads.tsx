import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Kanban as KanbanIcon, List, Plus, Search, Phone, MessageCircle, UserPlus, Eye } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { Input, Select, Toggle, FormField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Kanban } from '@/components/ui/Kanban'
import { EmptyState } from '@/components/ui/EmptyState'
import { DemoBadge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { LeadDrawer } from '@/components/leads/LeadDrawer'
import { LeadStatusBadge, Rating, WebsiteBadge } from '@/components/leads/LeadBadges'
import { useData } from '@/context/DataContext'
import { useLeadWorkflow } from '@/hooks/useLeadWorkflow'
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from '@/data/constants'
import { hasNoWebsite } from '@/services/googlePlaces'
import type { Lead, LeadStatus } from '@/types'
import { exportCsv } from '@/utils/csv'
import { formatDate, formatRelative, normalize } from '@/utils/format'
import { cn } from '@/utils/cn'

type View = 'table' | 'kanban'

export default function Leads() {
  const { leads, setLeadStatus } = useData()
  const toast = useToast()
  const workflow = useLeadWorkflow()
  const [params, setParams] = useSearchParams()

  const view = (params.get('view') as View) || 'table'
  const openLeadId = params.get('lead')
  const onlyNoSite = params.get('semSite') === '1'

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<LeadStatus | 'all'>('all')
  const [city, setCity] = useState('all')
  const [category, setCategory] = useState('all')
  const [creating, setCreating] = useState(false)

  const cities = useMemo(() => [...new Set(leads.map((l) => l.city))].sort(), [leads])
  const categories = useMemo(() => [...new Set(leads.map((l) => l.category))].sort(), [leads])

  const filtered = useMemo(() => {
    const q = normalize(query)
    const qDigits = query.replace(/\D/g, '')
    return leads.filter(
      (l) =>
        (!onlyNoSite || hasNoWebsite(l.website)) &&
        (status === 'all' || l.status === status) &&
        (city === 'all' || l.city === city) &&
        (category === 'all' || l.category === category) &&
        (!q ||
          normalize(`${l.name} ${l.city} ${l.category} ${l.address}`).includes(q) ||
          (qDigits.length >= 3 && (l.phone ?? '').replace(/\D/g, '').includes(qDigits))),
    )
  }, [leads, onlyNoSite, status, city, category, query])

  const moveLead = async (lead: Lead, next: LeadStatus) => {
    if (next === 'cliente' && !lead.clientId) {
      workflow.convert(lead)
      return
    }
    await setLeadStatus(lead.id, next)
    toast.success(`${lead.name}`, `Movido para ${LEAD_STATUS_LABEL[next]}`)
  }

  const exportFiltered = () => {
    exportCsv(`zenn-leads-${new Date().toISOString().slice(0, 10)}.csv`, filtered, [
      { header: 'Empresa', value: (l) => l.name },
      { header: 'Categoria', value: (l) => l.category },
      { header: 'Endereço', value: (l) => l.address },
      { header: 'Cidade', value: (l) => l.city },
      { header: 'Telefone', value: (l) => l.phone },
      { header: 'Nota Google', value: (l) => l.rating?.toString().replace('.', ',') },
      { header: 'Avaliações', value: (l) => l.reviewsCount },
      { header: 'Website', value: (l) => l.website },
      { header: 'Sem site', value: (l) => (hasNoWebsite(l.website) ? 'SIM' : 'NÃO') },
      { header: 'Google Maps', value: (l) => l.googleMapsUrl },
      { header: 'Facebook', value: (l) => l.facebook },
      { header: 'Instagram', value: (l) => l.instagram },
      { header: 'Status', value: (l) => LEAD_STATUS_LABEL[l.status] },
      { header: 'Último contato', value: (l) => (l.lastContactAt ? formatDate(l.lastContactAt) : '') },
      { header: 'Criado em', value: (l) => formatDate(l.createdAt) },
      { header: 'Dado demo', value: (l) => (l.isDemo ? 'SIM (fictício)' : 'NÃO') },
    ])
    toast.success('CSV exportado', `${filtered.length} leads`)
  }

  const hasDemo = leads.some((l) => l.isDemo)

  return (
    <>
      <PageHeader
        eyebrow={<>CRM de leads {hasDemo && <DemoBadge label="Inclui dados demo" />}</>}
        title="Leads"
        description="Pipeline comercial completo. Arraste os cards no kanban para mudar de etapa — tudo é salvo automaticamente."
        actions={
          <>
            <Segmented<View>
              value={view}
              onChange={(v) => setParam('view', v === 'table' ? null : v)}
              options={[
                { value: 'table', label: 'Tabela', icon: <List /> },
                { value: 'kanban', label: 'Kanban', icon: <KanbanIcon /> },
              ]}
            />
            <Button variant="outline" icon={<Download className="size-4" />} onClick={exportFiltered} disabled={!filtered.length}>
              CSV
            </Button>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              Novo lead
            </Button>
          </>
        }
      />

      <Card className="mb-4 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.1fr]">
        <Input icon={<Search />} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Empresa, telefone, cidade…" />
        <Select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus | 'all')} aria-label="Status">
          <option value="all">Todos os status</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </Select>
        <Select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Cidade">
          <option value="all">Todas as cidades</option>
          {cities.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoria">
          <option value="all">Todas as categorias</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Toggle checked={onlyNoSite} onChange={(v) => setParam('semSite', v ? '1' : null)} label="Somente sem site" />
      </Card>

      <p className="mb-3 text-xs text-muted">
        <span className="font-mono text-fg">{filtered.length}</span> de {leads.length} leads
      </p>

      {leads.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum lead ainda" description="Use Encontrar Leads para prospectar ou cadastre manualmente." action={<Button variant="primary" onClick={() => setCreating(true)}>Novo lead</Button>} />
        </Card>
      ) : view === 'kanban' ? (
        <Kanban
          columns={LEAD_STATUSES}
          items={filtered}
          getStatus={(l) => l.status}
          onMove={moveLead}
          renderCard={(l) => (
            <div className="panel panel-hover p-3" onClick={() => setParam('lead', l.id)}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm leading-snug font-medium">{l.name}</p>
                {hasNoWebsite(l.website) && <span className="mt-0.5 shrink-0 rounded-full bg-white px-1.5 text-[9px] font-semibold tracking-wide text-black uppercase">Sem site</span>}
              </div>
              <p className="mt-1 text-xs text-muted">{l.category} · {l.city}</p>
              <div className="mt-3 flex items-center justify-between">
                <Rating value={l.rating} />
                <span className="font-mono text-[10px] text-faint">{formatRelative(l.createdAt)}</span>
              </div>
              {/* Alternativa ao arrastar em telas touch */}
              <select
                value={l.status}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => moveLead(l, e.target.value as LeadStatus)}
                className="mt-3 w-full rounded-lg border border-line bg-ink px-2 py-1 text-[11px] text-muted lg:hidden"
                aria-label="Mover para etapa"
              >
                {LEAD_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          )}
        />
      ) : (
        <Card className="overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState mascot={false} title="Nenhum lead com esses filtros" />
          ) : (
            <>
              {/* Mobile: cards */}
              <ul className="divide-y divide-line md:hidden">
                {filtered.map((l) => (
                  <li key={l.id} className="p-4" onClick={() => setParam('lead', l.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{l.name}</p>
                        <p className="text-xs text-muted">{l.category} · {l.city}</p>
                      </div>
                      <LeadStatusBadge status={l.status} />
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <WebsiteBadge website={l.website} />
                      <Rating value={l.rating} count={l.reviewsCount} />
                    </div>
                  </li>
                ))}
              </ul>
              {/* Desktop: tabela */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      {['Empresa', 'Categoria', 'Local', 'Nota', 'Telefone', 'Website', 'Status', 'Ações'].map((h) => (
                        <th key={h} className={cn('eyebrow px-4 py-3 font-normal', h === 'Ações' && 'text-right')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l) => (
                      <tr key={l.id} className="data-row">
                        <td className="px-4 py-3">
                          <button onClick={() => setParam('lead', l.id)} className="text-left font-medium hover:underline">{l.name}</button>
                          {l.isDemo && <span className="ml-2 align-middle text-[9px] tracking-widest text-faint uppercase">demo</span>}
                        </td>
                        <td className="px-4 py-3 text-muted">{l.category}</td>
                        <td className="px-4 py-3 text-fg-soft">{l.city}</td>
                        <td className="px-4 py-3"><Rating value={l.rating} count={l.reviewsCount} /></td>
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                          {l.phone ? <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 hover:text-fg"><Phone className="size-3 text-faint" />{l.phone}</a> : <span className="text-faint">—</span>}
                        </td>
                        <td className="px-4 py-3"><WebsiteBadge website={l.website} /></td>
                        <td className="px-4 py-3">
                          <select
                            value={l.status}
                            onChange={(e) => moveLead(l, e.target.value as LeadStatus)}
                            className="cursor-pointer rounded-lg border border-line bg-ink px-2 py-1 text-xs text-fg-soft hover:border-line-strong"
                            aria-label={`Status de ${l.name}`}
                          >
                            {LEAD_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" icon={<Eye className="size-3.5" />} onClick={() => setParam('lead', l.id)}>Ver</Button>
                            <Button size="sm" variant="secondary" icon={<MessageCircle className="size-3.5" />} onClick={() => workflow.contact(l)}>Contatar</Button>
                            <Button size="sm" variant="outline" icon={<UserPlus className="size-3.5" />} onClick={() => workflow.convert(l)}>
                              {l.clientId ? 'Cliente' : 'Converter'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      <LeadDrawer leadId={openLeadId} onClose={() => setParam('lead', null)} />
      <NewLeadModal open={creating} onClose={() => setCreating(false)} onCreated={(id) => setParam('lead', id)} />
      {workflow.modals}
    </>
  )
}

function NewLeadModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { createLead } = useData()
  const toast = useToast()
  const [form, setForm] = useState({ name: '', category: '', city: '', address: '', phone: '', website: '', instagram: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const lead = await createLead({
        name: form.name.trim(),
        category: form.category.trim() || 'Sem categoria',
        city: form.city.trim(),
        address: form.address.trim(),
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        instagram: form.instagram.trim() || null,
        facebook: null,
        googleMapsUrl: form.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${form.name} ${form.address} ${form.city}`)}` : null,
        rating: null,
        reviewsCount: 0,
        status: 'novo',
        source: 'manual',
        placeId: null,
        notes: '',
        clientId: null,
        lastContactAt: null,
      })
      toast.success('Lead cadastrado', lead.name)
      setForm({ name: '', category: '', city: '', address: '', phone: '', website: '', instagram: '' })
      onClose()
      onCreated(lead.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow="Cadastro manual" title="Novo lead">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <FormField label="Empresa" className="sm:col-span-2"><Input value={form.name} onChange={set('name')} required autoFocus /></FormField>
        <FormField label="Categoria"><Input value={form.category} onChange={set('category')} placeholder="Pizzaria" /></FormField>
        <FormField label="Cidade"><Input value={form.city} onChange={set('city')} required /></FormField>
        <FormField label="Endereço" className="sm:col-span-2"><Input value={form.address} onChange={set('address')} /></FormField>
        <FormField label="Telefone"><Input value={form.phone} onChange={set('phone')} placeholder="(19) 99999-0000" /></FormField>
        <FormField label="Instagram"><Input value={form.instagram} onChange={set('instagram')} placeholder="@empresa" /></FormField>
        <FormField label="Website" hint="Vazio = SEM SITE" className="sm:col-span-2"><Input value={form.website} onChange={set('website')} placeholder="https://" /></FormField>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={busy}>Cadastrar</Button>
        </div>
      </form>
    </Modal>
  )
}
