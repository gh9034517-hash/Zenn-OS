import { Suspense, createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { EntryFormModal, type EntryPreset } from '@/components/space/EntryFormModal'
import { TransferModal, type TransferMode } from '@/components/space/TransferModal'
import { Mascot } from '@/components/brand/Mascot'
import { useSpaces } from '@/context/SpacesContext'
import { useAccess } from '@/context/AccessContext'
import { spaceWords } from '@/services/spaceMath'
import { NEW_ENTRY_EVENT } from '@/utils/events'
import type { Entry, Space } from '@/types'

interface SpacePage {
  space: Space
  words: ReturnType<typeof spaceWords>
  /** abre o formulário: sem argumento = novo; com lançamento = editar; preset = novo já preenchido */
  openEntry: (entry?: Entry | null, preset?: EntryPreset) => void
  openTransfer: (mode: TransferMode) => void
  /** conta com acesso só para ver este espaço */
  readOnly: boolean
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
  const { canWrite } = useAccess()
  const space = spaceById(spaceId)
  const readOnly = !!space && !canWrite(space.id)
  const [entryModal, setEntryModal] = useState<{ entry: Entry | null; preset?: EntryPreset } | null>(null)
  const [transferMode, setTransferMode] = useState<TransferMode | null>(null)

  const openEntry = useCallback((entry: Entry | null = null, preset?: EntryPreset) => setEntryModal({ entry, preset }), [])

  useEffect(() => {
    const onNew = () => !readOnly && setEntryModal({ entry: null })
    window.addEventListener(NEW_ENTRY_EVENT, onNew)
    return () => window.removeEventListener(NEW_ENTRY_EVENT, onNew)
  }, [readOnly])

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
    <SpacePageContext.Provider value={{ space, words: spaceWords(space.kind), openEntry, openTransfer: setTransferMode, readOnly }}>
      {readOnly && (
        <p className="no-print mb-4 rounded-xl border border-line bg-white/[0.03] px-4 py-2.5 text-xs text-muted">
          Você tem acesso para <span className="text-fg">ver</span> este espaço. Para lançar ou editar, peça ao administrador.
        </p>
      )}
      <div className="pb-20 sm:pb-0">
        <Suspense
          fallback={
            <div className="flex min-h-[50vh] items-center justify-center">
              <p className="eyebrow animate-pulse">Carregando</p>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </div>

      {/* Lançar rápido pelo celular */}
      {!readOnly && (
        <button
          onClick={() => openEntry()}
          className="no-print fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-gradient-to-b from-accent to-accent-2 text-accent-ink shadow-[0_12px_32px_-10px_var(--color-accent)] transition active:scale-95 sm:hidden"
          aria-label="Novo lançamento"
        >
          <Plus className="size-6" />
        </button>
      )}

      <EntryFormModal
        open={!!entryModal}
        onClose={() => setEntryModal(null)}
        space={space}
        entry={entryModal?.entry}
        preset={entryModal?.preset}
        readOnly={readOnly}
      />
      <TransferModal open={!!transferMode} onClose={() => setTransferMode(null)} space={space} defaultMode={transferMode ?? 'carteiras'} />
    </SpacePageContext.Provider>
  )
}
