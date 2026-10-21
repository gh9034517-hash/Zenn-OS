import { Suspense, createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { EntryFormModal } from '@/components/space/EntryFormModal'
import { TransferModal, type TransferMode } from '@/components/space/TransferModal'
import { Mascot } from '@/components/brand/Mascot'
import { useSpaces } from '@/context/SpacesContext'
import { spaceWords } from '@/services/spaceMath'
import { NEW_ENTRY_EVENT } from '@/utils/events'
import type { Entry, Space, TransactionType } from '@/types'

interface SpacePage {
  space: Space
  words: ReturnType<typeof spaceWords>
  /** abre o formulário: sem argumento = novo; com lançamento = editar */
  openEntry: (entry?: Entry | null, type?: TransactionType) => void
  openTransfer: (mode: TransferMode) => void
}

const SpacePageContext = createContext<SpacePage | null>(null)

export function useSpacePage() {
  const ctx = useContext(SpacePageContext)
  if (!ctx) throw new Error('useSpacePage deve ser usado dentro de um espaço')
  return ctx
}

/** Moldura de um espaço (Pessoal, Trabalho...): valida o id e guarda os formulários. */
export function SpaceLayout() {
  const { spaceId } = useParams()
  const { spaceById, loading, error } = useSpaces()
  const space = spaceById(spaceId)
  const [entryModal, setEntryModal] = useState<{ entry: Entry | null; type: TransactionType } | null>(null)
  const [transferMode, setTransferMode] = useState<TransferMode | null>(null)

  const openEntry = useCallback((entry: Entry | null = null, type: TransactionType = 'despesa') => setEntryModal({ entry, type }), [])

  useEffect(() => {
    const onNew = () => setEntryModal({ entry: null, type: 'despesa' })
    window.addEventListener(NEW_ENTRY_EVENT, onNew)
    return () => window.removeEventListener(NEW_ENTRY_EVENT, onNew)
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Mascot size={96} />
        <p className="eyebrow">Carregando</p>
      </div>
    )
  }
  if (error && !space) {
    return (
      <div className="panel mx-auto max-w-lg p-6 text-sm">
        <p className="font-medium">Não foi possível carregar este espaço.</p>
        <p className="mt-2 text-muted">{error}</p>
      </div>
    )
  }
  if (!space) return <Navigate to="/geral" replace />

  return (
    <SpacePageContext.Provider value={{ space, words: spaceWords(space.kind), openEntry, openTransfer: setTransferMode }}>
      <div className="pb-20 sm:pb-0">
        <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><p className="eyebrow animate-pulse">Carregando</p></div>}>
          <Outlet />
        </Suspense>
      </div>

      {/* Lançar rápido pelo celular */}
      <button
        onClick={() => openEntry()}
        className="no-print fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-gradient-to-b from-white to-[#cfcfd4] text-black shadow-[0_12px_32px_-8px_rgba(255,255,255,0.45)] transition active:scale-95 sm:hidden"
        aria-label="Novo lançamento"
      >
        <Plus className="size-6" />
      </button>

      <EntryFormModal
        open={!!entryModal}
        onClose={() => setEntryModal(null)}
        space={space}
        entry={entryModal?.entry}
        defaultType={entryModal?.type}
      />
      <TransferModal open={!!transferMode} onClose={() => setTransferMode(null)} space={space} defaultMode={transferMode ?? 'carteiras'} />
    </SpacePageContext.Provider>
  )
}
