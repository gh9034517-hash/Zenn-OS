import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CircleDollarSign, Mail, MapPin, Pencil, Phone, Plus, Tag, Contact, MessageCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, DemoBadge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Field'
import { Stat } from '@/components/ui/Stat'
import { Progress } from '@/components/ui/Progress'
import { EmptyState } from '@/components/ui/EmptyState'
import { InstagramIcon } from '@/components/ui/BrandIcons'
import { ActivityFeed } from '@/components/ActivityFeed'
import { ProjectCard } from '@/components/ProjectCard'
import { TransactionsTable } from '@/components/TransactionsTable'
import { ClientFormModal } from '@/components/forms/ClientFormModal'
import { ProjectFormModal } from '@/components/forms/ProjectFormModal'
import { TransactionFormModal } from '@/components/forms/TransactionFormModal'
import { useData } from '@/context/DataContext'
import { useToast } from '@/components/ui/Toast'
import { CLIENT_STATUSES } from '@/data/constants'
import type { ClientStatus } from '@/types'
import { clientFinance } from '@/utils/metrics'
import { formatCurrency, formatDate, whatsappLink } from '@/utils/format'

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { clients, projects, transactions, activities, leads, updateClient } = useData()
  const [editing, setEditing] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  const [payment, setPayment] = useState(false)

  const client = clients.find((c) => c.id === id)
  if (!client) {
    return (
      <Card>
        <EmptyState title="Cliente não encontrado" description="Ele pode ter sido removido." action={<Button onClick={() => navigate('/clientes')}>Voltar para clientes</Button>} />
      </Card>
    )
  }

  const fin = clientFinance(client, transactions)
  const clientProjects = projects.filter((p) => p.clientId === client.id)
  const clientTransactions = transactions.filter((t) => t.clientId === client.id)
  const projectIds = new Set(clientProjects.map((p) => p.id))
  const clientActivities = activities.filter(
    (a) =>
      (a.entityType === 'client' && a.entityId === client.id) ||
      (a.entityType === 'project' && a.entityId && projectIds.has(a.entityId)) ||
      (a.entityType === 'transaction' && clientTransactions.some((t) => t.id === a.entityId)) ||
      (a.entityType === 'lead' && a.entityId === client.leadId),
  )
  const lead = leads.find((l) => l.id === client.leadId)
  const wa = whatsappLink(client.phone)

  return (
    <>
      <Link to="/clientes" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Clientes
      </Link>
      <PageHeader
        eyebrow={<>Cliente desde {formatDate(client.createdAt)} {client.isDemo && <DemoBadge />}</>}
        title={client.company}
        description={[client.category, client.city].filter(Boolean).join(' · ')}
        actions={
          <>
            <Select
              value={client.status}
              aria-label="Status do cliente"
              onChange={async (e) => {
                await updateClient(client.id, { status: e.target.value as ClientStatus })
                toast.success('Status atualizado')
              }}
            >
              {CLIENT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
            <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>Editar</Button>
            <Button variant="outline" icon={<Plus className="size-4" />} onClick={() => setCreatingProject(true)}>Projeto</Button>
            <Button variant="primary" icon={<CircleDollarSign className="size-4" />} onClick={() => setPayment(true)}>Registrar pagamento</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Valor contratado" value={formatCurrency(fin.contracted)} hint={`${clientProjects.length} projetos`} />
        <Stat emphasis label="Valor recebido" value={formatCurrency(fin.received)} hint={<Progress value={fin.contracted ? fin.received / fin.contracted : 0} className="mt-1" />} />
        <Stat label="Valor pendente" value={formatCurrency(fin.pending)} hint="Contratado − recebido" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader eyebrow="Ficha" title="Contato" />
          <CardBody className="space-y-3 text-sm">
            <p className="flex items-center gap-3"><Contact className="size-4 text-faint" /> {client.contactName || <span className="text-faint">Sem contato</span>}</p>
            <p className="flex items-center gap-3"><Phone className="size-4 text-faint" /> {client.phone ? <a href={`tel:${client.phone}`} className="font-mono">{client.phone}</a> : <span className="text-faint">—</span>}</p>
            <p className="flex items-center gap-3"><Mail className="size-4 text-faint" /> {client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : <span className="text-faint">—</span>}</p>
            <p className="flex items-center gap-3"><InstagramIcon className="size-4 text-faint" /> {client.instagram ? <a href={`https://instagram.com/${client.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer">{client.instagram}</a> : <span className="text-faint">—</span>}</p>
            <p className="flex items-center gap-3"><MapPin className="size-4 text-faint" /> {client.city || '—'}</p>
            <p className="flex items-center gap-3"><Tag className="size-4 text-faint" /> {client.category || '—'}</p>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs text-fg-soft hover:border-white/30 hover:text-fg">
                <MessageCircle className="size-3.5" /> Abrir WhatsApp
              </a>
            )}
            {lead && (
              <p className="border-t border-line pt-3 text-xs text-muted">
                Originado do lead <Link to={`/leads?lead=${lead.id}`} className="text-fg underline decoration-white/20 underline-offset-4">{lead.name}</Link>
              </p>
            )}
            {client.notes && <p className="border-t border-line pt-3 text-xs whitespace-pre-wrap text-muted">{client.notes}</p>}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader eyebrow="Operação" title="Projetos" action={<Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setCreatingProject(true)}>Novo</Button>} />
          <CardBody>
            {clientProjects.length === 0 ? (
              <EmptyState mascot className="py-6" title="Nenhum projeto" description="Crie o primeiro projeto deste cliente." action={<Button variant="primary" size="sm" onClick={() => setCreatingProject(true)}>Criar projeto</Button>} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {clientProjects.map((p) => <ProjectCard key={p.id} project={p} showStatus />)}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader eyebrow="Financeiro" title="Transações" action={<Badge tone="muted">{clientTransactions.length}</Badge>} className="pb-4" />
          <div className="border-t border-line">
            <TransactionsTable transactions={clientTransactions} showClient={false} />
          </div>
        </Card>
        <Card>
          <CardHeader eyebrow="Histórico" title="Atividades" />
          <CardBody className="pt-3"><ActivityFeed activities={clientActivities} limit={10} /></CardBody>
        </Card>
      </div>

      <ClientFormModal open={editing} onClose={() => setEditing(false)} client={client} />
      <ProjectFormModal open={creatingProject} onClose={() => setCreatingProject(false)} defaultClientId={client.id} />
      <TransactionFormModal open={payment} onClose={() => setPayment(false)} mode="payment" defaultClientId={client.id} />
    </>
  )
}
