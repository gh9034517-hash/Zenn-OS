// Semeia o banco Supabase com os dados DEMO, autenticando como usuário real.
// Uso: SUPABASE_URL=... SUPABASE_ANON_KEY=... SEED_EMAIL=... SEED_PASSWORD=... npx vite-node scripts/seed.mts
import { createClient } from '@supabase/supabase-js'
import { generateDemoData } from '../src/data/demo'
import type { Snapshot } from '../src/services/database'

const url = process.env.SUPABASE_URL!
const anon = process.env.SUPABASE_ANON_KEY!
const email = process.env.SEED_EMAIL!
const password = process.env.SEED_PASSWORD!

const sb = createClient(url, anon, { auth: { persistSession: false } })
const { error: authErr } = await sb.auth.signInWithPassword({ email, password })
if (authErr) {
  console.error('AUTH FAIL:', authErr.message)
  process.exit(1)
}
console.log('AUTH OK as', email)

const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const map = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [toSnake(k), v]))

const snap = generateDemoData()
const order: (keyof Snapshot)[] = ['leads', 'clients', 'projects', 'tasks', 'transactions', 'payments', 'activities']

for (const table of order) {
  const rows = (snap[table] as Record<string, unknown>[]).map(map)
  let ok = 0
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const { error } = await sb.from(table).upsert(chunk)
    if (error) console.error(`  ${table} chunk ${i}: ${error.message}`)
    else ok += chunk.length
  }
  console.log(`${table}: ${ok}/${rows.length}`)
}
console.log('SEED DONE')
