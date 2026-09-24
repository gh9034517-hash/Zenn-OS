import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, DemoBadge } from '@/components/ui/Badge'
import { Input, Select } from '@/components/ui/Field'
import { Stat } from '@/components/ui/Stat'
import { EmptyState } from '@/components/ui/EmptyState'
import { Progress } from '@/components/ui/Progress'
import { ClientFormModal } from '@/components/forms/ClientFormModal'
import { useData } from '@/context/DataContext'
import { useToast } from '@/components/ui/Toast'
import { CLIENT_STATUSES, CLIENT_STATUS_LABEL } from '@/data/constants'
import type { ClientStatus } from '@/types'
import { clientFinance } from '@/utils/metrics'
import { formatCurrency, formatCurrencyCompact, normalize } from '@/utils/format'
import { exportCsv } from '@/utils/csv'
import { cn } from '@/utils/cn'

export default function Clients() {
  const { clients, transactions } = useData()
  const navigate = useNavigate()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ClientStatus | 'all'>('all')
  const [creating, setCreating] = useState(false)

  const rows = useMemo(
    () =>
      clients
        .map((c) => ({ client: c, fin: clientFinance(c, transactions) }))
        .filter(
          ({ client: c }) =>
            (status === 'all' || c.status === status) &&
            (!query || normalize(`${c.company} ${c.contactName} ${c.city} ${c.category} ${c.phone} ${c.email}`).includes(normalize(query))),
        ),
    [clients, transactions, query, status],
  )

  const totals = rows.reduce(
    (acc, r) => ({ contracted: acc.contracted + r.fin.contracted, received: acc.received + r.fin.received, pending: acc.pending + r.fin.pending }),
    { contracted: 0, received: 0, pending: 0 },
  )

  const exportRows = () => {
    exportCsv(`zenn-clientes-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
      { header: 'Empresa', value: (r) => r.client.company },
      { header: 'Contato', value: (r) => r.client.contactName },
      { header: 'Telefone', value: (r) => r.client.phone },
      { header: 'E-mail', value: (r) => r.client.email },
      { header: 'Instagram', value: (r) => r.client.instagram },
      { header: 'Cidade', value: (r) => r.client.city },
      { header: 'Categoria', value: (r) => r.client.category },
      { header: 'Status', value: (r) => CLIENT_STATUS_LABEL[r.client.status] },
      { header: 'Valor contratado', value: (r) => r.fin.contracted.toFixed(2).replace('.', ',') },
      { header: 'Valor recebido', value: (r) => r.fin.received.toFixed(2).replace('.', ',') },
      { header: 'Valor pendente', value: (r) => r.fin.pending.toFixed(2).replace('.', ',') },
    ])
    toast.success('CSV exportado', `${rows.length} clientes`)
  }

  return (
    <>
      <PageHeader
        eyebrow={<>CRM {clients.some((c) => c.isDemo) && <DemoBadge label="Inclui dados demo" />}</>}
        title="Clientes"
        description="Carteira ativa com valores contratados, recebidos e pendentes calculados a partir do financeiro."
        actions={
          <>
            <Button variant="outline" icon={<Download className="size-4" />} onClick={exportRows} disabled={!rows.length}>CSV</Button>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Novo cliente</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Clientes" value={rows.length} hint={`${clients.filter((c) => c.status === 'ativo').length} ativos`} />
        <Stat label="Contratado" value={formatCurrencyCompact(totals.contracted)} hint={formatCurrency(totals.contracted)} />
        <Stat emphasis label="Recebido" value={formatCurrencyCompact(totals.received)} hint={formatCurrency(totals.received)} />
        <Stat label="Pendente" value={formatCurrencyCompact(totals.pending)} hint={formatCurrency(totals.pending)} />
      </div>

      <Card className="mb-4 grid gap-2 p-3 sm:grid-cols-[2fr_1fr]">
        <Input icon={<Search />} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Empresa, contato, cidade, telefone…" />
        <Select value={status} onChange={(e) => setStatus(e.target.value as ClientStatus | 'all')}>
          <option value="all">Todos os status</option>
          {CLIENT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
      </Card>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            title={clients.length ? 'Nenhum cliente com esses filtros' : 'Nenhum cliente ainda'}
            description="Converta um lead ou cadastre um cliente manualmente."
            action={<Button variant="primary" onClick={() => setCreating(true)}>Novo cliente</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {['Empresa', 'Contato', 'Cidade', 'Categoria', 'Status', 'Contratado', 'Recebido', 'Pendente'].map((h) => (
                    <th key={h} className={cn('eyebrow px-4 py-3 font-normal', ['Contratado', 'Recebido', 'Pendente'].includes(h) && 'text-right')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ client: c, fin }) => (
                  <tr key={c.id} className="data-row cursor-pointer" onClick={() => navigate(`/clientes/${c.id}`)}>
                    <td className="px-4 py-3">
                      <Link to={`/clientes/${c.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{c.company}</Link>
                      <div className="mt-1.5 w-32"><Progress value={fin.contracted ? fin.received / fin.contracted : 0} /></div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-fg-soft">{c.contactName || '—'}</p>
                      <p className="font-mono text-[11px] text-faint">{c.phone ?? c.email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{c.city}</td>
                    <td className="px-4 py-3 text-muted">{c.category}</td>
                    <td className="px-4 py-3"><Badge tone={c.status === 'ativo' ? 'solid' : c.status === 'onboarding' ? 'outline' : 'muted'}>{CLIENT_STATUS_LABEL[c.status]}</Badge></td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(fin.contracted)}</td>
                    <td className="px-4 py-3 text-right font-mono text-fg">{formatCurrency(fin.received)}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted">{formatCurrency(fin.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ClientFormModal open={creating} onClose={() => setCreating(false)} onSaved={(c) => navigate(`/clientes/${c.id}`)} />
    </>
  )
}
