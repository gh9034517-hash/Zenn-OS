import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CircleDollarSign, Download, Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Stat } from '@/components/ui/Stat'
import { DemoBadge } from '@/components/ui/Badge'
import { Input, Select } from '@/components/ui/Field'
import { ChartTooltip, Legend } from '@/components/charts/ChartTooltip'
import { CHART, axisProps } from '@/components/charts/theme'
import { TransactionsTable } from '@/components/TransactionsTable'
import { TransactionFormModal } from '@/components/forms/TransactionFormModal'
import { useData } from '@/context/DataContext'
import { useToast } from '@/components/ui/Toast'
import { useMetrics } from '@/hooks/useMetrics'
import { financeSummary, isOverdue } from '@/utils/metrics'
import { formatCurrency, formatCurrencyCompact, formatDate, normalize } from '@/utils/format'
import { exportCsv } from '@/utils/csv'
import { PAYMENT_METHOD_LABEL } from '@/data/constants'

type StatusFilter = 'all' | 'pago' | 'pendente' | 'atrasado'

export default function Finance() {
  const { transactions, clients } = useData()
  const toast = useToast()
  const m = useMetrics(6)
  const f = financeSummary(transactions)
  const [modal, setModal] = useState<null | 'payment' | 'transaction'>(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'all' | 'receita' | 'despesa'>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [clientId, setClientId] = useState('all')

  const filtered = useMemo(
    () =>
      transactions.filter(
        (t) =>
          (type === 'all' || t.type === type) &&
          (status === 'all' || (status === 'atrasado' ? isOverdue(t) : status === 'pendente' ? t.status === 'pendente' && !isOverdue(t) : t.status === status)) &&
          (clientId === 'all' || t.clientId === clientId) &&
          (!query || normalize(`${t.description} ${clients.find((c) => c.id === t.clientId)?.company ?? ''}`).includes(normalize(query))),
      ),
    [transactions, type, status, clientId, query, clients],
  )

  const exportRows = () => {
    exportCsv(`zenn-financeiro-${new Date().toISOString().slice(0, 10)}.csv`, filtered, [
      { header: 'Data', value: (t) => formatDate(t.date) },
      { header: 'Cliente', value: (t) => clients.find((c) => c.id === t.clientId)?.company ?? '' },
      { header: 'Descrição', value: (t) => t.description },
      { header: 'Tipo', value: (t) => t.type },
      { header: 'Status', value: (t) => (isOverdue(t) ? 'atrasado' : t.status) },
      { header: 'Método', value: (t) => PAYMENT_METHOD_LABEL[t.method] },
      { header: 'Valor', value: (t) => t.amount.toFixed(2).replace('.', ',') },
    ])
    toast.success('CSV exportado', `${filtered.length} transações`)
  }

  return (
    <>
      <PageHeader
        eyebrow={<>Financeiro {transactions.some((t) => t.isDemo) && <DemoBadge label="Inclui dados demo" />}</>}
        title="Financeiro"
        description="Receitas, pagamentos, pendências e despesas. Tudo alimenta o dashboard e as fichas de clientes."
        actions={
          <>
            <Button variant="outline" icon={<Download className="size-4" />} onClick={exportRows} disabled={!filtered.length}>CSV</Button>
            <Button variant="outline" icon={<Plus className="size-4" />} onClick={() => setModal('transaction')}>Transação</Button>
            <Button variant="primary" icon={<CircleDollarSign className="size-4" />} onClick={() => setModal('payment')}>Registrar pagamento</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Receita total" value={formatCurrencyCompact(f.revenueTotal)} hint={formatCurrency(f.revenueTotal)} />
        <Stat emphasis label="Recebido" value={formatCurrencyCompact(f.received)} hint={formatCurrency(f.received)} />
        <Stat label="Pendente" value={formatCurrencyCompact(f.pending)} hint="A vencer" />
        <Stat label="Atrasado" value={formatCurrencyCompact(f.overdue)} hint={f.overdue ? 'Vencido e não pago' : 'Nada em atraso'} className={f.overdue ? 'border-danger/25' : ''} />
        <Stat label="Despesas" value={formatCurrencyCompact(f.expenses)} hint={`${formatCurrencyCompact(f.expensesPaid)} pagas`} />
        <Stat label="Lucro" value={formatCurrencyCompact(f.profit)} hint="Recebido − despesas pagas" />
      </div>

      <Card className="mt-4">
        <CardHeader
          eyebrow="Fluxo · 6 meses"
          title="Receitas x despesas"
          action={<Legend items={[{ label: 'Recebido', color: CHART.primary }, { label: 'Pendente', color: CHART.secondary }, { label: 'Despesas', color: CHART.tertiary }]} />}
        />
        <CardBody className="h-64 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={m.revenueByMonth} margin={{ left: -4, right: 4, top: 8 }} barGap={2}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis width={60} {...axisProps} tickFormatter={(v) => formatCurrencyCompact(v).replace('R$', '').trim()} />
              <Tooltip content={<ChartTooltip format={formatCurrency} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="recebido" name="Recebido" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar dataKey="pendente" name="Pendente" fill={CHART.secondary} radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar dataKey="despesas" name="Despesas" fill={CHART.tertiary} radius={[4, 4, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="grid gap-2 border-b border-line p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input icon={<Search />} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Descrição ou cliente…" />
          <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="all">Receitas e despesas</option>
            <option value="receita">Receitas</option>
            <option value="despesa">Despesas</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="all">Todos os status</option>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
            <option value="atrasado">Atrasado</option>
          </Select>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="all">Todos os clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
          </Select>
        </div>
        <p className="px-4 pt-3 text-xs text-muted"><span className="font-mono text-fg">{filtered.length}</span> transações</p>
        <TransactionsTable transactions={filtered} allowDelete />
      </Card>

      <TransactionFormModal open={modal !== null} mode={modal ?? 'transaction'} onClose={() => setModal(null)} />
    </>
  )
}
