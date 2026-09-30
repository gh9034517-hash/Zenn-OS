import { useMemo, useState, type FormEvent } from 'react'
import { Bookmark, BookmarkCheck, Download, Eye, MapPin, MessageCircle, Radar, Search, UserPlus, Tag, Ruler, AlertTriangle, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { LeadDrawer } from '@/components/leads/LeadDrawer'
import { ResultCard, ResultsSkeleton, categoriaLabel } from '@/components/leads/ResultCard'
import { LeadStatusBadge, Rating, WebsiteBadge } from '@/components/leads/LeadBadges'
import { useData } from '@/context/DataContext'
import { useLeadWorkflow } from '@/hooks/useLeadWorkflow'
import { searchPlaces, hasNoWebsite, type PlacesSearchResponse } from '@/services/googlePlaces'
import type { PlaceResult } from '@/types'
import { exportCsv } from '@/utils/csv'
import { formatNumber, formatRelative } from '@/utils/format'
import { cn } from '@/utils/cn'

// v2: a chave antiga pode guardar resultados DEMO (fictícios) de versões
// anteriores — trocar o nome descarta esse cache no celular do usuário.
const LAST_SEARCH_KEY = 'zenn-os:last-search:v2'
const LAST_CITY_KEY = 'zenn-os:last-city'

/** Nichos mais prospectados — evitam digitar no celular. */
const NICHOS_RAPIDOS = [
  'Pizzarias',
  'Barbearias',
  'Salões de beleza',
  'Padarias',
  'Restaurantes',
  'Academias',
  'Oficinas',
  'Pet shops',
  'Clínicas',
  'Lanchonetes',
]

/** A última busca ficava em sessionStorage e sumia ao fechar o navegador. */
function readLastSearch(): PlacesSearchResponse | null {
  try {
    const raw = localStorage.getItem(LAST_SEARCH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PlacesSearchResponse
    // Defesa extra: nunca restaura nada que não seja dado real.
    if (parsed.mode !== 'live' || parsed.results.some((r) => (r.source as string) === 'demo')) return null
    return parsed
  } catch {
    return null
  }
}

function readLastCity(): string {
  try {
    return localStorage.getItem(LAST_CITY_KEY) ?? ''
  } catch {
    return ''
  }
}

export default function FindLeads() {
  const { findLeadByPlace, leads } = useData()
  const toast = useToast()
  const workflow = useLeadWorkflow()
  const last = readLastSearch()

  const [niche, setNiche] = useState(last?.query.niche ?? '')
  const [city, setCity] = useState(last?.query.city ?? readLastCity())
  const [radius, setRadius] = useState(String(last?.query.radiusKm ?? 10))
  const [response, setResponse] = useState<PlacesSearchResponse | null>(last)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ligado por padrão: a ferramenta existe para achar quem NÃO tem site.
  const [onlyNoSite, setOnlyNoSite] = useState(true)
  const [withPhone, setWithPhone] = useState(false)
  const [minRating, setMinRating] = useState('0')
  const [preview, setPreview] = useState<PlaceResult | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [savingAll, setSavingAll] = useState(false)

  const buscar = async (nichoBusca: string, cidadeBusca: string) => {
    if (!nichoBusca.trim() || !cidadeBusca.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await searchPlaces({ niche: nichoBusca.trim(), city: cidadeBusca.trim(), radiusKm: Number(radius) || 10 })
      setResponse(res)
      try {
        localStorage.setItem(LAST_SEARCH_KEY, JSON.stringify(res))
        localStorage.setItem(LAST_CITY_KEY, cidadeBusca.trim())
      } catch {
        /* armazenamento indisponível: a busca continua valendo */
      }
      const comTel = res.results.filter((r) => r.phone).length
      const fonte = res.source === 'google' ? 'Google Maps' : 'OpenStreetMap'
      if (res.results.length) {
        toast.success(`${res.results.length} empresas encontradas`, `${comTel} com telefone · ${fonte}`)
      } else {
        toast.info('Nenhuma empresa encontrada', 'Tente aumentar o raio ou outro nicho')
      }
      if (res.notice) toast.info('Aviso', res.notice)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na busca')
    } finally {
      setLoading(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void buscar(niche, city)
  }

  /** Atalho de nicho: já dispara a busca quando a cidade está preenchida. */
  const usarNicho = (n: string) => {
    setNiche(n)
    if (city.trim()) void buscar(n, city)
  }

  const filtered = useMemo(() => {
    if (!response) return []
    const rating = Number(minRating) || 0
    return response.results.filter(
      (r) =>
        (!onlyNoSite || hasNoWebsite(r.website)) &&
        (!withPhone || !!r.phone) &&
        (r.rating ?? 0) >= rating,
    )
  }, [response, onlyNoSite, withPhone, minRating])

  const noSiteCount = response?.results.filter((r) => hasNoWebsite(r.website)).length ?? 0
  const phoneCount = response?.results.filter((r) => !!r.phone).length ?? 0
  // O OpenStreetMap não tem nota nem avaliações: colunas vazias só poluem.
  const hasRatings = response?.source === 'google'

  // Salvar em lote: o fluxo antigo obrigava a salvar um por um.
  const naoSalvos = useMemo(() => filtered.filter((r) => !findLeadByPlace(r.placeId)), [filtered, findLeadByPlace])

  const salvarTodos = async () => {
    if (!naoSalvos.length) return
    setSavingAll(true)
    let ok = 0
    try {
      // Em série: o provedor Supabase faz uma escrita por lead e uma rajada
      // paralela de dezenas de inserts costuma ser barrada por rate limit.
      for (const r of naoSalvos) {
        try {
          await workflow.save(r)
          ok++
        } catch {
          /* segue para o próximo; o total informado no fim reflete o real */
        }
      }
      toast.success(`${ok} leads salvos no CRM`, ok < naoSalvos.length ? `${naoSalvos.length - ok} falharam` : undefined)
    } finally {
      setSavingAll(false)
    }
  }

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id)
    try {
      await fn()
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : undefined)
    } finally {
      setBusyId(null)
    }
  }

  const exportFiltered = () => {
    if (!filtered.length) return
    const q = response!.query
    exportCsv(`zenn-leads-${q.niche}-${q.city}.csv`.replace(/\s+/g, '-').toLowerCase(), filtered, [
      { header: 'Empresa', value: (r) => r.name },
      { header: 'Categoria', value: (r) => r.category },
      { header: 'Endereço', value: (r) => r.address },
      { header: 'Cidade', value: (r) => r.city },
      { header: 'Telefone', value: (r) => r.phone },
      { header: 'Nota Google', value: (r) => r.rating?.toString().replace('.', ',') },
      { header: 'Avaliações', value: (r) => r.reviewsCount },
      { header: 'Website', value: (r) => r.website },
      { header: 'Sem site', value: (r) => (hasNoWebsite(r.website) ? 'SIM' : 'NÃO') },
      { header: 'Google Maps', value: (r) => r.googleMapsUrl },
      { header: 'Facebook', value: (r) => r.facebook },
      { header: 'Instagram', value: (r) => r.instagram },
      { header: 'Fonte', value: (r) => (r.source === 'google_places' ? 'Google Maps' : 'OpenStreetMap') },
    ])
    toast.success('CSV exportado', `${filtered.length} leads`)
  }

  return (
    <>
      <PageHeader
        eyebrow="Prospecção"
        title="Encontrar leads"
        description="Busque empresas por nicho e cidade. Quem não tem site aparece destacado — são as melhores oportunidades."
      />

      <Card className="p-4 sm:p-5">
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1.3fr_1.3fr_0.6fr_auto] md:items-end">
          <FormField label="Nicho" htmlFor="niche">
            <Input id="niche" icon={<Tag />} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ex.: Pizzarias" required />
          </FormField>
          <FormField label="Cidade" htmlFor="city">
            <Input id="city" icon={<MapPin />} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex.: Campinas" required />
          </FormField>
          <FormField label="Raio" htmlFor="radius">
            <div className="relative">
              <Input id="radius" icon={<Ruler />} type="number" min={1} max={50} value={radius} onChange={(e) => setRadius(e.target.value)} className="pr-10" />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-faint">km</span>
            </div>
          </FormField>
          <Button type="submit" variant="primary" size="lg" loading={loading} icon={<Search className="size-4" />} className="h-[42px]">
            Buscar
          </Button>
        </form>

        {/* Atalhos: digitar nicho no celular é o passo mais chato do fluxo.
            Com a cidade preenchida, um toque já dispara a busca. */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {NICHOS_RAPIDOS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => usarNicho(n)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs transition-colors',
                niche.toLowerCase() === n.toLowerCase()
                  ? 'border-white/60 bg-white text-black'
                  : 'border-line text-muted hover:border-white/30 hover:text-fg',
              )}
            >
              {n}
            </button>
          ))}
        </div>

      </Card>

      {error && (
        <div className="mt-4 flex animate-fade-in flex-col gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-4 sm:flex-row sm:items-center">
          <AlertTriangle className="size-5 shrink-0 text-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">A busca não conseguiu buscar dados reais agora</p>
            <p className="mt-0.5 text-xs break-words text-muted">
              Nenhum resultado foi inventado. Detalhe técnico: {error}
            </p>
          </div>
          <Button size="sm" variant="outline" loading={loading} icon={<RotateCcw className="size-3.5" />} onClick={() => void buscar(niche, city)}>
            Tentar de novo
          </Button>
        </div>
      )}

      {/* Com erro e sem resultado anterior, o painel de erro já diz tudo. */}
      {(loading || response || !error) && (
      <Card className="mt-4 overflow-hidden">
        {loading ? (
          <ResultsSkeleton label={`Buscando ${niche.toLowerCase()} em ${city}…`} />
        ) : !response ? (
          <EmptyState
            title="Pronto para prospectar"
            description="Informe um nicho e uma cidade. Ex.: Pizzarias · Campinas · 10 km."
            action={
              <Button
                variant="outline"
                icon={<Radar className="size-4" />}
                onClick={() => {
                  setNiche('Pizzarias')
                  setCity('Campinas')
                  setRadius('10')
                }}
              >
                Usar exemplo
              </Button>
            }
          />
        ) : (
          <>
            <div className="space-y-3 border-b border-line px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-fg">
                    <span className="font-mono text-lg">{response.results.length}</span>{' '}
                    <span className="text-muted">{response.query.niche.toLowerCase()} em</span>{' '}
                    {response.resolvedCity || response.query.city}
                  </p>
                  <p className="mt-0.5 text-xs text-faint">
                    {response.source === 'google' ? 'Google Maps' : 'OpenStreetMap'} · raio de {response.query.radiusKm} km ·{' '}
                    {formatRelative(response.fetchedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={savingAll}
                    icon={<Bookmark className="size-3.5" />}
                    onClick={salvarTodos}
                    disabled={!naoSalvos.length}
                    title={naoSalvos.length ? `Salvar ${naoSalvos.length} leads no CRM` : 'Todos já estão salvos'}
                  >
                    Salvar {naoSalvos.length ? `${naoSalvos.length} ` : ''}no CRM
                  </Button>
                  <Button variant="outline" size="sm" icon={<Download className="size-3.5" />} onClick={exportFiltered} disabled={!filtered.length} aria-label="Exportar CSV">
                    <span className="hidden sm:inline">CSV</span>
                  </Button>
                </div>
              </div>

              {/* Filtros como pílulas: um toque liga/desliga, com a contagem à vista. */}
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
                <button type="button" className={cn('chip', onlyNoSite && 'chip-on')} onClick={() => setOnlyNoSite((v) => !v)} aria-pressed={onlyNoSite}>
                  Sem site <span className="font-mono opacity-70">{noSiteCount}</span>
                </button>
                <button type="button" className={cn('chip', withPhone && 'chip-on')} onClick={() => setWithPhone((v) => !v)} aria-pressed={withPhone}>
                  Com telefone <span className="font-mono opacity-70">{phoneCount}</span>
                </button>
                {response.source === 'google' && (
                  <button type="button" className={cn('chip', Number(minRating) > 0 && 'chip-on')} onClick={() => setMinRating((v) => (Number(v) > 0 ? '0' : '4'))} aria-pressed={Number(minRating) > 0}>
                    Nota 4+
                  </button>
                )}
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState mascot={false} title="Nenhum resultado com esses filtros" description="Desligue um dos filtros acima, aumente o raio ou tente um nicho vizinho." />
            ) : (
              <>
              {/* Celular: cartões. A tabela precisa de 980px e virava rolagem
                  lateral, escondendo justamente os botões de ação. */}
              <ul className="divide-y divide-line lg:hidden">
                {filtered.map((r, i) => (
                  <ResultCard
                    key={r.placeId}
                    r={r}
                    saved={findLeadByPlace(r.placeId)}
                    busy={busyId === r.placeId}
                    delay={Math.min(i, 12) * 25}
                    onContact={() => workflow.contact(r)}
                    onSave={() => run(r.placeId, () => workflow.save(r))}
                    onPreview={() => setPreview(r)}
                  />
                ))}
              </ul>

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      {['Empresa', 'Categoria', 'Local', ...(hasRatings ? ['Nota', 'Avaliações'] : []), 'Telefone', 'Website', 'Status', 'Ações'].map((h) => (
                        <th key={h} className={cn('eyebrow px-4 py-3 font-normal', h === 'Ações' && 'text-right')}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const saved = findLeadByPlace(r.placeId)
                      const busy = busyId === r.placeId
                      return (
                        <tr key={r.placeId} className={cn('data-row animate-fade-in', hasNoWebsite(r.website) && 'bg-white/[0.015]')} style={{ animationDelay: `${Math.min(i, 20) * 20}ms` }}>
                          <td className="px-4 py-3">
                            <button onClick={() => setPreview(r)} className="text-left font-medium text-fg hover:underline">
                              {r.name}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-muted">{categoriaLabel(r.category)}</td>
                          <td className="max-w-[220px] px-4 py-3">
                            <p className="truncate text-fg-soft" title={r.address}>{r.address}</p>
                            <p className="text-xs text-faint">{r.city}</p>
                          </td>
                          {hasRatings && <td className="px-4 py-3"><Rating value={r.rating} /></td>}
                          {hasRatings && <td className="px-4 py-3 font-mono text-xs text-muted">{formatNumber(r.reviewsCount)}</td>}
                          <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                            {r.phone ? (
                              <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`} className="text-fg hover:underline">{r.phone}</a>
                            ) : r.googleMapsUrl ? (
                              <a href={r.googleMapsUrl} target="_blank" rel="noreferrer" className="font-sans text-faint hover:text-fg hover:underline">ver no Google ↗</a>
                            ) : (
                              <span className="text-faint">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3"><WebsiteBadge website={r.website} /></td>
                          <td className="px-4 py-3">{saved ? <LeadStatusBadge status={saved.status} /> : <span className="text-xs whitespace-nowrap text-faint">Não salvo</span>}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" title="Ver" icon={<Eye className="size-3.5" />} onClick={() => setPreview(r)}>
                                <span className="hidden 2xl:inline">Ver</span>
                              </Button>
                              <Button
                                size="sm"
                                variant={saved ? 'ghost' : 'secondary'}
                                title={saved ? 'Já salvo' : 'Salvar'}
                                loading={busy}
                                icon={saved ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
                                onClick={() => run(r.placeId, () => workflow.save(r))}
                              >
                                <span className="hidden 2xl:inline">{saved ? 'Salvo' : 'Salvar'}</span>
                              </Button>
                              <Button size="sm" variant="secondary" title="Contatar" icon={<MessageCircle className="size-3.5" />} onClick={() => workflow.contact(r)}>
                                <span className="hidden 2xl:inline">Contatar</span>
                              </Button>
                              <Button size="sm" variant="outline" title="Converter em cliente" icon={<UserPlus className="size-3.5" />} onClick={() => workflow.convert(r)}>
                                <span className="hidden xl:inline">{saved?.clientId ? 'Cliente' : 'Converter'}</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </>
        )}
      </Card>
      )}

      <p className="mt-3 text-xs text-faint">{leads.length} leads salvos no CRM.</p>

      <LeadDrawer place={preview} onClose={() => setPreview(null)} />
      {workflow.modals}
    </>
  )
}
