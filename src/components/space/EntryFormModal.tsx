import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import { PAYMENT_METHODS } from '@/data/constants'
import { categorySuggestions, localISO, parseMoney, spaceWords, splitInstallments } from '@/services/spaceMath'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Entry, PaymentMethod, Space, TransactionStatus, TransactionType } from '@/types'

/** Campo de valor em reais: aceita "1.234,56" e abre o teclado numérico no celular. */
export function MoneyInput({
  value,
  onChange,
  autoFocus,
  id,
  large,
}: {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
  id?: string
  large?: boolean
}) {
  return (
    <div className="relative">
      <span className={cn('pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint', large ? 'text-base' : 'text-sm')}>R$</span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0,00"
        className={cn('field pl-10 font-mono', large && 'py-3 text-xl')}
        required
      />
    </div>
  )
}

const LAST_WALLET = 'zenn-os:last-wallet:'

export function EntryFormModal({
  open,
  onClose,
  space,
  entry,
  defaultType = 'despesa',
}: {
  open: boolean
  onClose: () => void
  space: Space
  /** editar um lançamento existente */
  entry?: Entry | null
  defaultType?: TransactionType
}) {
  const { wallets, entries, createEntry, updateEntry, deleteEntry } = useSpaces()
  const toast = useToast()
  const words = spaceWords(space.kind)
  const listId = useId()
  const spaceWallets = wallets.filter((w) => w.spaceId === space.id && !w.archived)
  const [type, setType] = useState<TransactionType>(defaultType)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(localISO())
  const [status, setStatus] = useState<TransactionStatus>('pago')
  const [walletId, setWalletId] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [counterparty, setCounterparty] = useState('')
  const [notes, setNotes] = useState('')
  const [installments, setInstallments] = useState(1)
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    let lastWallet = ''
    try {
      lastWallet = localStorage.getItem(LAST_WALLET + space.id) ?? ''
    } catch {
      /* armazenamento indisponível */
    }
    const fallbackWallet = spaceWallets.some((w) => w.id === lastWallet) ? lastWallet : (spaceWallets[0]?.id ?? '')
    setType(entry?.type ?? defaultType)
    setAmount(entry ? String(entry.amount).replace('.', ',') : '')
    setDescription(entry?.description ?? '')
    setCategory(entry?.category ?? '')
    setDate(entry?.date ?? localISO())
    setStatus(entry?.status ?? 'pago')
    setWalletId(entry ? (entry.walletId ?? '') : fallbackWallet)
    setMethod(entry?.method ?? 'pix')
    setCounterparty(entry?.counterparty ?? '')
    setNotes(entry?.notes ?? '')
    setInstallments(1)
    setMore(!!(entry && (entry.counterparty || entry.notes)))
    setConfirmDelete(false)
  }, [open, entry, defaultType, space.id]) // carteiras de propósito fora: não resetar o formulário no meio

  const suggestions = useMemo(
    () => categorySuggestions(space.kind, type, entries.filter((e) => e.spaceId === space.id)),
    [space.kind, space.id, type, entries],
  )
  const value = parseMoney(amount)
  const parcels = installments > 1 && value > 0 ? splitInstallments(value, installments) : null
  const isIn = type === 'receita'
  const paidLabel = isIn ? 'Já recebi' : 'Já paguei'
  const openLabel = isIn ? 'A receber' : 'A pagar'

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!(value > 0)) {
      toast.error('Valor inválido', 'Digite um valor maior que zero, ex.: 150,00')
      return
    }
    setBusy(true)
    try {
      const data = {
        type,
        amount: value,
        description: description.trim() || category || (isIn ? words.in : words.out),
        category: category.trim(),
        date,
        status,
        walletId: walletId || null,
        method,
        counterparty: counterparty.trim(),
        notes: notes.trim(),
      }
      if (walletId) {
        try {
          localStorage.setItem(LAST_WALLET + space.id, walletId)
        } catch {
          /* armazenamento indisponível */
        }
      }
      if (entry) {
        await updateEntry(entry.id, {
          ...data,
          paidAt: status === 'pago' ? (entry.paidAt ?? new Date(`${date}T12:00:00`).toISOString()) : null,
        })
        toast.success('Lançamento atualizado', data.description)
      } else {
        const created = await createEntry({ ...data, spaceId: space.id, installments })
        toast.success(
          created.length > 1 ? `${created.length} parcelas lançadas` : `${isIn ? words.in : words.out} lançada`,
          `${data.description} · ${formatCurrency(value)}`,
        )
      }
      onClose()
    } catch (e) {
      toast.error('Não deu para salvar', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (group: boolean) => {
    if (!entry) return
    setBusy(true)
    try {
      await deleteEntry(entry.id, group)
      toast.success('Lançamento apagado', entry.description)
      onClose()
    } catch (e) {
      toast.error('Não deu para apagar', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const isGroup = !!entry?.linkId?.startsWith('parc_')
  const isPair = !!entry?.linkId?.startsWith('lnk_')

  return (
    <Modal open={open} onClose={onClose} eyebrow={space.name} title={entry ? 'Editar lançamento' : 'Novo lançamento'}>
      {confirmDelete && entry ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Apagar <span className="text-fg">{entry.description}</span>?{' '}
            {isPair && 'É uma transferência: a outra ponta também será apagada.'}
            {entry.recurringId && 'É de uma conta fixa: só este mês sai, os próximos continuam.'}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Voltar
            </Button>
            {isGroup && (
              <Button variant="danger" loading={busy} onClick={() => remove(true)}>
                Apagar todas as parcelas
              </Button>
            )}
            <Button variant="danger" loading={busy} onClick={() => remove(false)}>
              {isGroup ? 'Só esta parcela' : 'Apagar'}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Segmented<TransactionType>
              value={type}
              onChange={(t) => {
                setType(t)
                if (!entry) setCategory('')
              }}
              options={[
                { value: 'despesa', label: words.out },
                { value: 'receita', label: words.in },
              ]}
            />
          </div>

          <FormField label={installments > 1 ? 'Valor total' : 'Valor'} htmlFor="entry-amount" className="sm:col-span-2">
            <MoneyInput id="entry-amount" value={amount} onChange={setAmount} autoFocus={!entry} large />
            {parcels && (
              <p className="mt-1.5 text-xs text-muted">
                {installments}x de <span className="money font-mono text-fg">{formatCurrency(parcels[parcels.length - 1])}</span>, uma por mês
              </p>
            )}
          </FormField>

          <FormField label="Descrição" className="sm:col-span-2">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isIn ? (space.kind === 'empresa' ? 'Ex.: Vendas do dia' : 'Ex.: Salário') : space.kind === 'empresa' ? 'Ex.: Conta de luz' : 'Ex.: Mercado'}
            />
          </FormField>

          <FormField label="Categoria" className="sm:col-span-2">
            <Input list={listId} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Escolha ou escreva" />
            <datalist id={listId}>
              {suggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {suggestions.slice(0, 8).map((c) => (
                <button type="button" key={c} onClick={() => setCategory(c)} className={cn('chip', category === c && 'chip-on')}>
                  {c}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label={status === 'pago' ? 'Data' : 'Vencimento'}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </FormField>

          <FormField label="Situação">
            <Segmented<TransactionStatus>
              value={status}
              onChange={setStatus}
              options={[
                { value: 'pago', label: paidLabel },
                { value: 'pendente', label: openLabel },
              ]}
            />
          </FormField>

          {spaceWallets.length > 0 && (
            <FormField label="Carteira" hint="de onde sai / para onde vai">
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

          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted transition hover:text-fg sm:col-span-2"
          >
            <ChevronDown className={cn('size-3.5 transition-transform', more && 'rotate-180')} />
            {more ? 'Menos opções' : `Mais opções (${words.counterparty.toLowerCase()}, observação${entry ? '' : ', parcelas'})`}
          </button>

          {more && (
            <>
              <FormField label={words.counterparty}>
                <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Opcional" />
              </FormField>
              {!entry ? (
                <FormField label="Parcelas" hint="divide o valor total">
                  <Select value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? 'À vista' : `${n}x`}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : (
                <div className="hidden sm:block" />
              )}
              <FormField label="Observação" className="sm:col-span-2">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" placeholder="Opcional" />
              </FormField>
            </>
          )}

          <div className="flex items-center gap-2 border-t border-line pt-4 sm:col-span-2">
            {entry && (
              <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)} aria-label="Apagar">
                <span className="hidden sm:inline">Apagar</span>
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" loading={busy}>
                {entry ? 'Salvar' : 'Lançar'}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  )
}
