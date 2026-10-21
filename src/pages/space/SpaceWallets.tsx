import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, Banknote, CreditCard, Landmark, PiggyBank, Plus, Wallet as WalletIcon, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/components/space/Money'
import { WALLET_KINDS, WalletFormModal } from '@/components/space/SpaceForms'
import { useSpacePage } from '@/layouts/SpaceLayout'
import { useSpaces } from '@/context/SpacesContext'
import { walletBalance } from '@/services/spaceMath'
import { formatDateShort } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Wallet, WalletKind } from '@/types'

const ICON: Record<WalletKind, LucideIcon> = { banco: Landmark, caixa: Banknote, cartao: CreditCard, investimento: PiggyBank }

export default function SpaceWallets() {
  const { space, openTransfer } = useSpacePage()
  const { wallets, entries } = useSpaces()
  const [modal, setModal] = useState<{ wallet: Wallet | null } | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const mine = entries.filter((e) => e.spaceId === space.id)
  const all = wallets.filter((w) => w.spaceId === space.id)
  const active = all.filter((w) => !w.archived)
  const archived = all.filter((w) => w.archived)
  const total = active.reduce((a, w) => a + walletBalance(w, mine), 0)

  const Tile = ({ w }: { w: Wallet }) => {
    const Icon = ICON[w.kind]
    const balance = walletBalance(w, mine)
    const last = mine.filter((e) => e.walletId === w.id && e.status === 'pago').sort((a, b) => b.date.localeCompare(a.date))[0]
    return (
      <div className={cn('panel panel-hover flex flex-col p-5', w.archived && 'opacity-60')}>
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-10 place-items-center rounded-xl border border-line-strong text-fg-soft">
            <Icon className="size-4.5" strokeWidth={1.6} />
          </span>
          <button onClick={() => setModal({ wallet: w })} className="text-xs text-muted transition hover:text-fg">
            Editar
          </button>
        </div>
        <p className="mt-4 truncate text-sm text-fg-soft">{w.name}</p>
        <p className="text-[11px] text-faint">{WALLET_KINDS.find((k) => k.id === w.kind)?.label}</p>
        <p className={cn('mt-3 text-2xl tracking-tight', balance < 0 ? 'text-danger' : 'text-fg')}>
          <Money value={balance} />
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-[11px] text-faint">
          <span className="truncate">{last ? `último: ${last.description} · ${formatDateShort(last.date)}` : 'sem movimentos ainda'}</span>
          <Link to={`/e/${space.id}/movimentacoes?carteira=${w.id}`} className="shrink-0 text-muted hover:text-fg">
            Extrato →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow={space.name}
        title="Carteiras"
        description="Onde o dinheiro está: conta no banco, caixa, cartão. O saldo se atualiza com cada lançamento pago."
        actions={
          <>
            {active.length >= 2 && (
              <Button variant="outline" icon={<ArrowLeftRight className="size-4" />} onClick={() => openTransfer('carteiras')}>
                Transferir
              </Button>
            )}
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setModal({ wallet: null })}>
              Nova carteira
            </Button>
          </>
        }
      />

      {active.length ? (
        <>
          <div className="panel mb-4 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-br from-[#1a1a1e] to-surface p-5">
            <div>
              <p className="eyebrow">Total disponível</p>
              <p className="text-metal mt-2 text-3xl tracking-tight">
                <Money value={total} />
              </p>
            </div>
            <p className="text-xs text-muted">
              {active.length} {active.length === 1 ? 'carteira' : 'carteiras'} · conta só o que já foi pago
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((w) => (
              <Tile key={w.id} w={w} />
            ))}
          </div>
        </>
      ) : (
        <Card>
          <EmptyState
            title="Nenhuma carteira ainda"
            description={
              space.kind === 'empresa'
                ? 'Ex.: “Conta da empresa” (banco), “Caixa da loja” (dinheiro), “Cartão da empresa”. Informe o saldo de hoje e o resto é automático.'
                : 'Ex.: “Nubank”, “Dinheiro”, “Cartão”. Informe o saldo de hoje e o resto é automático.'
            }
            action={
              <Button variant="primary" icon={<WalletIcon className="size-4" />} onClick={() => setModal({ wallet: null })}>
                Criar carteira
              </Button>
            }
          />
        </Card>
      )}

      {archived.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowArchived((v) => !v)} className="text-xs text-muted hover:text-fg">
            {showArchived ? 'Esconder' : 'Ver'} arquivadas ({archived.length})
          </button>
          {showArchived && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {archived.map((w) => (
                <Tile key={w.id} w={w} />
              ))}
            </div>
          )}
        </div>
      )}

      <WalletFormModal open={!!modal} onClose={() => setModal(null)} space={space} wallet={modal?.wallet} />
    </>
  )
}
