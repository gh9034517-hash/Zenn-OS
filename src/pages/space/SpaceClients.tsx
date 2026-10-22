import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, MapPin, MessageCircle, Phone, Plus, Search, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Stat } from '@/components/ui/Stat'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/components/space/Money'
import { jobKindIcon } from '@/components/space/JobForms'
import { useSpacePage } from '@/layouts/SpaceLayout'
import { useSpaces } from '@/context/SpacesContext'
import { clientsFromJobs, jobStatusLabel, type ClientSummary } from '@/services/spaceMath'
import { formatCurrency, formatRelative, normalize, whatsappLink } from '@/utils/format'
import { cn } from '@/utils/cn'

type Filter = 'aberto' | 'fechar' | 'devendo' | 'todos'

/** Mensagem pronta para o WhatsApp, conforme a situação do cliente. */
function message(c: ClientSummary) {
  const first = c.name.split(' ')[0]
  if (c.toReceive > 0) {
    const job = c.active[0] ?? c.jobs.find((j) => j.status === 'entregue')
    return `Olá, ${first}! Tudo bem? Passando para lembrar do valor em aberto${job ? ` do ${job.title}` : ''}: ${formatCurrency(c.toReceive)}. Qualquer coisa, estou à disposição.`
  }
  if (c.quotes.length) return `Olá, ${first}! Tudo bem? Conseguiu ver o orçamento do ${c.quotes[0].title}? Posso ajudar em algo para fecharmos?`
  return `Olá, ${first}! Tudo bem? `
}

export default function SpaceClients() {
  const { space, readOnly } = useSpacePage()
  const { jobs, entries } = useSpaces()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('aberto')
  const [query, setQuery] = useState('')

  const all = useMemo(() => clientsFromJobs(jobs.filter((j) => j.spaceId === space.id), entries), [jobs, entries, space.id])
  const shown = all.filter(
    (c) =>
      (filter === 'todos' ||
        (filter === 'aberto' && (c.active.length > 0 || c.quotes.length > 0 || c.toReceive > 0)) ||
        (filter === 'fechar' && c.quotes.length > 0) ||
        (filter === 'devendo' && c.toReceive > 0)) &&
      (!query || normalize(`${c.name} ${c.phone ?? ''} ${c.address}`).includes(normalize(query))),
  )
  const owing = all.filter((c) => c.toReceive > 0)
  const closing = all.filter((c) => c.quotes.length > 0)

  const newJob = (c?: ClientSummary) =>
    navigate(`/e/${space.id}/servicos`, { state: { newJob: c ? { client: c.name, phone: c.phone, address: c.address } : {} } })

  const chips: { id: Filter; label: string }[] = [
    { id: 'aberto', label: 'Com algo em aberto' },
    { id: 'fechar', label: `Para fechar (${closing.length})` },
    { id: 'devendo', label: `Devendo (${owing.length})` },
    { id: 'todos', label: `Todos (${all.length})` },
  ]

  return (
    <>
      <PageHeader
        eyebrow={space.name}
        title="Clientes"
        description="Quem tem serviço em andamento, quem está para fechar e quem ainda deve. Toque no WhatsApp e a mensagem já vai pronta."
        actions={
          !readOnly && (
            <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => newJob()}>
              Novo cliente para fechar
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Clientes" value={all.length} hint={`${all.filter((c) => c.active.length).length} com serviço em andamento`} />
        <Stat label="Para fechar" value={closing.length} hint={<><Money value={closing.reduce((a, c) => a + c.quotes.reduce((s, j) => s + j.value, 0), 0)} /> em orçamentos</>} />
        <Stat emphasis label="A receber" value={<Money value={owing.reduce((a, c) => a + c.toReceive, 0)} />} hint={`de ${owing.length} ${owing.length === 1 ? 'cliente' : 'clientes'}`} />
        <Stat label="Já fecharam" value={<Money value={all.reduce((a, c) => a + c.total, 0)} />} hint="soma dos serviços fechados" />
      </div>

      <div className="mt-4 mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {chips.map((c) => (
            <button key={c.id} onClick={() => setFilter(c.id)} className={cn('chip', filter === c.id && 'chip-on')}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto sm:w-72">
          <Input icon={<Search />} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome, telefone, endereço…" />
        </div>
      </div>

      {shown.length ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {shown.map((c) => {
            const wa = whatsappLink(c.phone, message(c))
            const open = [...c.quotes, ...c.active]
            return (
              <Card key={c.key} className="flex flex-col p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong font-display text-[11px] tracking-wider text-fg-soft">
                    {c.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase())
                      .join('')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{c.name}</p>
                    <p className="text-xs text-muted">
                      {c.jobs.length} {c.jobs.length === 1 ? 'serviço' : 'serviços'} · último movimento {formatRelative(c.lastActivity)}
                    </p>
                  </div>
                  {c.toReceive > 0 && (
                    <span className="shrink-0 text-right">
                      <span className="block text-[10px] tracking-widest text-danger uppercase">deve</span>
                      <Money value={c.toReceive} className="text-sm text-fg" />
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted">
                  {c.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="size-3.5" /> {c.phone}
                    </p>
                  )}
                  {c.address && (
                    <p className="flex items-center gap-2 truncate">
                      <MapPin className="size-3.5 shrink-0" /> {c.address}
                    </p>
                  )}
                </div>
                {open.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {open.map((j) => {
                      const Icon = jobKindIcon(j.kind)
                      return (
                        <li key={j.id}>
                          <button
                            onClick={() => navigate(`/e/${space.id}/servicos?abrir=${j.id}`)}
                            className="flex w-full items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-left text-sm transition hover:border-line-strong"
                          >
                            <Icon className="size-3.5 shrink-0 text-faint" />
                            <span className="min-w-0 flex-1 truncate">{j.title}</span>
                            <span className="shrink-0 text-[11px] text-muted">{jobStatusLabel(j.status, j.kind)}</span>
                            <ArrowRight className="size-3.5 shrink-0 text-faint" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-xs font-medium text-fg transition hover:bg-white/[0.04]"
                    >
                      <MessageCircle className="size-3.5" /> {c.toReceive > 0 ? 'Cobrar no WhatsApp' : c.quotes.length ? 'Lembrar do orçamento' : 'WhatsApp'}
                    </a>
                  )}
                  {!readOnly && (
                    <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => newJob(c)}>
                      Novo serviço
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            title={all.length ? 'Ninguém nesse filtro' : 'Nenhum cliente ainda'}
            description={
              all.length
                ? 'Troque o filtro ou a busca.'
                : 'Os clientes aparecem aqui sozinhos quando você cadastra um serviço com o nome do cliente.'
            }
            action={
              !readOnly &&
              !all.length && (
                <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => newJob()}>
                  Novo cliente para fechar
                </Button>
              )
            }
          />
        </Card>
      )}
    </>
  )
}
