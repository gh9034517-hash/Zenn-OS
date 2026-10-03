import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Bookmark, BookmarkCheck, Download, Eye, MapPin, MessageCircle, Radar, Search, UserPlus, Tag, Ruler, AlertTriangle, RotateCcw, X, Globe2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { LeadDrawer } from '@/components/leads/LeadDrawer'
import { ResultCard, ResultsSkeleton } from '@/components/leads/ResultCard'
import { categoriaLabel } from '@/services/outreach'
import { LeadStatusBadge, Rating, WebsiteBadge } from '@/components/leads/LeadBadges'
import { useData } from '@/context/DataContext'
import { useLeadWorkflow } from '@/hooks/useLeadWorkflow'
import { searchPlaces, hasNoWebsite, type PlacesSearchResponse } from '@/services/googlePlaces'
import { searchRegionOSM, nomeDaRegiao, naRegiao, UFS, type Region, type RegionProgress } from '@/services/osmSearch'
import type { PlaceResult } from '@/types'
import { exportCsv } from '@/utils/csv'
import { formatNumber, formatRelative } from '@/utils/format'
import { cn } from '@/utils/cn'

// v2: a chave antiga pode guardar resultados DEMO (fictícios) de versões
// anteriores — trocar o nome descarta esse cache no celular do usuário.
const LAST_SEARCH_KEY = 'zenn-os:last-search:v2'
const LAST_CITY_KEY = 'zenn-os:last-city'
const LAST_WHERE_KEY = 'zenn-os:last-where'
const LAST_TARGET_KEY = 'zenn-os:last-target'

/** Quantidades oferecidas — 500 leva mais tempo (percorre mais cidades). */
const QUANTIDADES = [25, 50, 100, 200, 500]

/** 'BR', uma UF ou 'CITY' (cidade digitada). */
type Where = 'BR' | 'CITY' | string

function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function savePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

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
  // Padrão: Brasil todo — ninguém precisa digitar cidade para começar.
  const [where, setWhere] = useState<Where>(() => readPref(LAST_WHERE_KEY, 'BR'))
  const [target, setTarget] = useState<number>(() => Number(readPref(LAST_TARGET_KEY, '50')) || 50)
  const [city, setCity] = useState(last?.scope === 'city' ? last.query.city : readLastCity())
  const [radius, setRadius] = useState(String(last?.scope === 'city' ? last.query.radiusKm : 10))
  const [response, setResponse] = useState<PlacesSearchResponse | null>(last)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<RegionProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Ligados por padrão: a ferramenta existe para achar quem NÃO tem site e
  // tem um telefone para chamar.
  const [onlyNoSite, setOnlyNoSite] = useState(true)
  const [withPhone, setWithPhone] = useState(true)
  const [minRating, setMinRating] = useState('0')
  const [preview, setPreview] = useState<PlaceResult | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [savingAll, setSavingAll] = useState(false)

  const isCity = where === 'CITY'
  const ondeTexto = isCity ? `em ${city.trim() || 'cidade'}` : naRegiao(where as Region)

  const buscar = async (nichoBusca: string) => {
    const nicho = nichoBusca.trim()
    if (!nicho) return
    if (isCity && !city.trim()) {
      setError('Digite a cidade (ou escolha "Brasil todo" ou um estado).')
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    setProgress(null)
    savePref(LAST_WHERE_KEY, where)
    savePref(LAST_TARGET_KEY, String(target))

    try {
      let res: PlacesSearchResponse
      if (isCity) {
        res = await searchPlaces({ niche: nicho, city: city.trim(), radiusKm: Number(radius) || 10 }, ctrl.signal)
        res = { ...res, scope: 'city', target }
        savePref(LAST_CITY_KEY, city.trim())
      } else {
        const r = await searchRegionOSM({
          niche: nicho,
          region: where as Region,
          target,
          requirePhone: withPhone,
          requireNoSite: onlyNoSite,
          signal: ctrl.signal,
          onProgress: setProgress,
        })
        const avisos: string[] = []
        if (r.stopped) avisos.push(`Busca interrompida com ${r.results.length} de ${target} leads.`)
        if (r.exhausted) {
          avisos.push(`Achamos ${r.results.length} de ${target} nas maiores cidades de ${nomeDaRegiao(where as Region)}. Para mais, desligue um filtro ou escolha outra região.`)
        }
        if (r.failed.length) avisos.push(`Não responderam agora: ${r.failed.slice(0, 4).join(', ')}${r.failed.length > 4 ? '…' : ''}.`)
        res = {
          mode: 'live',
          source: 'osm',
          results: r.results,
          query: { niche: nicho, city: nomeDaRegiao(where as Region), radiusKm: 10 },
          fetchedAt: new Date().toISOString(),
          resolvedCity: naRegiao(where as Region),
          scope: 'region',
          target,
          cities: r.cities,
          notice: avisos.join(' ') || undefined,
        }
      }

      setResponse(res)
      try {
        localStorage.setItem(LAST_SEARCH_KEY, JSON.stringify(res))
      } catch {
        /* armazenamento indisponível: a busca continua valendo */
      }
      const comTel = res.results.filter((r) => r.phone).length
      if (res.results.length) {
        toast.success(
          `${Math.min(res.results.length, target)} leads encontrados`,
          res.scope === 'region' ? `${res.cities?.length ?? 0} cidades · OpenStreetMap` : `${comTel} com telefone`,
        )
      } else {
        toast.info('Nenhuma empresa encontrada', 'Tente outro nicho, outra região ou desligue um filtro')
      }
      if (res.notice) toast.info('Aviso', res.notice)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast.info('Busca cancelada')
      } else {
        setError(err instanceof Error ? err.message : 'Falha na busca')
      }
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null
      setLoading(false)
      setProgress(null)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void buscar(niche)
  }

  /** Atalho de nicho: um toque já busca (na região escolhida). */
  const usarNicho = (n: string) => {
    setNiche(n)
    if (!isCity || city.trim()) void buscar(n)
  }

  const cancelar = () => abortRef.current?.abort()

  const filtered = useMemo(() => {
    if (!response) return []
    const rating = Number(minRating) || 0
    return response.results
      .filter(
        (r) =>
          (!onlyNoSite || hasNoWebsite(r.website)) &&
          (!withPhone || !!r.phone) &&
          (r.rating ?? 0) >= rating,
      )
      .slice(0, response.target ?? Infinity)
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
        description="Escolha o nicho, onde e quantos leads. Quem não tem site e tem telefone vem primeiro — são as melhores oportunidades."
      />

      <Card className="p-4 sm:p-5">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <FormField label="O que você procura" htmlFor="niche">
              <Input id="niche" icon={<Tag />} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ex.: Barbearias" required />
            </FormField>
            {/* Atalhos: um toque escolhe o nicho e já busca. */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {NICHOS_RAPIDOS.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={loading}
                  onClick={() => usarNicho(n)}
                  className={cn('chip', niche.toLowerCase() === n.toLowerCase() && 'chip-on')}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Onde" htmlFor="where">
              <Select id="where" value={where} onChange={(e) => setWhere(e.target.value)}>
                <option value="BR">Brasil todo</option>
                <optgroup label="Estado">
                  {Object.entries(UFS)
                    .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
                    .map(([uf, nome]) => (
                      <option key={uf} value={uf}>
                        {nome} ({uf})
                      </option>
                    ))}
                </optgroup>
                <option value="CITY">Cidade específica…</option>
              </Select>
            </FormField>

            <FormField label="Quantos leads">
              <div className="flex gap-1.5" role="radiogroup" aria-label="Quantos leads">
                {QUANTIDADES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    role="radio"
                    aria-checked={target === q}
                    onClick={() => setTarget(q)}
                    className={cn('chip flex-1 justify-center font-mono', target === q && 'chip-on')}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </FormField>
          </div>

          {isCity && (
            <div className="grid animate-fade-in gap-3 sm:grid-cols-[1fr_140px]">
              <FormField label="Cidade" htmlFor="city">
                <Input id="city" icon={<MapPin />} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex.: Campinas" />
              </FormField>
              <FormField label="Raio" htmlFor="radius">
                <div className="relative">
                  <Input id="radius" icon={<Ruler />} type="number" min={1} max={30} value={radius} onChange={(e) => setRadius(e.target.value)} className="pr-10" />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-faint">km</span>
                </div>
              </FormField>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="eyebrow mr-1">Só quem</span>
            <button type="button" className={cn('chip', onlyNoSite && 'chip-on')} onClick={() => setOnlyNoSite((v) => !v)} aria-pressed={onlyNoSite}>
              não tem site
            </button>
            <button type="button" className={cn('chip', withPhone && 'chip-on')} onClick={() => setWithPhone((v) => !v)} aria-pressed={withPhone}>
              tem telefone
            </button>
          </div>

          <Button type="submit" variant="primary" size="lg" loading={loading} icon={isCity ? <Search className="size-4" /> : <Globe2 className="size-4" />} className="w-full sm:w-auto">
            Buscar {target} leads {isCity && !city.trim() ? '' : ondeTexto}
          </Button>
        </form>
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
          <Button size="sm" variant="outline" loading={loading} icon={<RotateCcw className="size-3.5" />} onClick={() => void buscar(niche)}>
            Tentar de novo
          </Button>
        </div>
      )}

      {/* Com erro e sem resultado anterior, o painel de erro já diz tudo. */}
      {(loading || response || !error) && (
      <Card className="mt-4 overflow-hidden">
        {loading ? (
          <div>
            {/* Progresso da busca por região: cidade a cidade até a meta. */}
            <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-fg">
                  {progress?.city ? (
                    <>
                      Buscando em <span className="font-medium">{progress.city}</span>
                    </>
                  ) : (
                    <>Buscando {niche.toLowerCase()} {ondeTexto}…</>
                  )}
                </p>
                {progress && (
                  <p className="mt-0.5 text-xs text-muted">
                    <span className="font-mono text-fg">{progress.found}</span> de {progress.target} leads · cidade{' '}
                    {Math.min(progress.done + 1, progress.total)} de {progress.total}
                  </p>
                )}
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={cn('h-full rounded-full bg-white transition-[width] duration-500', !progress && 'w-1/4 animate-pulse')}
                    style={progress ? { width: `${Math.max(4, (progress.found / progress.target) * 100)}%` } : undefined}
                  />
                </div>
              </div>
              <Button size="sm" variant={progress?.partial.length ? 'secondary' : 'ghost'} icon={<X className="size-3.5" />} onClick={cancelar}>
                {progress?.partial.length ? 'Parar e usar estes' : 'Cancelar'}
              </Button>
            </div>
            {progress?.partial.length ? (
              // Os leads aparecem enquanto a busca segue: dá para começar a
              // chamar os primeiros sem esperar as outras cidades.
              <ul className="divide-y divide-line">
                {progress.partial.map((r) => (
                  <ResultCard
                    key={r.placeId}
                    r={r}
                    saved={findLeadByPlace(r.placeId)}
                    busy={busyId === r.placeId}
                    onContact={() => workflow.contact(r)}
                    onSave={() => run(r.placeId, () => workflow.save(r))}
                    onPreview={() => setPreview(r)}
                  />
                ))}
              </ul>
            ) : (
              <ResultsSkeleton label="" />
            )}
          </div>
        ) : !response ? (
          <EmptyState
            title="Pronto para prospectar"
            description="Toque num nicho acima — a busca já começa no Brasil todo. Ou escolha um estado e a quantidade."
            action={
              <Button variant="outline" icon={<Radar className="size-4" />} onClick={() => usarNicho('Barbearias')}>
                Buscar barbearias
              </Button>
            }
          />
        ) : (
          <>
            <div className="space-y-3 border-b border-line px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-fg">
                    <span className="font-mono text-lg">{filtered.length}</span>{' '}
                    <span className="text-muted">
                      {response.query.niche.toLowerCase()} {response.scope === 'region' ? '' : 'em'}
                    </span>{' '}
                    {response.resolvedCity || response.query.city}
                  </p>
                  <p className="mt-0.5 text-xs text-faint">
                    {response.source === 'google' ? 'Google Maps' : 'OpenStreetMap'} ·{' '}
                    {response.scope === 'region'
                      ? `${response.cities?.length ?? 0} ${(response.cities?.length ?? 0) === 1 ? 'cidade' : 'cidades'}`
                      : `raio de ${response.query.radiusKm} km`}{' '}
                    · {formatRelative(response.fetchedAt)}
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
