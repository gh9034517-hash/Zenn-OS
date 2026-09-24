import { Link, useNavigate } from 'react-router-dom'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ArrowUpRight, Briefcase, CircleDollarSign, Clock, Contact, GlobeLock, Radar, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Stat } from '@/components/ui/Stat'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DemoBadge } from '@/components/ui/Badge'
import { Mascot } from '@/components/brand/Mascot'
import { ActivityFeed } from '@/components/ActivityFeed'
import { FunnelChart } from '@/components/charts/FunnelChart'
import { ChartTooltip, Legend } from '@/components/charts/ChartTooltip'
import { CHART, axisProps } from '@/components/charts/theme'
import { useData } from '@/context/DataContext'
import { useSession } from '@/context/SessionContext'
import { useMetrics } from '@/hooks/useMetrics'
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPercent } from '@/utils/format'
import { hasNoWebsite } from '@/services/googlePlaces'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export default function Dashboard() {
  const { activities, leads, hasDemoData } = useData()
  const { session } = useSession()
  const m = useMetrics(6)
  const navigate = useNavigate()
  const hotLeads = leads.filter((l) => hasNoWebsite(l.website) && (l.status === 'novo' || l.status === 'qualificado')).length

  const funnelStages = [
    { label: 'Leads', value: m.funnel.total },
    { label: 'Qualificados', value: m.funnel.qualified },
    { label: 'Contatados', value: m.funnel.contacted },
    { label: 'Responderam', value: m.funnel.responded },
    { label: 'Negociação', value: m.funnel.negotiating },
    { label: 'Convertidos', value: m.funnel.clients },
  ]

  return (
    <>
      <PageHeader
        eyebrow={<>Overview {hasDemoData && <DemoBadge label="Dados demo" />}</>}
        title={
          <>
            {greeting()}, <span className="text-metal font-normal">{session?.name?.split(' ')[0]}</span>
          </>
        }
        description="Visão consolidada de prospecção, CRM, operação e financeiro."
        actions={
          <>
            <Button variant="outline" icon={<Contact className="size-4" />} onClick={() => navigate('/leads')}>
              Ver leads
            </Button>
            <Button variant="primary" icon={<Radar className="size-4" />} onClick={() => navigate('/prospeccao')}>
              Encontrar leads
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Leads" value={formatNumber(m.funnel.total)} hint={`${m.funnel.contacted} contatados`} icon={<Contact />} />
        <Stat
          label="Leads sem site"
          value={formatNumber(m.funnel.withoutSite)}
          hint={formatPercent(m.funnel.total ? m.funnel.withoutSite / m.funnel.total : 0, 0) + ' da base'}
          icon={<GlobeLock />}
          style={{ animationDelay: '40ms' }}
        />
        <Stat label="Clientes" value={formatNumber(m.clientsCount)} hint={`Conversão ${formatPercent(m.conversionRate)}`} icon={<Users />} style={{ animationDelay: '80ms' }} />
        <Stat label="Projetos ativos" value={formatNumber(m.activeProjectsCount)} hint="Fora de concluído" icon={<Briefcase />} style={{ animationDelay: '120ms' }} />
        <Stat emphasis label="Receita" value={formatCurrencyCompact(m.finance.received)} hint={`${formatCurrency(m.finance.received)} recebidos`} icon={<CircleDollarSign />} style={{ animationDelay: '160ms' }} />
        <Stat
          label="Pendente"
          value={formatCurrencyCompact(m.finance.pending + m.finance.overdue)}
          hint={m.finance.overdue ? `${formatCurrencyCompact(m.finance.overdue)} em atraso` : 'Nada em atraso'}
          icon={<Clock />}
          style={{ animationDelay: '200ms' }}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* Hero com o personagem */}
        <Card className="relative overflow-hidden xl:col-span-1">
          <div className="absolute -top-16 -right-16 size-64 rounded-full border border-white/[0.06]" />
          <div className="absolute -top-4 -right-4 size-40 rounded-full border border-dashed border-white/[0.07]" />
          <CardBody className="relative flex h-full flex-col">
            <p className="eyebrow">Zennzinho sugere</p>
            <div className="mt-4 flex items-center gap-4">
              <Mascot size={88} />
              <div>
                <p className="font-mono text-4xl font-light">{hotLeads}</p>
                <p className="text-sm text-muted">leads sem site aguardando o primeiro contato</p>
              </div>
            </div>
            <p className="mt-5 text-sm text-fg-soft">
              Empresas sem site são as oportunidades mais quentes para a Zenn Works. Comece por elas.
            </p>
            <div className="mt-auto flex flex-wrap gap-2 pt-6">
              <Button variant="primary" size="sm" onClick={() => navigate('/leads?semSite=1')} icon={<ArrowUpRight className="size-3.5" />}>
                Abrir leads sem site
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/analytics')}>
                Analytics
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            eyebrow="Prospecção · 6 meses"
            title="Leads"
            action={<Legend items={[{ label: 'Leads', color: CHART.primary }, { label: 'Sem site', color: CHART.secondary, dashed: true }]} />}
          />
          <CardBody className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={m.leadsByMonth} margin={{ left: -24, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity={0.22} />
                    <stop offset="1" stopColor="#fff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
                <Area type="monotone" dataKey="leads" name="Leads" stroke={CHART.primary} strokeWidth={2} fill="url(#leadsFill)" activeDot={{ r: 4, fill: '#fff', stroke: CHART.surface, strokeWidth: 2 }} />
                <Area type="monotone" dataKey="semSite" name="Sem site" stroke={CHART.secondary} strokeWidth={2} strokeDasharray="4 3" fill="transparent" activeDot={{ r: 4, fill: CHART.secondary, stroke: CHART.surface, strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader eyebrow="Financeiro · 6 meses" title="Receita" action={<Legend items={[{ label: 'Recebido', color: CHART.primary }, { label: 'Pendente', color: CHART.tertiary }]} />} />
          <CardBody className="h-60 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.revenueByMonth} margin={{ left: -8, right: 4, top: 8 }} barGap={2}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis width={60} {...axisProps} tickFormatter={(v) => formatCurrencyCompact(v).replace('R$', '').trim()} />
                <Tooltip content={<ChartTooltip format={formatCurrency} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="recebido" name="Recebido" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="pendente" name="Pendente" fill={CHART.tertiary} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader eyebrow="Comercial · clientes / leads do mês" title="Conversão" action={<span className="font-mono text-sm">{formatPercent(m.conversionRate)}</span>} />
          <CardBody className="h-60 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={m.conversionByMonth} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <Tooltip content={<ChartTooltip format={(v) => formatPercent(v)} />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
                <Line type="monotone" dataKey="taxa" name="Conversão" stroke={CHART.primary} strokeWidth={2} dot={{ r: 3, fill: CHART.surface, stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5, fill: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader eyebrow="Operação" title="Projetos por etapa" action={<Link to="/projetos" className="text-xs text-muted hover:text-fg">Kanban →</Link>} />
          <CardBody className="h-60 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.projectsByStatus} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke={CHART.grid} horizontal={false} />
                <XAxis type="number" allowDecimals={false} {...axisProps} />
                <YAxis type="category" dataKey="label" width={112} {...axisProps} tick={{ ...axisProps.tick, fontFamily: 'Inter Tight, system-ui, sans-serif' }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="total" name="Projetos" fill={CHART.secondary} radius={[0, 4, 4, 0]} maxBarSize={12} activeBar={{ fill: '#fff' }} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader eyebrow="Pipeline" title="Funil comercial" action={<Link to="/leads?view=kanban" className="text-xs text-muted hover:text-fg">Kanban →</Link>} />
          <CardBody>
            <FunnelChart stages={funnelStages} />
            <p className="mt-5 text-xs text-faint">{m.funnel.lost} leads marcados como perdidos (fora do funil).</p>
          </CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader eyebrow="Log" title="Atividades recentes" />
          <CardBody className="pt-3">
            <ActivityFeed activities={activities} limit={8} />
          </CardBody>
        </Card>
      </div>
    </>
  )
}
