import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/components/space/Money'
import { MonthPicker } from '@/components/space/MonthPicker'
import { EntryRow } from '@/components/space/EntryRow'
import { useSpacePage } from '@/layouts/SpaceLayout'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import { currentYM, isEntryOverdue, localISO, ymOf } from '@/services/spaceMath'
import { PAYMENT_METHOD_LABEL } from '@/data/constants'
import { formatDate, normalize } from '@/utils/format'
import { exportCsv } from '@/utils/csv'
import { cn } from '@/utils/cn'
import type { Entry } from '@/types'

type TypeFilter = 'todos' | 'receita' | 'despesa' | 'transferencia'
type StatusFilter = 'todos' | 'pago' | 'pendente' | 'atrasado'

function dayLabel(date: string) {
  const d = new Date(`${date}T12:00:00`)
  const label = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function SpaceEntries() {
  const { space, words, openEntry, readOnly } = useSpacePage()
  const { entries, wallets, setEntryPaid } = useSpaces()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const today = localISO()

  const ym = params.get('mes') ?? currentYM()
  const type = (params.get('tipo') as TypeFilter) || 'todos'
  const status = (params.get('status') as StatusFilter) || 'todos'
  const walletId = params.get('carteira') ?? ''
  const category = params.get('categoria') ?? ''
  const setParam = (key: string, value: string, empty = '') => {
    const next = new URLSearchParams(params)
    if (value === empty) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const mine = useMemo(() => entries.filter((e) => e.spaceId === space.id), [entries, space.id])
  const myWallets = wallets.filter((w) => w.spaceId === space.id)
  const monthRows = mine.filter((e) => ymOf(e.date) === ym)
  const categories = [...new Set(monthRows.map((e) => e.category).filter(Boolean))].sort()

  const filtered = monthRows.filter(
    (e) =>
      (type === 'todos' || (type === 'transferencia' ? e.isTransfer : !e.isTransfer && e.type === type)) &&
      (status === 'todos' || (status === 'atrasado' ? isEntryOverdue(e, today) : e.status === status)) &&
      (!walletId || e.walletId === walletId) &&
      (!category || e.category === category) &&
      (!query || normalize(`${e.description} ${e.category} ${e.counterparty} ${e.notes}`).includes(normalize(query))),
  )
  const totalIn = filtered.filter((e) => e.type === 'receita' && !e.isTransfer).reduce((a, e) => a + e.amount, 0)
  const totalOut = filtered.filter((e) => e.type === 'despesa' && !e.isTransfer).reduce((a, e) => a + e.amount, 0)

  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>()
    for (const e of filtered) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const togglePaid = async (e: Entry) => {
    setBusyId(e.id)
    try {
      await setEntryPaid(e.id, e.status === 'pendente')
    } catch (err) {
      toast.error('Não deu para salvar', err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId(null)
    }
  }

  const exportRows = () => {
    exportCsv(`${normalize(space.name).replace(/\s+/g, '-')}-${ym}.csv`, filtered, [
      { header: 'Data', value: (e) => formatDate(e.date) },
      { header: 'Tipo', value: (e) => (e.isTransfer ? 'transferência' : e.type === 'receita' ? words.in : words.out) },
      { header: 'Descrição', value: (e) => e.description },
      { header: 'Categoria', value: (e) => e.category },
      { header: words.counterparty, value: (e) => e.counterparty },
      { header: 'Carteira', value: (e) => myWallets.find((w) => w.id === e.walletId)?.name ?? '' },
      { header: 'Forma', value: (e) => PAYMENT_METHOD_LABEL[e.method] },
      { header: 'Situação', value: (e) => (isEntryOverdue(e, today) ? 'atrasado' : e.status === 'pago' ? 'pago' : 'em aberto') },
      { header: 'Parcela', value: (e) => e.installment ?? '' },
      { header: 'Valor', value: (e) => ((e.type === 'receita' ? 1 : -1) * e.amount).toFixed(2).replace('.', ',') },
      { header: 'Observação', value: (e) => e.notes },
    ])
    toast.success('Planilha baixada', `${filtered.length} lançamentos — abre no Excel`)
  }

  const typeChips: { id: TypeFilter; label: string }[] = [
    { id: 'todos', label: 'Tudo' },
    { id: 'receita', label: words.ins },
    { id: 'despesa', label: words.outs },
    { id: 'transferencia', label: 'Transferências' },
  ]
  const statusChips: { id: StatusFilter; label: string }[] = [
    { id: 'todos', label: 'Qualquer situação' },
    { id: 'pago', label: 'Pagos' },
    { id: 'pendente', label: 'Em aberto' },
    { id: 'atrasado', label: 'Atrasados' },
  ]

  return (
    <>
      <PageHeader
        eyebrow={space.name}
        title="Movimentações"
        description={`Tudo o que entrou e saiu em ${space.name}, dia a dia. Toque num lançamento para editar.`}
        actions={
          <>
            <MonthPicker value={ym} onChange={(v) => setParam('mes', v, currentYM())} />
            <Button variant="outline" icon={<Download className="size-4" />} onClick={exportRows} disabled={!filtered.length}>
              Planilha
            </Button>
            <div className={readOnly ? 'hidden' : 'hidden sm:block'}>
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => openEntry()}>
                Lançar
              </Button>
            </div>
          </>
        }
      />

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {typeChips.map((c) => (
          <button key={c.id} onClick={() => setParam('tipo', c.id, 'todos')} className={cn('chip', type === c.id && 'chip-on')}>
            {c.label}
          </button>
        ))}
        <span className="mx-1 w-px shrink-0 bg-line" />
        {statusChips.map((c) => (
          <button key={c.id} onClick={() => setParam('status', c.id, 'todos')} className={cn('chip', status === c.id && 'chip-on')}>
            {c.label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-2 border-b border-line p-3 sm:grid-cols-3">
          <Input icon={<Search />} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Descrição, categoria, fornecedor…" />
          <Select value={category} onChange={(e) => setParam('categoria', e.target.value)}>
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select value={walletId} onChange={(e) => setParam('carteira', e.target.value)}>
            <option value="">Todas as carteiras</option>
            {myWallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line px-4 py-3 text-xs text-muted sm:px-5">
          <span>
            <span className="font-mono text-fg">{filtered.length}</span> lançamentos
          </span>
          <span>
            {words.ins}: <Money value={totalIn} className="text-fg" />
          </span>
          <span>
            {words.outs}: <Money value={totalOut} className="text-fg-soft" />
          </span>
          <span>
            Saldo: <Money value={totalIn - totalOut} className="text-fg" />
          </span>
        </div>

        {groups.length ? (
          groups.map(([date, rows]) => {
            const dayTotal = rows.filter((e) => !e.isTransfer).reduce((a, e) => a + (e.type === 'receita' ? e.amount : -e.amount), 0)
            return (
              <section key={date}>
                <div className="flex items-center justify-between bg-white/[0.02] px-4 py-2 text-[11px] text-muted sm:px-5">
                  <span className={cn(date === today && 'text-fg')}>{date === today ? 'Hoje' : dayLabel(date)}</span>
                  <Money value={dayTotal} className="text-[11px]" />
                </div>
                <ul className="divide-y divide-line">
                  {rows.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      wallets={wallets}
                      onEdit={() => openEntry(e)}
                      onTogglePaid={e.status === 'pendente' && !readOnly ? () => togglePaid(e) : undefined}
                      busy={busyId === e.id}
                      showDate={e.status === 'pendente'}
                    />
                  ))}
                </ul>
              </section>
            )
          })
        ) : (
          <EmptyState
            title={monthRows.length ? 'Nada com esses filtros' : 'Nenhum lançamento neste mês'}
            description={monthRows.length ? 'Tire algum filtro para ver mais.' : 'Lance o que entrou e saiu — leva 5 segundos.'}
            action={
              !monthRows.length && (
                <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => openEntry()}>
                  Lançar
                </Button>
              )
            }
          />
        )}
      </Card>
    </>
  )
}
