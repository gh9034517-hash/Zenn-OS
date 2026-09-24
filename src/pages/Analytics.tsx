import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Stat'
import { Segmented } from '@/components/ui/Segmented'
import { DemoBadge } from '@/components/ui/Badge'
import { FunnelChart } from '@/components/charts/FunnelChart'
import { ChartTooltip, Legend } from '@/components/charts/ChartTooltip'
import { CHART, axisProps } from '@/components/charts/theme'
import { useData } from '@/context/DataContext'
import { useMetrics } from '@/hooks/useMetrics'
import { hasNoWebsite } from '@/services/googlePlaces'
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPercent } from '@/utils/format'

function groupCount<T>(rows: T[], key: (r: T) => string) {
  const map = new Map<string, { total: number; semSite: number }>()
  rows.forEach((r) => {
    const k = key(r) || '—'
    const cur = map.get(k) ?? { total: 0, semSite: 0 }
    cur.total++
    map.set(k, cur)
  })
  return map
}

export default function Analytics() {
  const { leads, hasDemoData } = useData()
  const [months, setMonths] = useState<'3' | '6' | '12'>('6')
  const m = useMetrics(Number(months))

  const byCategory = useMemo(() => {
    const map = groupCount(leads, (l) => l.category)
    leads.forEach((l) => hasNoWebsite(l.website) && map.get(l.category || '—')!.semSite++)
    return [...map.entries()].map(([label, v]) => ({ label, ...v, comSite: v.total - v.semSite })).sort((a, b) => b.total - a.total).slice(0, 8)
  }, [leads])

  const byCity = useMemo(() => {
    const map = groupCount(leads, (l) => l.city)
    return [...map.entries()].map(([label, v]) => ({ label, total: v.total })).sort((a, b) => b.total - a.total).slice(0, 8)
  }, [leads])

  const ratingBuckets = useMemo(() => {
    const buckets = [
      { label: '< 3,5', min: 0, max: 3.5 },
      { label: '3,5–4', min: 3.5, max: 4 },
      { label: '4–4,5', min: 4, max: 4.5 },
      { label: '4,5+', min: 4.5, max: 5.1 },
    ]
    return buckets.map((b) => ({ label: b.label, total: leads.filter((l) => l.rating !== null && l.rating >= b.min && l.rating < b.max).length }))
  }, [leads])

  const f = m.funnel
  const cards = [
    { label: 'Leads', value: formatNumber(f.total) },
    { label: 'Leads sem site', value: formatNumber(f.withoutSite), hint: formatPercent(f.total ? f.withoutSite / f.total : 0, 0) },
    { label: 'Contatados', value: formatNumber(f.contacted), hint: formatPercent(f.total ? f.contacted / f.total : 0, 0) + ' dos leads' },
    { label: 'Respostas', value: formatNumber(f.responded), hint: formatPercent(f.contacted ? f.responded / f.contacted : 0, 0) + ' dos contatados' },
    { label: 'Negociações', value: formatNumber(f.negotiating), hint: 'Chegaram à negociação' },
    { label: 'Clientes', value: formatNumber(m.clientsCount), hint: `${f.clients} vindos de leads` },
    { label: 'Conversão', value: formatPercent(m.conversionRate), hint: 'Leads → clientes', emphasis: true },
    { label: 'Ticket médio', value: formatCurrencyCompact(m.averageTicket), hint: formatCurrency(m.averageTicket) },
    { label: 'Receita', value: formatCurrencyCompact(m.finance.received), hint: 'Recebido', emphasis: true },
  ]

  return (
    <>
      <PageHeader
        eyebrow={<>Analytics {hasDemoData && <DemoBadge label="Inclui dados demo" />}</>}
        title="Analytics"
        description="Indicadores comerciais e financeiros calculados em tempo real a partir dos dados salvos."
        actions={<Segmented value={months} onChange={setMonths} options={[{ value: '3', label: '3 meses' }, { value: '6', label: '6 meses' }, { value: '12', label: '12 meses' }]} />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map((c, i) => (
          <Stat key={c.label} label={c.label} value={c.value} hint={c.hint} emphasis={c.emphasis} style={{ animationDelay: `${i * 30}ms` }} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Prospecção" title="Leads por mês" action={<Legend items={[{ label: 'Leads', color: CHART.primary }, { label: 'Sem site', color: CHART.secondary, dashed: true }, { label: 'Novos clientes', color: CHART.tertiary }]} />} />
          <CardBody className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={m.leadsByMonth} margin={{ left: -24, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="aLeads" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity={0.2} /><stop offset="1" stopColor="#fff" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
                <Area type="monotone" dataKey="leads" name="Leads" stroke={CHART.primary} strokeWidth={2} fill="url(#aLeads)" />
                <Area type="monotone" dataKey="semSite" name="Sem site" stroke={CHART.secondary} strokeDasharray="4 3" strokeWidth={2} fill="transparent" />
                <Area type="monotone" dataKey="clientes" name="Novos clientes" stroke={CHART.tertiary} strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader eyebrow="Financeiro" title="Receita por mês" action={<Legend items={[{ label: 'Recebido', color: CHART.primary }, { label: 'Pendente', color: CHART.tertiary }]} />} />
          <CardBody className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.revenueByMonth} margin={{ left: -4, right: 4, top: 8 }} barGap={2}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis width={60} {...axisProps} tickFormatter={(v) => formatCurrencyCompact(v).replace('R$', '').trim()} />
                <Tooltip content={<ChartTooltip format={formatCurrency} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="recebido" name="Recebido" stackId="r" fill={CHART.primary} maxBarSize={22} />
                <Bar dataKey="pendente" name="Pendente" stackId="r" fill={CHART.tertiary} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader eyebrow="Mercado" title="Leads por categoria" action={<Legend items={[{ label: 'Sem site', color: CHART.primary }, { label: 'Com site', color: CHART.tertiary }]} />} />
          <CardBody className="h-72 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke={CHART.grid} horizontal={false} />
                <XAxis type="number" allowDecimals={false} {...axisProps} />
                <YAxis type="category" dataKey="label" width={130} {...axisProps} tick={{ ...axisProps.tick, fontFamily: 'Inter Tight, system-ui, sans-serif' }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="semSite" name="Sem site" stackId="s" fill={CHART.primary} maxBarSize={12} />
                <Bar dataKey="comSite" name="Com site" stackId="s" fill={CHART.tertiary} radius={[0, 4, 4, 0]} maxBarSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader eyebrow="Pipeline" title="Funil comercial" />
          <CardBody>
            <FunnelChart
              stages={[
                { label: 'Leads', value: f.total },
                { label: 'Qualificados', value: f.qualified },
                { label: 'Contatados', value: f.contacted },
                { label: 'Responderam', value: f.responded },
                { label: 'Negociação', value: f.negotiating },
                { label: 'Convertidos', value: f.clients },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader eyebrow="Geografia" title="Leads por cidade" />
          <CardBody className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCity} margin={{ left: -24, right: 4, top: 8 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} tick={{ ...axisProps.tick, fontSize: 10 }} interval={0} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="total" name="Leads" fill={CHART.secondary} radius={[4, 4, 0, 0]} maxBarSize={28} activeBar={{ fill: '#fff' }} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader eyebrow="Reputação" title="Distribuição de notas Google" />
          <CardBody className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingBuckets} margin={{ left: -24, right: 4, top: 8 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="total" name="Leads" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
