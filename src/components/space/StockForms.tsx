// Estoque: cadastro de item e movimento (compra, uso, perda, contagem).
import { useEffect, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Toggle } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { MoneyInput } from '@/components/space/EntryFormModal'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import { localISO, parseMoney } from '@/services/spaceMath'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Space, StockItem, StockKind } from '@/types'

export const STOCK_KINDS: { id: StockKind; label: string; plural: string; unit: string; category: string }[] = [
  { id: 'chapa', label: 'Chapa', plural: 'Chapas', unit: 'un', category: 'Chapas e madeira' },
  { id: 'fita', label: 'Fita de borda', plural: 'Fitas de borda', unit: 'm', category: 'Fita de borda e cola' },
  { id: 'ferragem', label: 'Ferragem', plural: 'Ferragens', unit: 'un', category: 'Ferragens e acessórios' },
  { id: 'outro', label: 'Outro', plural: 'Outros materiais', unit: 'un', category: 'Outras despesas' },
]
const UNITS = ['un', 'm', 'cx', 'pç', 'par', 'kg', 'l', 'rolo']
const toInput = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','))

export function StockItemModal({ open, onClose, space, item }: { open: boolean; onClose: () => void; space: Space; item?: StockItem | null }) {
  const { createStockItem, updateStockItem, deleteStockItem } = useSpaces()
  const toast = useToast()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<StockKind>('chapa')
  const [unit, setUnit] = useState('un')
  const [qty, setQty] = useState('')
  const [min, setMin] = useState('')
  const [cost, setCost] = useState('')
  const [supplier, setSupplier] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(item?.name ?? '')
    setKind(item?.kind ?? 'chapa')
    setUnit(item?.unit ?? 'un')
    setQty(toInput(item ? Number(item.qty) : undefined))
    setMin(toInput(item ? Number(item.minQty) : undefined))
    setCost(item && Number(item.unitCost) ? toInput(Number(item.unitCost)) : '')
    setSupplier(item?.supplier ?? '')
    setSupplierPhone(item?.supplierPhone ?? '')
    setConfirm(false)
  }, [open, item])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const q = qty.trim() ? parseMoney(qty) : 0
    const m = min.trim() ? parseMoney(min) : 0
    const c = cost.trim() ? parseMoney(cost) : 0
    if (!name.trim() || [q, m, c].some(Number.isNaN)) {
      toast.error('Confira os campos', 'O nome é obrigatório e as quantidades precisam ser números.')
      return
    }
    setBusy(true)
    try {
      const data = { name: name.trim(), kind, unit, minQty: Math.max(0, m), unitCost: Math.max(0, c), supplier: supplier.trim(), supplierPhone: supplierPhone.trim() || null }
      if (item) await updateStockItem(item.id, data)
      else await createStockItem({ ...data, spaceId: space.id, qty: q, notes: '' })
      toast.success(item ? 'Item atualizado' : 'Item no estoque', data.name)
      onClose()
    } catch (err) {
      toast.error('Não deu para salvar', err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow="Estoque" title={item ? 'Editar item' : 'Novo item no estoque'}>
      {confirm && item ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Apagar <span className="text-fg">{item.name}</span> e todo o histórico de entradas e saídas dele?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Voltar
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await deleteStockItem(item.id)
                toast.success('Item apagado', item.name)
                onClose()
              }}
            >
              Apagar item
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Tipo" className="sm:col-span-2">
            <div className="flex flex-wrap gap-1.5">
              {STOCK_KINDS.map((k) => (
                <button
                  type="button"
                  key={k.id}
                  onClick={() => {
                    setKind(k.id)
                    if (!item) setUnit(k.unit)
                  }}
                  className={cn('chip', kind === k.id && 'chip-on')}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </FormField>
          <FormField label="Nome" className="sm:col-span-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === 'chapa' ? 'Ex.: MDF 15mm branco' : kind === 'fita' ? 'Ex.: Fita branca 22mm' : kind === 'ferragem' ? 'Ex.: Dobradiça 35mm' : 'Ex.: Cola de contato'}
              required
              autoFocus={!item}
            />
          </FormField>
          {!item && (
            <FormField label="Quantas tem agora">
              <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" className="font-mono" />
            </FormField>
          )}
          <FormField label="Unidade">
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {[...new Set([unit, ...UNITS])].map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Avisar quando tiver" hint="estoque mínimo">
            <Input inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="Ex.: 5" className="font-mono" />
          </FormField>
          <FormField label="Preço de cada" hint="opcional">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-faint">R$</span>
              <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0,00" className="pl-10 font-mono" />
            </div>
          </FormField>
          <FormField label="Fornecedor" hint="opcional">
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ex.: Madeireira São José" />
          </FormField>
          <FormField label="WhatsApp do fornecedor" hint="para pedir">
            <Input value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} placeholder="(11) 99999-0000" inputMode="tel" />
          </FormField>
          <div className="flex items-center gap-2 border-t border-line pt-4 sm:col-span-2">
            {item && (
              <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)}>
                Apagar
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" loading={busy}>
                Salvar
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  )
}

type MoveType = 'compra' | 'uso' | 'perda' | 'contagem'

/** Entrada, saída ou contagem de um item. Compra pode virar despesa na hora. */
export function StockMoveModal({
  open,
  onClose,
  space,
  item,
  initialType = 'compra',
}: {
  open: boolean
  onClose: () => void
  space: Space
  item: StockItem | null
  initialType?: MoveType
}) {
  const { jobs, wallets, moveStock, createEntry } = useSpaces()
  const toast = useToast()
  const [type, setType] = useState<MoveType>(initialType)
  const [qty, setQty] = useState('')
  const [jobId, setJobId] = useState('')
  const [asExpense, setAsExpense] = useState(true)
  const [total, setTotal] = useState('')
  const [walletId, setWalletId] = useState('')
  const [busy, setBusy] = useState(false)
  const openJobs = jobs.filter((j) => j.spaceId === space.id && j.status !== 'entregue' && j.status !== 'cancelado')
  const spaceWallets = wallets.filter((w) => w.spaceId === space.id && !w.archived)

  useEffect(() => {
    if (!open) return
    setType(initialType)
    setQty('')
    setJobId('')
    setAsExpense(true)
    setTotal('')
    setWalletId(spaceWallets[0]?.id ?? '')
  }, [open, initialType]) // só ao abrir

  if (!item) return null
  const n = parseMoney(qty)
  const current = Number(item.qty)
  const delta = type === 'contagem' ? Math.round((n - current) * 100) / 100 : type === 'compra' ? n : -n
  const suggestedTotal = n > 0 && Number(item.unitCost) > 0 ? Math.round(n * Number(item.unitCost) * 100) / 100 : 0
  const kindInfo = STOCK_KINDS.find((k) => k.id === item.kind) ?? STOCK_KINDS[3]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (Number.isNaN(n) || (type !== 'contagem' && !(n > 0)) || (type === 'contagem' && n < 0)) {
      toast.error('Quantidade inválida')
      return
    }
    if (delta === 0) {
      toast.info('Nada mudou', 'A contagem bate com o que já estava.')
      onClose()
      return
    }
    setBusy(true)
    try {
      await moveStock({
        itemId: item.id,
        delta,
        reason: type === 'contagem' ? 'ajuste' : type,
        jobId: type === 'uso' ? jobId || null : null,
        note: type === 'contagem' ? `Contagem: ${n} ${item.unit}` : '',
      })
      const value = total.trim() ? parseMoney(total) : suggestedTotal
      if (type === 'compra' && asExpense && value > 0) {
        await createEntry({
          spaceId: space.id,
          type: 'despesa',
          amount: value,
          description: `Compra: ${n} ${item.unit} ${item.name}`,
          category: kindInfo.category,
          date: localISO(),
          status: 'pago',
          walletId: walletId || null,
          method: 'pix',
          counterparty: item.supplier,
          notes: '',
        })
      }
      toast.success(delta > 0 ? 'Entrou no estoque' : 'Saiu do estoque', `${item.name}: agora ${Math.round((current + delta) * 100) / 100} ${item.unit}`)
      onClose()
    } catch (err) {
      toast.error('Não deu para salvar', err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow={`Estoque · tem ${current} ${item.unit}`} title={item.name} size="sm">
      <form onSubmit={submit} className="grid grid-cols-1 gap-4">
        <Segmented<MoveType>
          value={type}
          onChange={setType}
          options={[
            { value: 'compra', label: 'Comprei' },
            { value: 'uso', label: 'Usei' },
            { value: 'perda', label: 'Perdi' },
            { value: 'contagem', label: 'Contei' },
          ]}
        />
        <FormField label={type === 'contagem' ? `Quantas tem de verdade (${item.unit})` : `Quantidade (${item.unit})`}>
          <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" className="py-3 font-mono text-xl" autoFocus />
        </FormField>
        {type === 'contagem' && qty.trim() && !Number.isNaN(n) && (
          <p className="-mt-2 text-xs text-muted">
            {delta === 0 ? 'Bate com o sistema.' : `Vai ${delta > 0 ? 'somar' : 'tirar'} ${Math.abs(delta)} ${item.unit} para ficar igual à contagem.`}
          </p>
        )}
        {type === 'uso' && openJobs.length > 0 && (
          <FormField label="Para qual serviço" hint="opcional">
            <Select value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">Nenhum</option>
              {openJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                  {j.client ? ` · ${j.client}` : ''}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        {type === 'compra' && (
          <>
            <Toggle checked={asExpense} onChange={setAsExpense} label="Lançar a compra como despesa" description="Entra em Movimentações e no lucro do mês" />
            {asExpense && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Valor total pago" hint={suggestedTotal ? `sugestão ${formatCurrency(suggestedTotal)}` : undefined}>
                  <MoneyInput value={total} onChange={setTotal} required={false} />
                </FormField>
                {spaceWallets.length > 0 && (
                  <FormField label="Saiu da carteira">
                    <Select value={walletId} onChange={(e) => setWalletId(e.target.value)}>
                      <option value="">Nenhuma</option>
                      {spaceWallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                )}
              </div>
            )}
          </>
        )}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
