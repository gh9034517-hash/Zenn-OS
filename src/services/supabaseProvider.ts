// Implementação do DataProvider sobre o Supabase.
// Ativada com VITE_DATA_PROVIDER=supabase + SUPABASE_URL + SUPABASE_ANON_KEY.
// Schema correspondente: supabase/schema.sql

import type { CollectionName, Collections } from '@/types'
import { getSupabase } from '@/lib/supabase'
import type { DataProvider } from './database'

const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

function mapKeys(obj: Record<string, unknown>, fn: (k: string) => string) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [fn(k), v]))
}

const toRow = (record: object) => mapKeys(record as Record<string, unknown>, toSnake)
const fromRow = <T,>(row: Record<string, unknown>) => mapKeys(row, toCamel) as T

function db() {
  const client = getSupabase()
  if (!client) throw new Error('Supabase não configurado (SUPABASE_URL / SUPABASE_ANON_KEY).')
  return client
}

export const supabaseProvider: DataProvider = {
  name: 'supabase',
  async list<K extends CollectionName>(collection: K) {
    const { data, error } = await db().from(collection).select('*')
    if (error) throw error
    return (data ?? []).map((r) => fromRow<Collections[K]>(r))
  },
  async insert<K extends CollectionName>(collection: K, record: Collections[K]) {
    const { data, error } = await db().from(collection).insert(toRow(record)).select().single()
    if (error) throw error
    return fromRow<Collections[K]>(data)
  },
  async insertMany(collection, records) {
    if (!records.length) return
    const { error } = await db().from(collection).insert(records.map(toRow))
    if (error) throw error
  },
  async update<K extends CollectionName>(collection: K, id: string, patch: Partial<Collections[K]>) {
    const { data, error } = await db()
      .from(collection)
      .update(toRow({ ...patch, updatedAt: new Date().toISOString() }))
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return fromRow<Collections[K]>(data)
  },
  async remove(collection, id) {
    const { error } = await db().from(collection).delete().eq('id', id)
    if (error) throw error
  },
  async clear(collection) {
    const { error } = await db().from(collection).delete().neq('id', '')
    if (error) throw error
  },
}
