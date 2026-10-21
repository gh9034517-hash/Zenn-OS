import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDown } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { MoneyInput } from '@/components/space/EntryFormModal'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import { localISO, parseMoney } from '@/services/spaceMath'
import { formatCurrency } from '@/utils/format'
import type { Space, TransactionStatus } from '@/types'

export type TransferMode = 'carteiras' | 'espacos'

const categoryOut = (s: Space | undefined) => (s?.kind === 'empresa' ? 'Salários' : 'Outros gastos')
const categoryIn = (s: Space | undefined) => (s?.kind === 'pessoal' ? 'Salário' : 'Outras receitas')

/**
 * Entre carteiras: tira de uma e põe em outra (não é receita nem despesa).
 * Entre espaços: ex. "meu pagamento" — despesa no Trabalho e entrada no Pessoal.
 */
export function TransferModal({
  open,
  onClose,
  space,
  defaultMode = 'carteiras',
}: {
  open: boolean
  onClose: () => void
  space: Space
  defaultMode?: TransferMode
}) {
  const { spaces, wallets, transfer } = useSpaces()
  const toast = useToast()
  const [mode, setMode] = useState<TransferMode>(defaultMode)
  const [fromSpace, setFromSpace] = useState(space.id)
  const [toSpace, setToSpace] = useState('')
  const [fromWallet, setFromWallet] = useState('')
  const [toWallet, setToWallet] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(localISO())
  const [status, setStatus] = useState<TransactionStatus>('pago')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const walletsOf = (id: string) => wallets.filter((w) => w.spaceId === id && !w.archived)

  useEffect(() => {
    if (!open) return
    const other =
      spaces.find((s) => s.id !== space.id && s.kind !== space.kind) ?? spaces.find((s) => s.id !== space.id)
    // "Meu pagamento" sempre sai da empresa e entra no pessoal.
    const [from, to] = space.kind === 'pessoal' && other?.kind === 'empresa' ? [other.id, space.id] : [space.id, other?.id ?? '']
    const own = walletsOf(space.id)
    setMode(defaultMode)
    setFromSpace(from)
    setToSpace(to)
    setFromWallet(defaultMode === 'carteiras' ? (own[0]?.id ?? '') : (walletsOf(from)[0]?.id ?? ''))
    setToWallet(defaultMode === 'carteiras' ? (own[1]?.id ?? '') : (walletsOf(to)[0]?.id ?? ''))
    setAmount('')
    setDate(localISO())
    setStatus('pago')
    setDescription('')
  }, [open, defaultMode, space.id]) // só ao abrir: não apagar o que já foi digitado

  const changeMode = (m: TransferMode) => {
    setMode(m)
    if (m === 'carteiras') {
      const own = walletsOf(space.id)
      setFromWallet(own[0]?.id ?? '')
      setToWallet(own[1]?.id ?? '')
    } else {
      setFromWallet(walletsOf(fromSpace)[0]?.id ?? '')
      setToWallet(walletsOf(toSpace)[0]?.id ?? '')
    }
  }

  const value = parseMoney(amount)
  const from = spaces.find((s) => s.id === fromSpace)
  const to = spaces.find((s) => s.id === toSpace)
  const isPay = mode === 'espacos' && from?.kind === 'empresa' && to?.kind === 'pessoal'
  const ownWallets = walletsOf(space.id)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!(value > 0)) {
      toast.error('Valor inválido', 'Digite um valor maior que zero.')
      return
    }
    if (mode === 'carteiras' && (!fromWallet || !toWallet || fromWallet === toWallet)) {
      toast.error('Escolha duas carteiras diferentes')
      return
    }
    if (mode === 'espacos' && (!toSpace || fromSpace === toSpace)) {
      toast.error('Escolha dois espaços diferentes')
      return
    }
    setBusy(true)
    try {
      if (mode === 'carteiras') {
        await transfer({
          from: { spaceId: space.id, walletId: fromWallet, category: 'Transferência' },
          to: { spaceId: space.id, walletId: toWallet, category: 'Transferência' },
          amount: value,
          date,
          status: 'pago',
          description: description.trim() || 'Transferência entre carteiras',
          countsAsResult: false,
        })
      } else {
        await transfer({
          from: { spaceId: fromSpace, walletId: fromWallet || null, category: categoryOut(from) },
          to: { spaceId: toSpace, walletId: toWallet || null, category: categoryIn(to) },
          amount: value,
          date,
          status,
          description: description.trim() || (isPay ? 'Meu pagamento' : `Transferência ${from?.name} → ${to?.name}`),
          countsAsResult: true,
          method: 'pix',
        })
      }
      toast.success(isPay ? 'Pagamento registrado' : 'Transferência feita', formatCurrency(value))
      onClose()
    } catch (err) {
      toast.error('Não deu para transferir', err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow={space.name} title={isPay ? 'Meu pagamento' : 'Transferir'}>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4">
        <Segmented<TransferMode>
          value={mode}
          onChange={changeMode}
          options={[
            { value: 'carteiras', label: 'Entre carteiras' },
            { value: 'espacos', label: 'Entre espaços' },
          ]}
        />
        <p className="-mt-1 text-xs text-muted">
          {mode === 'carteiras'
            ? 'Ex.: tirei do banco e pus no caixa. Muda os saldos, mas não conta como receita nem despesa.'
            : 'Ex.: o que você recebe pelo trabalho. Vira despesa de um espaço e entrada no outro, de uma vez.'}
        </p>

        {mode === 'carteiras' ? (
          ownWallets.length < 2 ? (
            <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
              Cadastre pelo menos duas carteiras neste espaço (ex.: Banco e Caixa) para transferir entre elas.
            </p>
          ) : (
            <div className="grid gap-2">
              <FormField label="Sai de">
                <Select value={fromWallet} onChange={(e) => setFromWallet(e.target.value)}>
                  {ownWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <ArrowDown className="mx-auto size-4 text-faint" />
              <FormField label="Vai para">
                <Select value={toWallet} onChange={(e) => setToWallet(e.target.value)}>
                  {ownWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          )
        ) : (
          <div className="grid gap-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <FormField label="Sai do espaço">
                <Select
                  value={fromSpace}
                  onChange={(e) => {
                    setFromSpace(e.target.value)
                    setFromWallet(walletsOf(e.target.value)[0]?.id ?? '')
                  }}
                >
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Carteira">
                <Select value={fromWallet} onChange={(e) => setFromWallet(e.target.value)}>
                  <option value="">Nenhuma</option>
                  {walletsOf(fromSpace).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <ArrowDown className="mx-auto size-4 text-faint" />
            <div className="grid gap-2 sm:grid-cols-2">
              <FormField label="Entra no espaço">
                <Select
                  value={toSpace}
                  onChange={(e) => {
                    setToSpace(e.target.value)
                    setToWallet(walletsOf(e.target.value)[0]?.id ?? '')
                  }}
                >
                  <option value="">Escolha</option>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Carteira">
                <Select value={toWallet} onChange={(e) => setToWallet(e.target.value)}>
                  <option value="">Nenhuma</option>
                  {walletsOf(toSpace).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Valor">
            <MoneyInput value={amount} onChange={setAmount} large />
          </FormField>
          <FormField label="Data">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </FormField>
        </div>
        {mode === 'espacos' && (
          <FormField label="Situação">
            <Segmented<TransactionStatus>
              value={status}
              onChange={setStatus}
              options={[
                { value: 'pago', label: 'Já foi pago' },
                { value: 'pendente', label: 'Ainda vai pagar' },
              ]}
            />
          </FormField>
        )}
        <FormField label="Descrição">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={mode === 'carteiras' ? 'Transferência entre carteiras' : isPay ? 'Meu pagamento' : 'Transferência'}
          />
        </FormField>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={mode === 'carteiras' && ownWallets.length < 2}>
            {isPay ? 'Registrar pagamento' : 'Transferir'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
