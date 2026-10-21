import { useState } from 'react'
import { Plus, Repeat } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/components/space/Money'
import { RecurringFormModal } from '@/components/space/SpaceForms'
import { useSpacePage } from '@/layouts/SpaceLayout'
import { useSpaces } from '@/context/SpacesContext'
import { cn } from '@/utils/cn'
import type { Recurring } from '@/types'

export default function SpaceRecurring() {
  const { space, words } = useSpacePage()
  const { recurrings, wallets } = useSpaces()
  const [modal, setModal] = useState<{ recurring: Recurring | null } | null>(null)

  const mine = recurrings.filter((r) => r.spaceId === space.id)
  const outs = mine.filter((r) => r.type === 'despesa')
  const ins = mine.filter((r) => r.type === 'receita')
  const fixedOut = outs.filter((r) => r.active).reduce((a, r) => a + r.amount, 0)
  const fixedIn = ins.filter((r) => r.active).reduce((a, r) => a + r.amount, 0)

  const List = ({ title, rows }: { title: string; rows: Recurring[] }) => (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
        <p className="text-sm font-medium">{title}</p>
        <Money value={rows.filter((r) => r.active).reduce((a, r) => a + r.amount, 0)} className="text-sm text-fg" />
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => setModal({ recurring: r })}
              className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02] sm:px-5', !r.active && 'opacity-50')}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-center leading-none">
                <span>
                  <span className="block font-mono text-sm text-fg">{r.day}</span>
                  <span className="block text-[8px] tracking-widest text-faint uppercase">dia</span>
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-fg">{r.description}</span>
                <span className="block truncate text-xs text-muted">
                  {[r.category, r.counterparty, wallets.find((w) => w.id === r.walletId)?.name, !r.active && 'pausada'].filter(Boolean).join(' · ') ||
                    'todo mês'}
                </span>
              </span>
              <Money value={r.amount} className="shrink-0 text-sm text-fg-soft" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )

  return (
    <>
      <PageHeader
        eyebrow={space.name}
        title="Contas fixas"
        description="O que se repete todo mês. Cada uma entra sozinha como “a pagar” (ou “a receber”) no mês certo."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setModal({ recurring: null })}>
            Nova conta fixa
          </Button>
        }
      />

      {mine.length ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="panel p-4">
              <p className="eyebrow !tracking-[0.14em]">{words.outs} fixos / mês</p>
              <p className="mt-2 text-lg">
                <Money value={fixedOut} />
              </p>
            </div>
            <div className="panel p-4">
              <p className="eyebrow !tracking-[0.14em]">{words.ins} fixas / mês</p>
              <p className="mt-2 text-lg">
                <Money value={fixedIn} />
              </p>
            </div>
            <div className="panel col-span-2 p-4 sm:col-span-1">
              <p className="eyebrow !tracking-[0.14em]">Sobra do fixo</p>
              <p className="mt-2 text-lg">
                <Money value={fixedIn - fixedOut} />
              </p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {outs.length > 0 && <List title={`${words.outs} fixos`} rows={outs} />}
            {ins.length > 0 && <List title={`${words.ins} fixas`} rows={ins} />}
          </div>
        </>
      ) : (
        <Card>
          <EmptyState
            title="Nenhuma conta fixa ainda"
            description={
              space.kind === 'empresa'
                ? 'Cadastre aluguel, água, luz, internet, salários, contador… Todo mês elas aparecem em Contas a pagar.'
                : 'Cadastre aluguel, internet, celular, academia, assinaturas… Todo mês elas aparecem em Contas a pagar.'
            }
            action={
              <Button variant="primary" icon={<Repeat className="size-4" />} onClick={() => setModal({ recurring: null })}>
                Cadastrar a primeira
              </Button>
            }
          />
        </Card>
      )}

      <RecurringFormModal open={!!modal} onClose={() => setModal(null)} space={space} recurring={modal?.recurring} />
    </>
  )
}
