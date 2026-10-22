import { useMemo, useState } from 'react'
import { AlertTriangle, Minus, Package, Pencil, Plus, ShoppingCart, Undo2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Stat } from '@/components/ui/Stat'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/components/space/Money'
import { STOCK_KINDS, StockItemModal, StockMoveModal } from '@/components/space/StockForms'
import { useSpacePage } from '@/layouts/SpaceLayout'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import { isLowStock, stockTotals } from '@/services/spaceMath'
import { formatDateShort, whatsappLink } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { StockItem } from '@/types'

const REASON_LABEL = { compra: 'Compra', uso: 'Uso', ajuste: 'Contagem / ajuste', perda: 'Perda' } as const
const fmt = (n: number) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })

/** Mensagem pronta para pedir ao fornecedor o que está acabando. */
function orderMessage(items: StockItem[]) {
  const lines = items.map((i) => `• ${i.name}: ${fmt(Math.max(Number(i.minQty) * 2 - Number(i.qty), 1))} ${i.unit}`)
  return `Olá! Tudo bem? Gostaria de fazer um pedido:\n${lines.join('\n')}\nPode me passar o valor e o prazo de entrega?`
}

export default function SpaceStock() {
  const { space, readOnly } = useSpacePage()
  const { stockItems, stockMoves, jobs, moveStock, undoStockMove } = useSpaces()
  const toast = useToast()
  const [itemModal, setItemModal] = useState<{ item: StockItem | null } | null>(null)
  const [moveModal, setMoveModal] = useState<{ item: StockItem; type: 'compra' | 'uso' | 'perda' | 'contagem' } | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const items = useMemo(() => stockItems.filter((i) => i.spaceId === space.id), [stockItems, space.id])
  const moves = stockMoves.filter((m) => m.spaceId === space.id)
  const t = stockTotals(items)
  const sheets = items.filter((i) => i.kind === 'chapa')
  // Agrupa o que está acabando por fornecedor (um pedido por WhatsApp para cada).
  const bySupplier = new Map<string, StockItem[]>()
  for (const i of t.low) {
    const key = i.supplierPhone || ''
    bySupplier.set(key, [...(bySupplier.get(key) ?? []), i])
  }

  const quick = async (item: StockItem, delta: number) => {
    setBusyId(item.id)
    try {
      await moveStock({ itemId: item.id, delta, reason: delta > 0 ? 'compra' : 'uso' })
    } catch (e) {
      toast.error('Não deu para salvar', e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={space.name}
        title="Estoque"
        description="Chapas, fitas, ferragens e o que mais tiver na oficina. Use + e − no dia a dia; o sistema avisa quando algo está acabando."
        actions={
          !readOnly && (
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setItemModal({ item: null })}>
              Novo item
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat emphasis label="Chapas em estoque" value={fmt(t.sheets)} hint={`${sheets.length} ${sheets.length === 1 ? 'tipo' : 'tipos'} de chapa`} />
        <Stat
          label="Acabando"
          value={t.low.length}
          hint={t.low.length ? 'veja abaixo e peça' : 'nada em falta'}
          className={t.low.length ? 'border-danger/30' : ''}
        />
        <Stat label="Valor parado no estoque" value={<Money value={t.value} />} hint="pelo preço de cada item" />
        <Stat label="Itens cadastrados" value={items.length} hint={`${moves.length} movimentos`} />
      </div>

      {t.low.length > 0 && (
        <Card className="mt-4 border-danger/25 p-4 sm:p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-danger">
            <AlertTriangle className="size-4" /> Está acabando
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {t.low.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <button
                  onClick={() => !readOnly && setMoveModal({ item: i, type: 'compra' })}
                  className="truncate text-left underline-offset-2 hover:underline"
                  disabled={readOnly}
                >
                  {i.name}
                </button>
                <span className="shrink-0 font-mono text-muted">
                  {fmt(Number(i.qty))} {i.unit} <span className="text-faint">(mín. {fmt(Number(i.minQty))})</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...bySupplier.entries()].map(([phone, list]) => {
              const link = whatsappLink(phone, orderMessage(list))
              const who = list[0].supplier || 'fornecedor'
              return link ? (
                <a
                  key={phone}
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-xs font-medium text-fg transition hover:bg-white/[0.04]"
                >
                  <ShoppingCart className="size-3.5" /> Pedir para {who}
                </a>
              ) : (
                <span key="sem" className="text-xs text-faint">
                  Cadastre o WhatsApp do fornecedor no item para pedir com um toque.
                </span>
              )
            })}
          </div>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            title="Estoque vazio"
            description="Cadastre as chapas (MDF 15mm branco, 6mm, etc.), fitas e ferragens com a quantidade que tem hoje. Depois é só usar + e −."
            action={
              !readOnly && (
                <Button variant="primary" icon={<Package className="size-4" />} onClick={() => setItemModal({ item: null })}>
                  Cadastrar o primeiro
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="mt-4 space-y-4">
          {STOCK_KINDS.map((k) => {
            const rows = items.filter((i) => i.kind === k.id)
            if (!rows.length) return null
            const sum = rows.reduce((a, i) => a + Number(i.qty), 0)
            return (
              <Card key={k.id} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
                  <p className="text-sm font-medium">{k.plural}</p>
                  {k.id === 'chapa' && <span className="font-mono text-xs text-muted">{fmt(sum)} chapas no total</span>}
                </div>
                <ul className="divide-y divide-line">
                  {rows.map((i) => {
                    const low = isLowStock(i)
                    return (
                      <li key={i.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                        <button onClick={() => !readOnly && setMoveModal({ item: i, type: 'compra' })} className="min-w-0 flex-1 text-left" disabled={readOnly}>
                          <p className="truncate text-sm text-fg">{i.name}</p>
                          <p className="truncate text-xs text-muted">
                            {[Number(i.minQty) > 0 && `mínimo ${fmt(Number(i.minQty))}`, Number(i.unitCost) > 0 && `R$ ${fmt(Number(i.unitCost))} cada`, i.supplier]
                              .filter(Boolean)
                              .join(' · ') || 'toque para comprar, usar ou contar'}
                          </p>
                        </button>
                        <span className={cn('shrink-0 text-right font-mono text-lg', low ? 'text-danger' : 'text-fg')}>
                          {fmt(Number(i.qty))}
                          <span className="ml-1 text-xs text-muted">{i.unit}</span>
                        </span>
                        {!readOnly && (
                          <span className="flex shrink-0 items-center gap-1">
                            <Button size="icon" variant="secondary" loading={busyId === i.id} onClick={() => void quick(i, -1)} aria-label={`Usar 1 ${i.name}`}>
                              <Minus className="size-4" />
                            </Button>
                            <Button size="icon" variant="secondary" onClick={() => void quick(i, 1)} aria-label={`Entrar 1 ${i.name}`} disabled={busyId === i.id}>
                              <Plus className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setItemModal({ item: i })} aria-label={`Editar ${i.name}`}>
                              <Pencil className="size-3.5" />
                            </Button>
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </Card>
            )
          })}
        </div>
      )}

      {moves.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowHistory((v) => !v)} className="text-xs text-muted hover:text-fg">
            {showHistory ? 'Esconder' : 'Ver'} histórico de entradas e saídas ({moves.length})
          </button>
          {showHistory && (
            <Card className="mt-3 overflow-hidden">
              <ul className="divide-y divide-line">
                {moves.slice(0, 60).map((m) => {
                  const item = items.find((i) => i.id === m.itemId)
                  const job = m.jobId ? jobs.find((j) => j.id === m.jobId) : undefined
                  const d = Number(m.delta)
                  return (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm sm:px-5">
                      <span className={cn('w-14 shrink-0 font-mono', d > 0 ? 'text-fg' : 'text-muted')}>
                        {d > 0 ? '+' : '−'}
                        {fmt(Math.abs(d))}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {item?.name}
                        <span className="text-xs text-muted">
                          {' · '}
                          {REASON_LABEL[m.reason]}
                          {job ? ` · ${job.title}` : ''}
                          {m.note ? ` · ${m.note}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-faint">{formatDateShort(m.date)}</span>
                      {!readOnly && (
                        <button onClick={() => void undoStockMove(m.id)} className="rounded p-1 text-faint hover:text-fg" title="Desfazer" aria-label="Desfazer">
                          <Undo2 className="size-3.5" />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
        </div>
      )}

      <StockItemModal open={!!itemModal} onClose={() => setItemModal(null)} space={space} item={itemModal?.item} />
      <StockMoveModal open={!!moveModal} onClose={() => setMoveModal(null)} space={space} item={moveModal?.item ?? null} initialType={moveModal?.type} />
    </>
  )
}
