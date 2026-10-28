import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Plus, Trash2, Truck } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { getSupabase } from '@/lib/supabase'
import { useSupabaseProvider } from '@/lib/env'
import { uid } from '@/utils/id'
import { parseMoney } from '@/services/spaceMath'
import { formatCurrency, formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'

// ---------- acesso aos dados (Supabase ou navegador) ----------
interface FreteTabela {
  id: string
  titulo: string
  createdAt: string
}

interface FreteLinha {
  id: string
  tabelaId: string
  ordem: number
  dataEntrega: string | null
  notasFiscais: string | null
  lojaSetor: string | null
  tipoVeiculo: string | null
  placa: string | null
  pesoKg: number | null
  regiao: string | null
  raio: string | null
  valor: number | null
  observacao: string | null
}

type FreteCampo = Exclude<keyof FreteLinha, 'id' | 'tabelaId' | 'ordem'>

const LINHAS_INICIAIS = 20

interface FretesStore {
  listTabelas(): Promise<FreteTabela[]>
  createTabela(titulo: string): Promise<FreteTabela>
  renameTabela(id: string, titulo: string): Promise<void>
  deleteTabela(id: string): Promise<void>
  listLinhas(tabelaId: string): Promise<FreteLinha[]>
  addLinha(tabelaId: string, ordem: number): Promise<FreteLinha>
  updateLinha(id: string, patch: Partial<Pick<FreteLinha, FreteCampo>>): Promise<void>
  deleteLinha(id: string): Promise<void>
}

const COLUNAS_DB: Record<FreteCampo, string> = {
  dataEntrega: 'data_entrega',
  notasFiscais: 'notas_fiscais',
  lojaSetor: 'loja_setor',
  tipoVeiculo: 'tipo_veiculo',
  placa: 'placa',
  pesoKg: 'peso_kg',
  regiao: 'regiao',
  raio: 'raio',
  valor: 'valor',
  observacao: 'observacao',
}

const num = (v: unknown) => (v == null ? null : Number(v))

function linhaFromRow(r: Record<string, unknown>): FreteLinha {
  return {
    id: r.id as string,
    tabelaId: r.tabela_id as string,
    ordem: Number(r.ordem ?? 0),
    dataEntrega: (r.data_entrega as string | null) ?? null,
    notasFiscais: (r.notas_fiscais as string | null) ?? null,
    lojaSetor: (r.loja_setor as string | null) ?? null,
    tipoVeiculo: (r.tipo_veiculo as string | null) ?? null,
    placa: (r.placa as string | null) ?? null,
    pesoKg: num(r.peso_kg),
    regiao: (r.regiao as string | null) ?? null,
    raio: (r.raio as string | null) ?? null,
    valor: num(r.valor),
    observacao: (r.observacao as string | null) ?? null,
  }
}

const linhaVazia = (tabelaId: string, ordem: number): FreteLinha => ({
  id: uid('fl'),
  tabelaId,
  ordem,
  dataEntrega: null,
  notasFiscais: null,
  lojaSetor: null,
  tipoVeiculo: null,
  placa: null,
  pesoKg: null,
  regiao: null,
  raio: null,
  valor: null,
  observacao: null,
})

function db() {
  const client = getSupabase()
  if (!client) throw new Error('Supabase não configurado.')
  return client
}

const supabaseStore: FretesStore = {
  async listTabelas() {
    const { data, error } = await db().from('frete_tabelas').select('*').order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map((r) => ({ id: r.id, titulo: r.titulo, createdAt: r.created_at }))
  },
  async createTabela(titulo) {
    const { data, error } = await db().from('frete_tabelas').insert({ titulo }).select().single()
    if (error) throw error
    const vazias = Array.from({ length: LINHAS_INICIAIS }, (_, ordem) => ({ tabela_id: data.id, ordem }))
    const res = await db().from('frete_linhas').insert(vazias)
    if (res.error) throw res.error
    return { id: data.id, titulo: data.titulo, createdAt: data.created_at }
  },
  async renameTabela(id, titulo) {
    const { error } = await db().from('frete_tabelas').update({ titulo }).eq('id', id)
    if (error) throw error
  },
  async deleteTabela(id) {
    const { error } = await db().from('frete_tabelas').delete().eq('id', id)
    if (error) throw error
  },
  async listLinhas(tabelaId) {
    const { data, error } = await db().from('frete_linhas').select('*').eq('tabela_id', tabelaId).order('ordem', { ascending: true })
    if (error) throw error
    return (data ?? []).map(linhaFromRow)
  },
  async addLinha(tabelaId, ordem) {
    const { data, error } = await db().from('frete_linhas').insert({ tabela_id: tabelaId, ordem }).select().single()
    if (error) throw error
    return linhaFromRow(data)
  },
  async updateLinha(id, patch) {
    const row = Object.fromEntries(Object.entries(patch).map(([k, v]) => [COLUNAS_DB[k as FreteCampo], v]))
    const { error } = await db().from('frete_linhas').update(row).eq('id', id)
    if (error) throw error
  },
  async deleteLinha(id) {
    const { error } = await db().from('frete_linhas').delete().eq('id', id)
    if (error) throw error
  },
}

// ---- modo demo (navegador) ----
const K_TAB = 'zenn-os:fretes:tabelas'
const K_LIN = 'zenn-os:fretes:linhas'
const read = <T,>(key: string): T[] => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}
const write = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value))

const localStore: FretesStore = {
  async listTabelas() {
    return read<FreteTabela>(K_TAB)
  },
  async createTabela(titulo) {
    const t: FreteTabela = { id: uid('ft'), titulo, createdAt: new Date().toISOString() }
    write(K_TAB, [...read<FreteTabela>(K_TAB), t])
    write(K_LIN, [...read<FreteLinha>(K_LIN), ...Array.from({ length: LINHAS_INICIAIS }, (_, i) => linhaVazia(t.id, i))])
    return t
  },
  async renameTabela(id, titulo) {
    write(K_TAB, read<FreteTabela>(K_TAB).map((t) => (t.id === id ? { ...t, titulo } : t)))
  },
  async deleteTabela(id) {
    write(K_TAB, read<FreteTabela>(K_TAB).filter((t) => t.id !== id))
    write(K_LIN, read<FreteLinha>(K_LIN).filter((l) => l.tabelaId !== id))
  },
  async listLinhas(tabelaId) {
    return read<FreteLinha>(K_LIN)
      .filter((l) => l.tabelaId === tabelaId)
      .sort((a, b) => a.ordem - b.ordem)
  },
  async addLinha(tabelaId, ordem) {
    const l = linhaVazia(tabelaId, ordem)
    write(K_LIN, [...read<FreteLinha>(K_LIN), l])
    return l
  },
  async updateLinha(id, patch) {
    write(K_LIN, read<FreteLinha>(K_LIN).map((l) => (l.id === id ? { ...l, ...patch } : l)))
  },
  async deleteLinha(id) {
    write(K_LIN, read<FreteLinha>(K_LIN).filter((l) => l.id !== id))
  },
}

const store: FretesStore = useSupabaseProvider ? supabaseStore : localStore

// ---------- tela ----------
type Tipo = 'date' | 'text' | 'num'

const COLUNAS: { key: FreteCampo; label: string; tipo: Tipo; w: string }[] = [
  { key: 'dataEntrega', label: 'Data de entrega', tipo: 'date', w: 'min-w-[9.5rem]' },
  { key: 'notasFiscais', label: 'Notas Fiscais', tipo: 'text', w: 'min-w-[11rem]' },
  { key: 'lojaSetor', label: 'Loja/Setor', tipo: 'text', w: 'min-w-[10rem]' },
  { key: 'tipoVeiculo', label: 'Tipo de Veículo', tipo: 'text', w: 'min-w-[10rem]' },
  { key: 'placa', label: 'Placa', tipo: 'text', w: 'min-w-[8rem]' },
  { key: 'pesoKg', label: 'Peso KG', tipo: 'num', w: 'min-w-[7rem]' },
  { key: 'regiao', label: 'Região', tipo: 'text', w: 'min-w-[9rem]' },
  { key: 'raio', label: 'Raio', tipo: 'text', w: 'min-w-[7rem]' },
  { key: 'valor', label: 'Valor (R$)', tipo: 'num', w: 'min-w-[8rem]' },
  { key: 'observacao', label: 'Observação', tipo: 'text', w: 'min-w-[16rem]' },
]

function paraBanco(tipo: Tipo, v: string): string | number | null {
  const t = v.trim()
  if (!t) return null
  if (tipo === 'num') {
    const n = parseMoney(t)
    return Number.isFinite(n) ? n : null
  }
  return t
}

function Celula({
  valor,
  tipo,
  label,
  onSalvar,
}: {
  valor: string
  tipo: Tipo
  label: string
  onSalvar: (v: string) => void
}) {
  const [v, setV] = useState(valor)
  useEffect(() => setV(valor), [valor])
  return (
    <input
      aria-label={label}
      type={tipo === 'date' ? 'date' : 'text'}
      inputMode={tipo === 'num' ? 'decimal' : undefined}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== valor && onSalvar(v)}
      className="h-11 w-full bg-transparent px-3 text-sm text-fg outline-none transition-colors focus:bg-white/[0.06] focus:ring-1 focus:ring-inset focus:ring-white/40"
    />
  )
}

export default function Fretes() {
  const toast = useToast()
  const [tabelas, setTabelas] = useState<FreteTabela[]>([])
  const [ativaId, setAtivaId] = useState<string | null>(null)
  const [linhas, setLinhas] = useState<FreteLinha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [pendentes, setPendentes] = useState(0)
  const [criando, setCriando] = useState(false)
  const [excluir, setExcluir] = useState(false)

  const salvar = useCallback(
    async (fn: () => Promise<unknown>) => {
      setPendentes((n) => n + 1)
      try {
        await fn()
        return true
      } catch (e) {
        toast.error('Não foi possível salvar', e instanceof Error ? e.message : undefined)
        return false
      } finally {
        setPendentes((n) => n - 1)
      }
    },
    [toast],
  )

  useEffect(() => {
    store
      .listTabelas()
      .then((lista) => {
        setTabelas(lista)
        setAtivaId(lista[0]?.id ?? null)
      })
      .catch((e) => toast.error('Erro ao carregar os fretes', e instanceof Error ? e.message : undefined))
      .finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ativaId) {
      setLinhas([])
      return
    }
    let vivo = true
    store
      .listLinhas(ativaId)
      .then((l) => vivo && setLinhas(l))
      .catch((e) => toast.error('Erro ao carregar a tabela', e instanceof Error ? e.message : undefined))
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativaId])

  const atual = tabelas.find((t) => t.id === ativaId) ?? null

  async function novaTabela() {
    setCriando(true)
    try {
      const t = await store.createTabela('FRETE NFS')
      setTabelas((l) => [...l, t])
      setAtivaId(t.id)
    } catch (e) {
      toast.error('Não foi possível criar a tabela', e instanceof Error ? e.message : undefined)
    } finally {
      setCriando(false)
    }
  }

  async function renomear(titulo: string) {
    if (!atual) return
    const t = titulo.trim() || 'FRETE NFS'
    setTabelas((l) => l.map((x) => (x.id === atual.id ? { ...x, titulo: t } : x)))
    await salvar(() => store.renameTabela(atual.id, t))
  }

  async function excluirTabela() {
    if (!atual) return
    const id = atual.id
    await store.deleteTabela(id)
    const resto = tabelas.filter((t) => t.id !== id)
    setTabelas(resto)
    setAtivaId(resto[0]?.id ?? null)
  }

  async function salvarCelula(l: FreteLinha, key: FreteCampo, tipo: Tipo, v: string) {
    const novo = paraBanco(tipo, v)
    setLinhas((ls) => ls.map((x) => (x.id === l.id ? { ...x, [key]: novo } : x)))
    await salvar(() => store.updateLinha(l.id, { [key]: novo }))
  }

  async function addLinha() {
    if (!ativaId) return
    const ordem = (linhas[linhas.length - 1]?.ordem ?? -1) + 1
    await salvar(async () => {
      const nova = await store.addLinha(ativaId, ordem)
      setLinhas((ls) => [...ls, nova])
    })
  }

  async function removerLinha(id: string) {
    setLinhas((ls) => ls.filter((x) => x.id !== id))
    await salvar(() => store.deleteLinha(id))
  }

  const totais = useMemo(
    () => ({
      peso: linhas.reduce((s, l) => s + (l.pesoKg ?? 0), 0),
      valor: linhas.reduce((s, l) => s + (l.valor ?? 0), 0),
    }),
    [linhas],
  )

  const status = (
    <span className="flex items-center gap-1.5 text-xs text-muted" role="status" aria-live="polite">
      {pendentes > 0 ? (
        <>
          <Loader2 className="size-3.5 animate-spin" /> Salvando…
        </>
      ) : (
        <>
          <Check className="size-3.5" /> Salvo
        </>
      )}
    </span>
  )

  return (
    <div>
      <PageHeader
        eyebrow="Ferramentas"
        title="Fretes de chapa"
        description="Planilha de Frete NFS. Preencha direto na tabela: tudo é salvo sozinho. Precisa de outra? Crie uma nova igual."
        actions={
          <>
            {status}
            <Button variant="primary" icon={<Plus className="size-4" />} loading={criando} onClick={novaTabela}>
              Nova tabela
            </Button>
          </>
        }
      />

      {carregando ? (
        <div className="skeleton h-64 w-full" />
      ) : !atual ? (
        <Card>
          <EmptyState
            title="Nenhuma tabela de frete ainda"
            description="Crie a primeira tabela para começar a registrar os fretes de chapa."
            action={
              <Button variant="primary" icon={<Plus className="size-4" />} loading={criando} onClick={novaTabela}>
                Criar primeira tabela
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <nav className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Tabelas de frete">
            {tabelas.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setAtivaId(t.id)}
                aria-current={t.id === ativaId ? 'true' : undefined}
                className={cn('chip h-11 px-4 text-sm', t.id === ativaId && 'chip-on')}
              >
                <Truck className="size-3.5" /> {t.titulo} · {i + 1}
              </button>
            ))}
          </nav>

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line p-2">
              <input
                key={atual.id}
                aria-label="Título da tabela"
                defaultValue={atual.titulo}
                onBlur={(e) => e.target.value !== atual.titulo && renomear(e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-lg bg-transparent px-3 text-base font-semibold tracking-wide text-fg outline-none focus:bg-white/[0.06] focus:ring-1 focus:ring-white/40"
              />
              <Button variant="danger" size="icon" aria-label="Excluir tabela" className="size-11" onClick={() => setExcluir(true)}>
                <Trash2 className="size-4" />
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-left">
                <thead>
                  <tr className="bg-white/[0.04] text-[11px] tracking-wider text-muted uppercase">
                    {COLUNAS.map((c) => (
                      <th key={c.key} scope="col" className={cn('border border-line px-3 py-3 font-medium', c.w)}>
                        {c.label}
                      </th>
                    ))}
                    <th scope="col" className="w-12 border border-line">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.id} className="transition-colors hover:bg-white/[0.025]">
                      {COLUNAS.map((c) => (
                        <td key={c.key} className="border border-line p-0">
                          <Celula
                            label={c.label}
                            tipo={c.tipo}
                            valor={l[c.key] == null ? '' : String(l[c.key]).replace(/^(\d+)\.(\d+)$/, c.tipo === 'num' ? '$1,$2' : '$1.$2')}
                            onSalvar={(v) => salvarCelula(l, c.key, c.tipo, v)}
                          />
                        </td>
                      ))}
                      <td className="border border-line p-0 text-center">
                        <button
                          type="button"
                          onClick={() => removerLinha(l.id)}
                          aria-label="Remover linha"
                          className="size-11 text-faint transition-colors hover:text-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                        >
                          <Trash2 className="mx-auto size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-white/[0.04] text-sm font-medium">
                    <td colSpan={5} className="border border-line px-3 py-3 text-right text-muted">
                      Totais
                    </td>
                    <td className="border border-line px-3 py-3">{formatNumber(totais.peso)} kg</td>
                    <td colSpan={2} className="border border-line" />
                    <td className="border border-line px-3 py-3">{formatCurrency(totais.valor)}</td>
                    <td colSpan={2} className="border border-line" />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="border-t border-line p-2">
              <Button variant="ghost" icon={<Plus className="size-4" />} className="h-11" onClick={addLinha}>
                Adicionar linha
              </Button>
            </div>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={excluir}
        onClose={() => setExcluir(false)}
        onConfirm={excluirTabela}
        title="Excluir esta tabela?"
        description={`"${atual?.titulo ?? ''}" e todas as linhas dela serão apagadas. Isso não pode ser desfeito.`}
        confirmLabel="Excluir"
        danger
      />
    </div>
  )
}
