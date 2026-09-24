// ============================================================
// ZENN OS — camada de persistência
//
// Toda leitura/escrita passa por um DataProvider. Hoje o padrão é
// localStorage; com VITE_DATA_PROVIDER=supabase (e credenciais
// configuradas) as mesmas funções passam a usar o Supabase, sem
// alterar nenhuma página.
// ============================================================

import type {
  Activity,
  BaseRecord,
  Client,
  CollectionName,
  Collections,
  Lead,
  Payment,
  Project,
  Task,
  Transaction,
} from '@/types'
import { uid } from '@/utils/id'
import { useSupabaseProvider } from '@/lib/env'
import { supabaseProvider } from './supabaseProvider'

export type NewRecord<T extends BaseRecord> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<T, 'id' | 'createdAt' | 'updatedAt'>>

export interface DataProvider {
  readonly name: 'local' | 'supabase'
  list<K extends CollectionName>(collection: K): Promise<Collections[K][]>
  insert<K extends CollectionName>(collection: K, record: Collections[K]): Promise<Collections[K]>
  insertMany<K extends CollectionName>(collection: K, records: Collections[K][]): Promise<void>
  update<K extends CollectionName>(
    collection: K,
    id: string,
    patch: Partial<Collections[K]>,
  ): Promise<Collections[K]>
  remove<K extends CollectionName>(collection: K, id: string): Promise<void>
  clear(collection: CollectionName): Promise<void>
}

// ------------------------------------------------------------
// localStorage
// ------------------------------------------------------------
const STORAGE_PREFIX = 'zenn-os:v1:'
export const storageKey = (collection: CollectionName) => `${STORAGE_PREFIX}${collection}`

function readCollection<K extends CollectionName>(collection: K): Collections[K][] {
  try {
    const raw = localStorage.getItem(storageKey(collection))
    return raw ? (JSON.parse(raw) as Collections[K][]) : []
  } catch {
    return []
  }
}

function writeCollection<K extends CollectionName>(collection: K, rows: Collections[K][]) {
  localStorage.setItem(storageKey(collection), JSON.stringify(rows))
}

export const localProvider: DataProvider = {
  name: 'local',
  async list(collection) {
    return readCollection(collection)
  },
  async insert(collection, record) {
    const rows = readCollection(collection)
    rows.push(record)
    writeCollection(collection, rows)
    return record
  },
  async insertMany(collection, records) {
    writeCollection(collection, [...readCollection(collection), ...records])
  },
  async update(collection, id, patch) {
    const rows = readCollection(collection)
    const index = rows.findIndex((r) => r.id === id)
    if (index === -1) throw new Error(`Registro não encontrado: ${collection}/${id}`)
    const next = { ...rows[index], ...patch, id, updatedAt: new Date().toISOString() }
    rows[index] = next
    writeCollection(collection, rows)
    return next
  },
  async remove(collection, id) {
    writeCollection(
      collection,
      readCollection(collection).filter((r) => r.id !== id),
    )
  },
  async clear(collection) {
    localStorage.removeItem(storageKey(collection))
  },
}

export const provider: DataProvider = useSupabaseProvider ? supabaseProvider : localProvider

// ------------------------------------------------------------
// Helpers genéricos
// ------------------------------------------------------------
function build<T extends BaseRecord>(data: NewRecord<T>, prefix: string): T {
  const now = new Date().toISOString()
  return {
    ...data,
    id: data.id ?? uid(prefix),
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
  } as T
}

const byCreatedDesc = <T extends BaseRecord>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt)

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------
export const getLeads = async () => (await provider.list('leads')).sort(byCreatedDesc)
export const createLead = (data: NewRecord<Lead>) => provider.insert('leads', build<Lead>(data, 'lead'))
export const updateLead = (id: string, patch: Partial<Lead>) => provider.update('leads', id, patch)
export const deleteLead = (id: string) => provider.remove('leads', id)

export const getClients = async () => (await provider.list('clients')).sort(byCreatedDesc)
export const createClient = (data: NewRecord<Client>) =>
  provider.insert('clients', build<Client>(data, 'cli'))
export const updateClient = (id: string, patch: Partial<Client>) =>
  provider.update('clients', id, patch)
export const deleteClient = (id: string) => provider.remove('clients', id)

export const getProjects = async () => (await provider.list('projects')).sort(byCreatedDesc)
export const createProject = (data: NewRecord<Project>) =>
  provider.insert('projects', build<Project>(data, 'prj'))
export const updateProject = (id: string, patch: Partial<Project>) =>
  provider.update('projects', id, patch)
export const deleteProject = (id: string) => provider.remove('projects', id)

export const getTasks = async () => (await provider.list('tasks')).sort(byCreatedDesc)
export const createTask = (data: NewRecord<Task>) => provider.insert('tasks', build<Task>(data, 'tsk'))
export const updateTask = (id: string, patch: Partial<Task>) => provider.update('tasks', id, patch)
export const deleteTask = (id: string) => provider.remove('tasks', id)

export const getTransactions = async () =>
  (await provider.list('transactions')).sort((a, b) => b.date.localeCompare(a.date))
export const createTransaction = (data: NewRecord<Transaction>) =>
  provider.insert('transactions', build<Transaction>(data, 'trx'))
export const updateTransaction = (id: string, patch: Partial<Transaction>) =>
  provider.update('transactions', id, patch)
export const deleteTransaction = (id: string) => provider.remove('transactions', id)

export const getPayments = async () => (await provider.list('payments')).sort(byCreatedDesc)
export const createPayment = (data: NewRecord<Payment>) =>
  provider.insert('payments', build<Payment>(data, 'pay'))

export const getActivities = async () => (await provider.list('activities')).sort(byCreatedDesc)
export const createActivity = (data: NewRecord<Activity>) =>
  provider.insert('activities', build<Activity>(data, 'act'))

export const ALL_COLLECTIONS: CollectionName[] = [
  'leads',
  'clients',
  'projects',
  'tasks',
  'transactions',
  'payments',
  'activities',
]

export async function loadAll() {
  const [leads, clients, projects, tasks, transactions, payments, activities] = await Promise.all([
    getLeads(),
    getClients(),
    getProjects(),
    getTasks(),
    getTransactions(),
    getPayments(),
    getActivities(),
  ])
  return { leads, clients, projects, tasks, transactions, payments, activities }
}

export type Snapshot = Awaited<ReturnType<typeof loadAll>>

export async function clearAll() {
  await Promise.all(ALL_COLLECTIONS.map((c) => provider.clear(c)))
}

/** Remove somente os registros marcados como demo. */
export async function clearDemoData() {
  for (const collection of ALL_COLLECTIONS) {
    const rows = await provider.list(collection)
    for (const row of rows.filter((r) => r.isDemo)) await provider.remove(collection, row.id)
  }
}

export async function importSnapshot(snapshot: Partial<Snapshot>) {
  for (const collection of ALL_COLLECTIONS) {
    const rows = snapshot[collection] as Collections[typeof collection][] | undefined
    if (rows?.length) await provider.insertMany(collection, rows)
  }
}

// Marcador de "já semeado" (apenas para o provider local).
const SEED_FLAG = `${STORAGE_PREFIX}seeded`
export const isSeeded = () => localStorage.getItem(SEED_FLAG) === '1'
export const markSeeded = () => localStorage.setItem(SEED_FLAG, '1')
export const STORAGE_PREFIX_KEY = STORAGE_PREFIX
