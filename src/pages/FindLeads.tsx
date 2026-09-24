import { useMemo, useState, type FormEvent } from 'react'
import { Bookmark, BookmarkCheck, Download, Eye, Loader2, MapPin, MessageCircle, Radar, Search, UserPlus, Tag, Ruler, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, DemoBadge } from '@/components/ui/Badge'
import { FormField, Input, Select, Toggle } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { LeadDrawer } from '@/components/leads/LeadDrawer'
import { LeadStatusBadge, Rating, WebsiteBadge } from '@/components/leads/LeadBadges'
import { useData } from '@/context/DataContext'
import { useLeadWorkflow } from '@/hooks/useLeadWorkflow'
import { searchPlaces, hasNoWebsite, isGooglePlacesConfigured, type PlacesSearchResponse } from '@/services/googlePlaces'
import type { PlaceResult } from '@/types'
import { exportCsv } from '@/utils/csv'
import { formatNumber, formatRelative } from '@/utils/format'
import { cn } from '@/utils/cn'

const LAST_SEARCH_KEY = 'zenn-os:last-search'

function readLastSearch(): PlacesSearchResponse | null {
  try {
    const raw = sessionStorage.getItem(LAST_SEARCH_KEY)
    return raw ? (JSON.parse(raw) as PlacesSearchResponse) : null
  } catch {
    return null
  }
}

export default function FindLeads() {
  const { findLeadByPlace, leads } = useData()
  const toast = useToast()
  const workflow = useLeadWorkflow()
  const last = readLastSearch()

  const [niche, setNiche] = useState(last?.query.niche ?? '')
  const [city, setCity] = useState(last?.query.city ?? '')
  const [radius, setRadius] = useState(String(last?.query.radiusKm ?? 10))
  const [response, setResponse] = useState<PlacesSearchResponse | null>(last)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [onlyNoSite, setOnlyNoSite] = useState(false)
  const [withPhone, setWithPhone] = useState(false)
  const [minRating, setMinRating] = useState('0')
  const [minReviews, setMinReviews] = useState('')
  const [preview, setPreview] = useState<PlaceResult | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!niche.trim() || !city.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await searchPlaces({ niche: niche.trim(), city: city.trim(), radiusKm: Number(radius) || 10 })
      setResponse(res)
      sessionStorage.setItem(LAST_SEARCH_KEY, JSON.stringify(res))
      toast.success(`${res.results.length} empresas encontradas`, res.mode === 'demo' ? 'DEMO MODE — dados fictícios' : 'Google Places API')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na busca')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!response) return []
    const rating = Number(minRating) || 0
    const reviews = Number(minReviews) || 0
    return response.results.filter(
      (r) =>
        (!onlyNoSite || hasNoWebsite(r.website)) &&
        (!withPhone || !!r.phone) &&
        (r.rating ?? 0) >= rating &&
        r.reviewsCount >= reviews,
    )
  }, [response, onlyNoSite, withPhone, minRating, minReviews])

  const noSiteCount = response?.results.filter((r) => hasNoWebsite(r.website)).length ?? 0

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
    exportCsv(`zenn-leads-${q.niche}-${q.city}${response!.mode === 'demo' ? '-DEMO' : ''}.csv`.replace(/\s+/g, '-').toLowerCase(), filtered, [
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
      { header: 'Fonte', value: (r) => (r.source === 'demo' ? 'DEMO (fictício)' : 'Google Places') },
    ])
    toast.success('CSV exportado', `${filtered.length} leads`)
  }

  return (
    <>
      <PageHeader
        eyebrow={<>Prospecção {!isGooglePlacesConfigured() && <DemoBadge label="Demo mode" />}</>}
        title="Encontrar leads"
        description="Busque empresas por nicho e cidade. Quem não tem site aparece destacado — são as melhores oportunidades."
      />

      {!isGooglePlacesConfigured() && (
        <div className="mb-4 flex animate-fade-in items-start gap-3 rounded-2xl border border-dashed border-white/25 bg-white/[0.02] px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-fg-soft" />
          <p className="text-muted">
            <span className="font-medium text-fg">DEMO MODE.</span> GOOGLE_MAPS_API_KEY não configurada — os resultados abaixo são
            <span className="text-fg"> fictícios</span>, gerados para teste. Configure a chave no <code className="font-mono text-xs">.env.local</code> para buscar dados reais do Google Places.
          </p>
        </div>
      )}

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

        <div className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-2 xl:grid-cols-4">
          <Toggle checked={onlyNoSite} onChange={setOnlyNoSite} label="Somente sem site" description={response ? `${noSiteCount} de ${response.results.length}` : 'website vazio'} />
          <Toggle checked={withPhone} onChange={setWithPhone} label="Com telefone" description="Descarta sem número" />
          <FormField label="Nota mínima">
            <Select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
              <option value="0">Qualquer nota</option>
              <option value="3.5">3,5 ou mais</option>
              <option value="4">4,0 ou mais</option>
              <option value="4.5">4,5 ou mais</option>
            </Select>
          </FormField>
          <FormField label="Mínimo de avaliações">
            <Input type="number" min={0} value={minReviews} onChange={(e) => setMinReviews(e.target.value)} placeholder="0" />
          </FormField>
        </div>
      </Card>

      {error && (
        <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <Card className="mt-4 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted">
            <Loader2 className="size-6 animate-spin" />
            <p className="eyebrow">Buscando {niche} em {city}</p>
          </div>
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
            <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono text-fg">{filtered.length}</span>
                <span className="text-muted">
                  de {response.results.length} resultados · {response.query.niche} em {response.query.city} · {response.query.radiusKm} km
                </span>
                {response.mode === 'demo' ? <DemoBadge label="Demo mode" /> : <Badge tone="outline">Google Places · ao vivo</Badge>}
                <span className="text-xs text-faint">{formatRelative(response.fetchedAt)}</span>
              </div>
              <Button variant="outline" size="sm" icon={<Download className="size-3.5" />} onClick={exportFiltered} disabled={!filtered.length}>
                Exportar CSV
              </Button>
            </div>

            {filtered.length === 0 ? (
              <EmptyState mascot={false} title="Nenhum resultado com esses filtros" description="Afrouxe a nota mínima ou o mínimo de avaliações." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      {['Empresa', 'Categoria', 'Local', 'Nota', 'Avaliações', 'Telefone', 'Website', 'Status', 'Ações'].map((h) => (
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
                          <td className="px-4 py-3 text-muted">{r.category}</td>
                          <td className="max-w-[220px] px-4 py-3">
                            <p className="truncate text-fg-soft" title={r.address}>{r.address}</p>
                            <p className="text-xs text-faint">{r.city}</p>
                          </td>
                          <td className="px-4 py-3"><Rating value={r.rating} /></td>
                          <td className="px-4 py-3 font-mono text-xs text-muted">{formatNumber(r.reviewsCount)}</td>
                          <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{r.phone ?? <span className="text-faint">—</span>}</td>
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
            )}
          </>
        )}
      </Card>

      <p className="mt-3 text-xs text-faint">{leads.length} leads salvos no CRM.</p>

      <LeadDrawer place={preview} onClose={() => setPreview(null)} />
      {workflow.modals}
    </>
  )
}
