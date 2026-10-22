// Estado dos espaços separados (Pessoal, Trabalho...): carteiras, lançamentos,
// contas fixas, orçamento, metas e lembretes. Independente do DataContext:
// se algo falhar aqui, a Zenn Works continua funcionando.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { build, provider, type NewRecord } from '@/services/database'
import { getSupabase } from '@/lib/supabase'
import { uid } from '@/utils/id'
import {
  addMonths,
  dueDateFor,
  localISO,
  monthsToGenerate,
  recurringEntryId,
  recurringHorizon,
  splitInstallments,
} from '@/services/spaceMath'
import type { Budget, CollectionName, Collections, Entry, Goal, Job, Recurring, Reminder, Space, StockItem, StockMove, StockReason, Wallet } from '@/types'

interface SpacesSnapshot {
  spaces: Space[]
  wallets: Wallet[]
  entries: Entry[]
  recurrings: Recurring[]
  budgets: Budget[]
  goals: Goal[]
  reminders: Reminder[]
  jobs: Job[]
  stockItems: StockItem[]
  stockMoves: StockMove[]
}

const EMPTY: SpacesSnapshot = {
  spaces: [],
  wallets: [],
  entries: [],
  recurrings: [],
  budgets: [],
  goals: [],
  reminders: [],
  jobs: [],
  stockItems: [],
  stockMoves: [],
}
// Ordem importa ao apagar um espaço no modo local (movimentos antes dos itens).
const SPACE_COLLECTIONS = ['stock_moves', 'stock_items', 'wallets', 'entries', 'recurrings', 'budgets', 'goals', 'reminders', 'jobs'] as const

const DEFAULT_SPACES: NewRecord<Space>[] = [
  { id: 'pessoal', name: 'Pessoal', kind: 'pessoal', position: 1 },
  { id: 'trabalho', name: 'Trabalho', kind: 'empresa', position: 2 },
]

const PREFIX: Record<CollectionName, string> = {
  leads: 'lead',
  clients: 'cli',
  projects: 'prj',
  tasks: 'tsk',
  transactions: 'trx',
  payments: 'pay',
  activities: 'act',
  spaces: 'spc',
  wallets: 'wal',
  entries: 'ent',
  recurrings: 'rec',
  budgets: 'bud',
  goals: 'gol',
  reminders: 'rem',
  jobs: 'job', stock_items: 'stk', stock_moves: 'mov',
}

const insert = <K extends CollectionName>(c: K, data: NewRecord<Collections[K]>) =>
  provider.insert(c, build<Collections[K]>(data, PREFIX[c]))

/** Chave já existente (outro aparelho lançou primeiro): não é erro. */
const isDuplicate = (e: unknown) => {
  const err = e as { code?: string; message?: string }
  return err?.code === '23505' || /duplicate key/i.test(err?.message ?? '')
}

/** O banco recusou por permissão (conta que só pode ver). */
function friendly(e: unknown): unknown {
  const err = e as { code?: string; message?: string }
  if (err?.code === '42501' || /row-level security/i.test(err?.message ?? '')) {
    return new Error('Sua conta só tem permissão para ver este espaço.')
  }
  return e
}

const byPosition = (a: Space, b: Space) => a.position - b.position || a.createdAt.localeCompare(b.createdAt)

export interface EntryInput extends Omit<
  NewRecord<Entry>,
  'spaceId' | 'recurringId' | 'linkId' | 'isTransfer' | 'installment' | 'paidAt' | 'jobId'
> {
  spaceId: string
  jobId?: string | null
  /** 1 = à vista; 2+ divide o valor total em parcelas mensais */
  installments?: number
}

export interface TransferInput {
  from: { spaceId: string; walletId: string | null; category: string }
  to: { spaceId: string; walletId: string | null; category: string }
  amount: number
  date: string
  description: string
  status: Entry['status']
  /** false = só move dinheiro entre carteiras do mesmo espaço */
  countsAsResult: boolean
  method?: Entry['method']
}

interface SpacesContextValue extends SpacesSnapshot {
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  spaceById: (id: string | undefined) => Space | undefined

  createSpace: (data: Pick<Space, 'name' | 'kind'>) => Promise<Space>
  updateSpace: (id: string, patch: Partial<Space>) => Promise<void>
  deleteSpace: (id: string) => Promise<void>

  createWallet: (data: NewRecord<Wallet>) => Promise<Wallet>
  updateWallet: (id: string, patch: Partial<Wallet>) => Promise<void>
  deleteWallet: (id: string) => Promise<void>

  createEntry: (data: EntryInput) => Promise<Entry[]>
  updateEntry: (id: string, patch: Partial<Entry>) => Promise<void>
  setEntryPaid: (id: string, paid: boolean, walletId?: string | null) => Promise<void>
  /** apaga o lançamento; com `group`, também a outra ponta / demais parcelas */
  deleteEntry: (id: string, group?: boolean) => Promise<void>
  transfer: (input: TransferInput) => Promise<void>

  createRecurring: (data: NewRecord<Recurring>) => Promise<Recurring>
  updateRecurring: (id: string, patch: Partial<Recurring>) => Promise<void>
  deleteRecurring: (id: string) => Promise<void>

  saveBudget: (spaceId: string, category: string, monthlyLimit: number) => Promise<void>
  deleteBudget: (id: string) => Promise<void>

  createGoal: (data: NewRecord<Goal>) => Promise<Goal>
  updateGoal: (id: string, patch: Partial<Goal>) => Promise<void>
  deleteGoal: (id: string) => Promise<void>

  createReminder: (data: NewRecord<Reminder>) => Promise<Reminder>
  updateReminder: (id: string, patch: Partial<Reminder>) => Promise<void>
  deleteReminder: (id: string) => Promise<void>

  createJob: (data: NewRecord<Job>) => Promise<Job>
  updateJob: (id: string, patch: Partial<Job>) => Promise<void>
  /** apaga o serviço; os lançamentos ficam, só perdem o vínculo */
  deleteJob: (id: string) => Promise<void>

  createStockItem: (data: NewRecord<StockItem>) => Promise<StockItem>
  updateStockItem: (id: string, patch: Partial<StockItem>) => Promise<void>
  deleteStockItem: (id: string) => Promise<void>
  /** entrada (+) ou saída (−): registra o movimento e atualiza o saldo */
  moveStock: (input: { itemId: string; delta: number; reason: StockReason; jobId?: string | null; note?: string; date?: string }) => Promise<void>
  /** desfaz um movimento (o saldo volta) */
  undoStockMove: (id: string) => Promise<void>
}

const SpacesContext = createContext<SpacesContextValue | null>(null)

async function loadSnapshot(): Promise<SpacesSnapshot> {
  const [spaces, wallets, entries, recurrings, budgets, goals, reminders, jobs, stockItems, stockMoves] = await Promise.all([
    provider.list('spaces'),
    provider.list('wallets'),
    provider.list('entries'),
    provider.list('recurrings'),
    provider.list('budgets'),
    provider.list('goals'),
    provider.list('reminders'),
    provider.list('jobs'),
    provider.list('stock_items'),
    provider.list('stock_moves'),
  ])
  return {
    spaces: spaces.sort(byPosition),
    wallets: wallets.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    entries: entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    recurrings: recurrings.sort((a, b) => a.day - b.day),
    budgets,
    goals: goals.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    reminders: reminders.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')),
    jobs: jobs
      .map((j) => ({ ...j, checklist: Array.isArray(j.checklist) ? j.checklist : [] }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    stockItems: stockItems.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)),
    stockMoves: stockMoves.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
  }
}

/** Primeira vez no modo local: cria Pessoal e Trabalho (no Supabase eles
 *  já vêm do schema, e quem não é administrador nem pode criar espaços). */
async function ensureDefaultSpaces(snap: SpacesSnapshot): Promise<boolean> {
  if (provider.name !== 'local' || snap.spaces.length) return false
  for (const s of DEFAULT_SPACES) {
    try {
      await insert('spaces', s)
    } catch (e) {
      if (!isDuplicate(e)) throw e
    }
  }
  return true
}

/** Lança o mês das contas fixas que ainda não foram lançadas. */
async function generateRecurring(snap: SpacesSnapshot): Promise<boolean> {
  const horizon = recurringHorizon()
  const existing = new Set(snap.entries.map((e) => e.id))
  let changed = false
  for (const r of snap.recurrings) {
    const months = monthsToGenerate(r, horizon)
    if (!months.length) continue
    try {
      for (const ym of months) {
        const id = recurringEntryId(r.id, ym)
        if (existing.has(id)) continue
        try {
          await insert('entries', {
            id,
            spaceId: r.spaceId,
            type: r.type,
            description: r.description,
            amount: r.amount,
            category: r.category,
            date: dueDateFor(ym, r.day),
            status: 'pendente',
            paidAt: null,
            walletId: r.walletId,
            method: r.method,
            counterparty: r.counterparty,
            notes: '',
            recurringId: r.id,
            linkId: null,
            isTransfer: false,
            installment: null,
            jobId: null,
          })
        } catch (e) {
          if (!isDuplicate(e)) throw e
        }
      }
      await provider.update('recurrings', r.id, { lastGenerated: months[months.length - 1] })
      changed = true
    } catch (e) {
      // Conta que só vê o espaço: quem lança as fixas é o dono.
      if (friendly(e) === e) throw e
    }
  }
  return changed
}

export function SpacesProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<SpacesSnapshot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const running = useRef<Promise<void> | null>(null)

  const refresh = useCallback(async () => {
    try {
      setSnap(await loadSnapshot())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  // Carga completa: espaços padrão + contas fixas do mês. Uma de cada vez
  // (o StrictMode e a troca de sessão disparam isto mais de uma vez); se
  // pedirem de novo no meio, roda outra vez no fim.
  const again = useRef(false)
  const bootstrap = useCallback((): Promise<void> => {
    if (running.current) {
      again.current = true
      return running.current
    }
    running.current = (async () => {
      try {
        // Sem login no Supabase não há o que ler (e nada pode ser criado).
        const sb = provider.name === 'supabase' ? getSupabase() : null
        if (sb && !(await sb.auth.getSession()).data.session) {
          setSnap(EMPTY)
          return
        }
        let s = await loadSnapshot()
        const seeded = await ensureDefaultSpaces(s)
        const generated = await generateRecurring(s)
        if (seeded || generated) s = await loadSnapshot()
        setSnap(s)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
        running.current = null
        if (again.current) {
          again.current = false
          void bootstrap()
        }
      }
    })()
    return running.current
  }, [])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    if (provider.name !== 'supabase') return
    const sb = getSupabase()
    if (!sb) return
    // A carga inicial já roda na montagem; aqui só entrada e saída de conta.
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (!session) setSnap(EMPTY)
      else if (event === 'SIGNED_IN') void bootstrap()
    })
    return () => data.subscription.unsubscribe()
  }, [bootstrap])

  // Virou o mês com o app aberto: lança as fixas novas.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && void bootstrap()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [bootstrap])

  const value = useMemo<SpacesContextValue>(() => {
    const withRefresh =
      <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
      async (...args: A) => {
        try {
          const result = await fn(...args)
          await refresh()
          return result
        } catch (e) {
          throw friendly(e)
        }
      }

    const entriesNow = async () => provider.list('entries')
    const paidAtFor = (status: Entry['status'], date: string) => (status === 'pago' ? new Date(`${date}T12:00:00`).toISOString() : null)

    const pendingFromToday = async (recurringId: string) => {
      const today = localISO()
      return (await entriesNow()).filter((e) => e.recurringId === recurringId && e.status === 'pendente' && e.date >= today)
    }

    /** Pares (transferência / meu pagamento) andam juntos; parcelas não. */
    const isPair = (linkId: string | null) => !!linkId && linkId.startsWith('lnk_')

    const createEntryRaw = async ({ installments = 1, jobId = null, ...data }: EntryInput) => {
      const n = Math.max(1, Math.min(Math.floor(installments), 48))
      if (n === 1) {
        return [
          await insert('entries', {
            ...data,
            jobId,
            paidAt: paidAtFor(data.status, data.date),
            recurringId: null,
            linkId: null,
            isTransfer: false,
            installment: null,
          }),
        ]
      }
      const linkId = uid('parc')
      const amounts = splitInstallments(data.amount, n)
      const day = Number(data.date.slice(8, 10))
      const created: Entry[] = []
      for (let i = 0; i < n; i++) {
        const date = i === 0 ? data.date : dueDateFor(addMonths(data.date.slice(0, 7), i), day)
        const status = i === 0 ? data.status : 'pendente'
        created.push(
          await insert('entries', {
            ...data,
            jobId,
            amount: amounts[i],
            date,
            status,
            paidAt: paidAtFor(status, date),
            recurringId: null,
            linkId,
            isTransfer: false,
            installment: `${i + 1}/${n}`,
          }),
        )
      }
      return created
    }

    const updateEntryRaw = async (id: string, patch: Partial<Entry>) => {
      const all = await entriesNow()
      const entry = all.find((e) => e.id === id)
      if (!entry) throw new Error('Lançamento não encontrado')
      await provider.update('entries', id, patch)
      if (isPair(entry.linkId)) {
        const shared: Partial<Entry> = {}
        for (const k of ['amount', 'date', 'status', 'paidAt', 'description'] as const) {
          if (k in patch) (shared as Record<string, unknown>)[k] = patch[k]
        }
        if (Object.keys(shared).length) {
          for (const other of all.filter((e) => e.linkId === entry.linkId && e.id !== id)) {
            await provider.update('entries', other.id, shared)
          }
        }
      }
    }

    const deleteEntryRaw = async (id: string, group = false) => {
      const all = await entriesNow()
      const entry = all.find((e) => e.id === id)
      if (!entry) return
      // A outra ponta de uma transferência sempre vai junto (senão o saldo fica torto).
      const together = entry.linkId && (group || isPair(entry.linkId)) ? all.filter((e) => e.linkId === entry.linkId) : [entry]
      for (const e of together) await provider.remove('entries', e.id)
    }

    const transferRaw = async (t: TransferInput) => {
      const linkId = uid('lnk')
      const base = {
        amount: t.amount,
        date: t.date,
        status: t.status,
        paidAt: paidAtFor(t.status, t.date),
        method: t.method ?? ('transferencia' as const),
        counterparty: '',
        notes: '',
        recurringId: null,
        linkId,
        isTransfer: !t.countsAsResult,
        installment: null,
        jobId: null,
        description: t.description,
      }
      await insert('entries', { ...base, spaceId: t.from.spaceId, walletId: t.from.walletId, category: t.from.category, type: 'despesa' })
      await insert('entries', { ...base, spaceId: t.to.spaceId, walletId: t.to.walletId, category: t.to.category, type: 'receita' })
    }

    const deleteSpaceRaw = async (id: string) => {
      // O Supabase apaga em cascata; o armazenamento local precisa de ajuda.
      for (const c of SPACE_COLLECTIONS) {
        const rows = (await provider.list(c)) as { id: string; spaceId: string }[]
        for (const r of rows.filter((r) => r.spaceId === id)) await provider.remove(c, r.id)
      }
      await provider.remove('spaces', id)
    }

    const deleteWalletRaw = async (id: string) => {
      for (const c of ['entries', 'recurrings'] as const) {
        const rows = (await provider.list(c)) as { id: string; walletId: string | null }[]
        for (const r of rows.filter((r) => r.walletId === id)) await provider.update(c, r.id, { walletId: null })
      }
      await provider.remove('wallets', id)
    }

    const saveBudgetRaw = async (spaceId: string, category: string, monthlyLimit: number) => {
      const current = (await provider.list('budgets')).find((b) => b.spaceId === spaceId && b.category === category)
      if (current) await provider.update('budgets', current.id, { monthlyLimit })
      else await insert('budgets', { spaceId, category, monthlyLimit })
    }

    const createRecurringRaw = async (data: NewRecord<Recurring>) => {
      const r = await insert('recurrings', data)
      // Já lança o mês atual (e o próximo, se o vencimento estiver perto).
      await generateRecurring({ ...(await loadSnapshot()), recurrings: [r] })
      return r
    }

    return {
      ...snap,
      loading,
      error,
      refresh,
      spaceById: (id) => snap.spaces.find((s) => s.id === id),

      createSpace: withRefresh(async (data: Pick<Space, 'name' | 'kind'>) => {
        const position = Math.max(0, ...snap.spaces.map((s) => s.position)) + 1
        return insert('spaces', { ...data, position })
      }),
      updateSpace: withRefresh(async (id: string, patch: Partial<Space>) => {
        await provider.update('spaces', id, patch)
      }),
      deleteSpace: withRefresh(deleteSpaceRaw),

      createWallet: withRefresh((data: NewRecord<Wallet>) => insert('wallets', data)),
      updateWallet: withRefresh(async (id: string, patch: Partial<Wallet>) => {
        await provider.update('wallets', id, patch)
      }),
      deleteWallet: withRefresh(deleteWalletRaw),

      createEntry: withRefresh(createEntryRaw),
      updateEntry: withRefresh(updateEntryRaw),
      setEntryPaid: withRefresh(async (id: string, paid: boolean, walletId?: string | null) => {
        const patch: Partial<Entry> = paid
          ? { status: 'pago', paidAt: new Date().toISOString(), ...(walletId !== undefined ? { walletId } : {}) }
          : { status: 'pendente', paidAt: null }
        await updateEntryRaw(id, patch)
      }),
      deleteEntry: withRefresh(deleteEntryRaw),
      transfer: withRefresh(transferRaw),

      createRecurring: withRefresh(createRecurringRaw),
      updateRecurring: withRefresh(async (id: string, patch: Partial<Recurring>) => {
        const r = await provider.update('recurrings', id, patch)
        // Os meses já lançados e ainda em aberto acompanham a mudança.
        for (const e of await pendingFromToday(id)) {
          await provider.update('entries', e.id, {
            description: r.description,
            amount: r.amount,
            category: r.category,
            counterparty: r.counterparty,
            walletId: r.walletId,
            method: r.method,
            date: dueDateFor(e.date.slice(0, 7), r.day),
          })
        }
      }),
      deleteRecurring: withRefresh(async (id: string) => {
        // O que já foi pago ou venceu fica (é história); o que ainda vai vencer sai.
        for (const e of await pendingFromToday(id)) await provider.remove('entries', e.id)
        await provider.remove('recurrings', id)
      }),

      saveBudget: withRefresh(saveBudgetRaw),
      deleteBudget: withRefresh((id: string) => provider.remove('budgets', id)),

      createGoal: withRefresh((data: NewRecord<Goal>) => insert('goals', data)),
      updateGoal: withRefresh(async (id: string, patch: Partial<Goal>) => {
        await provider.update('goals', id, patch)
      }),
      deleteGoal: withRefresh((id: string) => provider.remove('goals', id)),

      createReminder: withRefresh((data: NewRecord<Reminder>) => insert('reminders', data)),
      updateReminder: withRefresh(async (id: string, patch: Partial<Reminder>) => {
        await provider.update('reminders', id, patch)
      }),
      deleteReminder: withRefresh((id: string) => provider.remove('reminders', id)),

      createJob: withRefresh((data: NewRecord<Job>) => insert('jobs', data)),
      updateJob: withRefresh(async (id: string, patch: Partial<Job>) => {
        // Mostra na hora (arrastar no quadro, marcar checklist) e grava em seguida.
        setSnap((s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) }))
        await provider.update('jobs', id, patch)
      }),
      deleteJob: withRefresh(async (id: string) => {
        for (const e of (await entriesNow()).filter((e) => e.jobId === id)) await provider.update('entries', e.id, { jobId: null })
        for (const m of (await provider.list('stock_moves')).filter((m) => m.jobId === id)) await provider.update('stock_moves', m.id, { jobId: null })
        await provider.remove('jobs', id)
      }),

      createStockItem: withRefresh(async (data: NewRecord<StockItem>) => {
        const item = await insert('stock_items', data)
        if (Number(item.qty) !== 0) {
          await insert('stock_moves', {
            spaceId: item.spaceId,
            itemId: item.id,
            delta: Number(item.qty),
            reason: 'ajuste',
            jobId: null,
            date: localISO(),
            note: 'Saldo inicial',
          })
        }
        return item
      }),
      updateStockItem: withRefresh(async (id: string, patch: Partial<StockItem>) => {
        await provider.update('stock_items', id, patch)
      }),
      deleteStockItem: withRefresh(async (id: string) => {
        for (const m of (await provider.list('stock_moves')).filter((m) => m.itemId === id)) await provider.remove('stock_moves', m.id)
        await provider.remove('stock_items', id)
      }),
      moveStock: withRefresh(async ({ itemId, delta, reason, jobId = null, note = '', date = localISO() }) => {
        const item = (await provider.list('stock_items')).find((i) => i.id === itemId)
        if (!item) throw new Error('Item do estoque não encontrado')
        await insert('stock_moves', { spaceId: item.spaceId, itemId, delta, reason, jobId, date, note })
        await provider.update('stock_items', itemId, { qty: Math.round((Number(item.qty) + delta) * 100) / 100 })
      }),
      undoStockMove: withRefresh(async (id: string) => {
        const move = (await provider.list('stock_moves')).find((m) => m.id === id)
        if (!move) return
        const item = (await provider.list('stock_items')).find((i) => i.id === move.itemId)
        if (item) await provider.update('stock_items', item.id, { qty: Math.round((Number(item.qty) - Number(move.delta)) * 100) / 100 })
        await provider.remove('stock_moves', id)
      }),
    }
  }, [snap, loading, error, refresh])

  return <SpacesContext.Provider value={value}>{children}</SpacesContext.Provider>
}

export function useSpaces() {
  const ctx = useContext(SpacesContext)
  if (!ctx) throw new Error('useSpaces deve ser usado dentro de <SpacesProvider>')
  return ctx
}
