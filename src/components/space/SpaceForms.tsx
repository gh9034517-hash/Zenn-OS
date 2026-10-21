// Formulários menores dos espaços: conta fixa, carteira, meta e orçamento.
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Toggle } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { MoneyInput } from '@/components/space/EntryFormModal'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import { PAYMENT_METHODS } from '@/data/constants'
import { addMonths, categorySuggestions, currentYM, dueDateFor, parseMoney, spaceWords } from '@/services/spaceMath'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Goal, PaymentMethod, Recurring, Space, TransactionType, Wallet, WalletKind } from '@/types'

const toInput = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','))

function useSubmit(onClose: () => void) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await fn()
      toast.success(done)
      onClose()
    } catch (e) {
      toast.error('Não deu para salvar', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return { busy, run, toast }
}

function Footer({
  busy,
  onClose,
  onDelete,
  className,
}: {
  busy: boolean
  onClose: () => void
  onDelete?: () => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2 border-t border-line pt-4', className)}>
      {onDelete && (
        <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={onDelete}>
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
  )
}

// ------------------------------------------------------------
// Conta fixa
// ------------------------------------------------------------
export function RecurringFormModal({
  open,
  onClose,
  space,
  recurring,
}: {
  open: boolean
  onClose: () => void
  space: Space
  recurring?: Recurring | null
}) {
  const { wallets, entries, createRecurring, updateRecurring, deleteRecurring } = useSpaces()
  const { busy, run } = useSubmit(onClose)
  const words = spaceWords(space.kind)
  const listId = useId()
  const spaceWallets = wallets.filter((w) => w.spaceId === space.id && !w.archived)
  const [type, setType] = useState<TransactionType>('despesa')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [day, setDay] = useState(5)
  const [walletId, setWalletId] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('boleto')
  const [counterparty, setCounterparty] = useState('')
  const [active, setActive] = useState(true)
  const [includeThisMonth, setIncludeThisMonth] = useState(false)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    setIncludeThisMonth(false)
    setType(recurring?.type ?? 'despesa')
    setAmount(toInput(recurring?.amount))
    setDescription(recurring?.description ?? '')
    setCategory(recurring?.category ?? '')
    setDay(recurring?.day ?? 5)
    setWalletId(recurring?.walletId ?? spaceWallets[0]?.id ?? '')
    setMethod(recurring?.method ?? 'boleto')
    setCounterparty(recurring?.counterparty ?? '')
    setActive(recurring?.active ?? true)
    setConfirm(false)
  }, [open, recurring]) // só ao abrir

  const suggestions = useMemo(
    () => categorySuggestions(space.kind, type, entries.filter((e) => e.spaceId === space.id)),
    [space.kind, space.id, type, entries],
  )

  // Conta nova com o dia já passado neste mês: começa no mês que vem
  // (senão nasceria "atrasada"), a não ser que este mês ainda esteja em aberto.
  const dayPassed = day < new Date().getDate()
  const startMonth = dayPassed && !includeThisMonth ? addMonths(currentYM(), 1) : currentYM()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = parseMoney(amount)
    if (!(value > 0) || !description.trim()) return
    const data = {
      type,
      amount: value,
      description: description.trim(),
      category: category.trim(),
      day,
      walletId: walletId || null,
      method,
      counterparty: counterparty.trim(),
      active,
    }
    void run(
      () =>
        recurring
          ? updateRecurring(recurring.id, data)
          : createRecurring({ ...data, spaceId: space.id, startMonth, lastGenerated: null }),
      recurring ? 'Conta fixa atualizada' : `Conta fixa criada — primeiro vencimento ${formatDate(dueDateFor(startMonth, day))}`,
    )
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow={space.name} title={recurring ? 'Editar conta fixa' : 'Nova conta fixa'}>
      {confirm && recurring ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Parar e apagar <span className="text-fg">{recurring.description}</span>? O que já foi pago continua no histórico; o
            que ainda vai vencer sai.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Voltar
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void run(() => deleteRecurring(recurring.id), 'Conta fixa apagada')}>
              Apagar conta fixa
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Segmented<TransactionType>
              value={type}
              onChange={setType}
              options={[
                { value: 'despesa', label: `${words.out} fixo` },
                { value: 'receita', label: `${words.in} fixa` },
              ]}
            />
          </div>
          <FormField label="Descrição" className="sm:col-span-2">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={space.kind === 'empresa' ? 'Ex.: Aluguel da loja' : 'Ex.: Internet'}
              required
              autoFocus={!recurring}
            />
          </FormField>
          <FormField label="Valor por mês">
            <MoneyInput value={amount} onChange={setAmount} />
          </FormField>
          <FormField label="Vence todo dia">
            <Select value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </FormField>
          {!recurring && (
            <div className="space-y-2 sm:col-span-2">
              <p className="text-xs text-muted">
                Primeiro vencimento: <span className="text-fg">{formatDate(dueDateFor(startMonth, day))}</span>
              </p>
              {dayPassed && (
                <Toggle
                  checked={includeThisMonth}
                  onChange={setIncludeThisMonth}
                  label="Este mês ainda não foi pago"
                  description={`O dia ${day} já passou — ligue para lançar este mês também (fica atrasada)`}
                />
              )}
            </div>
          )}
          <FormField label="Categoria" className="sm:col-span-2">
            <Input list={listId} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Escolha ou escreva" />
            <datalist id={listId}>
              {suggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </FormField>
          {spaceWallets.length > 0 && (
            <FormField label="Carteira">
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
          <FormField label="Forma">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={words.counterparty} className="sm:col-span-2">
            <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Opcional" />
          </FormField>
          {recurring && (
            <div className="sm:col-span-2">
              <Toggle checked={active} onChange={setActive} label="Ativa" description="Desligada, para de lançar os próximos meses" />
            </div>
          )}
          <Footer busy={busy} onClose={onClose} onDelete={recurring ? () => setConfirm(true) : undefined} className="sm:col-span-2" />
        </form>
      )}
    </Modal>
  )
}

// ------------------------------------------------------------
// Carteira (conta no banco, caixa, cartão...)
// ------------------------------------------------------------
export const WALLET_KINDS: { id: WalletKind; label: string }[] = [
  { id: 'banco', label: 'Conta no banco' },
  { id: 'caixa', label: 'Dinheiro / caixa' },
  { id: 'cartao', label: 'Cartão de crédito' },
  { id: 'investimento', label: 'Investimento / reserva' },
]

export function WalletFormModal({
  open,
  onClose,
  space,
  wallet,
}: {
  open: boolean
  onClose: () => void
  space: Space
  wallet?: Wallet | null
}) {
  const { createWallet, updateWallet, deleteWallet } = useSpaces()
  const { busy, run } = useSubmit(onClose)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<WalletKind>('banco')
  const [initial, setInitial] = useState('')
  const [archived, setArchived] = useState(false)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(wallet?.name ?? '')
    setKind(wallet?.kind ?? 'banco')
    setInitial(toInput(wallet?.initialBalance ?? 0))
    setArchived(wallet?.archived ?? false)
    setConfirm(false)
  }, [open, wallet])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const initialBalance = initial.trim() ? parseMoney(initial) : 0
    if (!name.trim() || Number.isNaN(initialBalance)) return
    const data = { name: name.trim(), kind, initialBalance, archived }
    void run(() => (wallet ? updateWallet(wallet.id, data) : createWallet({ ...data, spaceId: space.id })), wallet ? 'Carteira atualizada' : 'Carteira criada')
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow={space.name} title={wallet ? 'Editar carteira' : 'Nova carteira'} size="sm">
      {confirm && wallet ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Apagar a carteira <span className="text-fg">{wallet.name}</span>? Os lançamentos ficam, só deixam de estar ligados a ela.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Voltar
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void run(() => deleteWallet(wallet.id), 'Carteira apagada')}>
              Apagar carteira
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-1 gap-4">
          <FormField label="Nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank, Caixa da loja" required autoFocus={!wallet} />
          </FormField>
          <FormField label="Tipo">
            <div className="flex flex-wrap gap-1.5">
              {WALLET_KINDS.map((k) => (
                <button type="button" key={k.id} onClick={() => setKind(k.id)} className={cn('chip', kind === k.id && 'chip-on')}>
                  {k.label}
                </button>
              ))}
            </div>
          </FormField>
          <FormField label="Saldo de hoje" hint={kind === 'cartao' ? 'fatura em aberto: use −' : 'quanto tem agora'}>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-faint">R$</span>
              <Input inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0,00" className="pl-10 font-mono" />
            </div>
          </FormField>
          {wallet && <Toggle checked={archived} onChange={setArchived} label="Arquivada" description="Some das listas, mas o histórico fica" />}
          <Footer busy={busy} onClose={onClose} onDelete={wallet ? () => setConfirm(true) : undefined} />
        </form>
      )}
    </Modal>
  )
}

// ------------------------------------------------------------
// Meta (juntar dinheiro para algo)
// ------------------------------------------------------------
export function GoalFormModal({ open, onClose, space, goal }: { open: boolean; onClose: () => void; space: Space; goal?: Goal | null }) {
  const { createGoal, updateGoal, deleteGoal } = useSpaces()
  const { busy, run } = useSubmit(onClose)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [saved, setSaved] = useState('')
  const [deadline, setDeadline] = useState('')

  useEffect(() => {
    if (!open) return
    setName(goal?.name ?? '')
    setTarget(toInput(goal?.target))
    setSaved(toInput(goal?.saved ?? 0))
    setDeadline(goal?.deadline ?? '')
  }, [open, goal])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = parseMoney(target)
    const s = saved.trim() ? parseMoney(saved) : 0
    if (!name.trim() || !(t > 0) || Number.isNaN(s)) return
    const data = { name: name.trim(), target: t, saved: Math.max(0, s), deadline: deadline || null }
    void run(() => (goal ? updateGoal(goal.id, data) : createGoal({ ...data, spaceId: space.id })), goal ? 'Meta atualizada' : 'Meta criada')
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow={space.name} title={goal ? 'Editar meta' : 'Nova meta'} size="sm">
      <form onSubmit={submit} className="grid grid-cols-1 gap-4">
        <FormField label="Para quê">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={space.kind === 'empresa' ? 'Ex.: Reserva para impostos' : 'Ex.: Reserva de emergência'}
            required
            autoFocus={!goal}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Quanto quer juntar">
            <MoneyInput value={target} onChange={setTarget} />
          </FormField>
          <FormField label="Já tem">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-faint">R$</span>
              <Input inputMode="decimal" value={saved} onChange={(e) => setSaved(e.target.value)} placeholder="0,00" className="pl-10 font-mono" />
            </div>
          </FormField>
        </div>
        <FormField label="Até quando" hint="opcional">
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </FormField>
        <Footer busy={busy} onClose={onClose} onDelete={goal ? () => void run(() => deleteGoal(goal.id), 'Meta apagada') : undefined} />
      </form>
    </Modal>
  )
}

// ------------------------------------------------------------
// Orçamento: limite de gasto por categoria no mês
// ------------------------------------------------------------
export function BudgetFormModal({
  open,
  onClose,
  space,
  category: initialCategory,
  limit,
}: {
  open: boolean
  onClose: () => void
  space: Space
  category?: string
  limit?: number
}) {
  const { entries, budgets, saveBudget, deleteBudget } = useSpaces()
  const { busy, run } = useSubmit(onClose)
  const listId = useId()
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const existing = budgets.find((b) => b.spaceId === space.id && b.category === initialCategory)

  useEffect(() => {
    if (!open) return
    setCategory(initialCategory ?? '')
    setAmount(toInput(limit))
  }, [open, initialCategory, limit])

  const suggestions = categorySuggestions(space.kind, 'despesa', entries.filter((e) => e.spaceId === space.id))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = parseMoney(amount)
    if (!category.trim() || !(value > 0)) return
    void run(async () => {
      // Renomeou a categoria: o limite antigo sai.
      if (existing && existing.category !== category.trim()) await deleteBudget(existing.id)
      await saveBudget(space.id, category.trim(), value)
    }, 'Orçamento salvo')
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow={space.name} title={existing ? 'Editar limite' : 'Novo limite de gasto'} size="sm">
      <form onSubmit={submit} className="grid grid-cols-1 gap-4">
        <FormField label="Categoria">
          <Input list={listId} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex.: Alimentação" required autoFocus={!existing} />
          <datalist id={listId}>
            {suggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </FormField>
        <FormField label="Limite por mês">
          <MoneyInput value={amount} onChange={setAmount} />
        </FormField>
        <Footer busy={busy} onClose={onClose} onDelete={existing ? () => void run(() => deleteBudget(existing.id), 'Limite apagado') : undefined} />
      </form>
    </Modal>
  )
}
