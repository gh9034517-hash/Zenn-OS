import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator, Copy, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select, Toggle } from '@/components/ui/Field'
import { Money } from '@/components/space/Money'
import { useSpaces } from '@/context/SpacesContext'
import { useAccess } from '@/context/AccessContext'
import { useToast } from '@/components/ui/Toast'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { parseMoney } from '@/services/spaceMath'
import {
  applyPercent,
  cardFee,
  expensesTotals,
  freightPrice,
  furniturePrice,
  installmentsVsCash,
  percentOf,
  priceForMargin,
  sheetsNeeded,
  variation,
  whatPercent,
  z,
  type Frequency,
} from '@/services/calcMath'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { JobPreset } from '@/components/space/JobForms'

type Tab = 'porcentagem' | 'gastos' | 'movel' | 'frete' | 'chapas' | 'maquininha' | 'parcelado'

const TABS: { id: Tab; label: string }[] = [
  { id: 'porcentagem', label: 'Porcentagem' },
  { id: 'gastos', label: 'Gastos' },
  { id: 'movel', label: 'Orçamento de móvel' },
  { id: 'frete', label: 'Frete' },
  { id: 'chapas', label: 'Quantas chapas' },
  { id: 'maquininha', label: 'Maquininha' },
  { id: 'parcelado', label: 'Parcelado ou à vista' },
]

const n = (s: string) => z(parseMoney(s))
const pct = (v: number, digits = 1) => (Number.isFinite(v) ? `${v.toFixed(digits).replace('.', ',')}%` : '—')
const num = (v: number, digits = 2) => (Number.isFinite(v) ? v.toLocaleString('pt-BR', { maximumFractionDigits: digits }) : '—')

/** Campo numérico com "R$", "%", "km"... e teclado numérico no celular. */
function Num({
  label,
  value,
  onChange,
  prefix,
  suffix,
  placeholder = '0',
  hint,
}: {
  label: ReactNode
  value: string
  onChange: (v: string) => void
  prefix?: string
  suffix?: string
  placeholder?: string
  hint?: ReactNode
}) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-muted">
          <span>{label}</span>
          {hint && <span className="font-normal text-faint">{hint}</span>}
        </span>
      )}
      <span className="relative block">
        {prefix && <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-faint">{prefix}</span>}
        <input
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={typeof label === 'string' && label ? label : placeholder}
          className={cn('field font-mono', prefix && 'pl-10', suffix && 'pr-14')}
        />
        {suffix && <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-faint">{suffix}</span>}
      </span>
    </label>
  )
}

/** Resultado em destaque + linhas de detalhe. */
function Result({ label, main, lines, children }: { label: string; main: ReactNode; lines?: [ReactNode, ReactNode][]; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line-strong bg-gradient-to-br from-[#1a1a1e] to-surface p-5">
      <p className="eyebrow">{label}</p>
      <p className="text-metal mt-2 font-mono text-3xl tracking-tight">{main}</p>
      {lines && (
        <dl className="mt-4 space-y-1.5 text-sm">
          {lines.map(([k, v], i) => (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">{k}</dt>
              <dd className="font-mono text-fg-soft">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </div>
  )
}

function useStored<T>(key: string, initial: T) {
  return useLocalStorage<T>(`zenn-os:calc:${key}`, initial)
}

/** Botões que levam o preço calculado para um serviço do Trabalho. */
function ToJob({ preset, share }: { preset: JobPreset; share: string }) {
  const { spaces } = useSpaces()
  const { canWrite } = useAccess()
  const navigate = useNavigate()
  const toast = useToast()
  const targets = spaces.filter((s) => s.kind === 'empresa' && canWrite(s.id))
  const [target, setTarget] = useState(targets[0]?.id ?? '')
  const ready = (preset.value ?? 0) > 0

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share)
      toast.success('Copiado', 'Cole no WhatsApp do cliente')
    } catch {
      toast.error('Não deu para copiar', 'Use o botão do WhatsApp')
    }
  }

  return (
    <div className="mt-4 space-y-2">
      {targets.length > 1 && (
        <Select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Espaço do serviço">
          {targets.map((s) => (
            <option key={s.id} value={s.id}>
              Serviço em: {s.name}
            </option>
          ))}
        </Select>
      )}
      <div className="flex flex-wrap gap-2">
        {targets.length > 0 && (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="size-3.5" />}
            disabled={!ready}
            onClick={() => navigate(`/e/${target || targets[0].id}/servicos`, { state: { newJob: preset } })}
          >
            Criar serviço com este preço
          </Button>
        )}
        <Button variant="outline" size="sm" icon={<Copy className="size-3.5" />} disabled={!ready} onClick={() => void copy()}>
          Copiar orçamento
        </Button>
        <a
          href={ready ? `https://wa.me/?text=${encodeURIComponent(share)}` : undefined}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-xs font-medium text-fg transition hover:bg-white/[0.04]',
            !ready && 'pointer-events-none opacity-40',
          )}
        >
          <MessageCircle className="size-3.5" /> WhatsApp
        </a>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Porcentagem
// ------------------------------------------------------------
function PercentCalc() {
  const [s, set] = useStored('porcentagem', { a1: '', b1: '', a2: '', b2: '', v3: '', p3: '', f4: '', t4: '', c5: '', m5: '' })
  const u = (k: keyof typeof s) => (v: string) => set((p) => ({ ...p, [k]: v }))
  const ap = applyPercent(n(s.v3), n(s.p3))
  const varPct = variation(n(s.f4), n(s.t4))
  const box = 'rounded-2xl border border-line p-4'
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className={box}>
        <p className="mb-3 text-sm text-fg">Quanto é X% de um valor?</p>
        <div className="grid grid-cols-2 gap-2">
          <Num label="Porcentagem" value={s.a1} onChange={u('a1')} suffix="%" />
          <Num label="do valor" value={s.b1} onChange={u('b1')} prefix="R$" />
        </div>
        <p className="mt-3 text-sm text-muted">
          = <Money value={percentOf(n(s.a1), n(s.b1))} className="text-lg text-fg" />
        </p>
      </div>
      <div className={box}>
        <p className="mb-3 text-sm text-fg">Um valor é quantos % de outro?</p>
        <div className="grid grid-cols-2 gap-2">
          <Num label="Parte" value={s.a2} onChange={u('a2')} prefix="R$" />
          <Num label="do total" value={s.b2} onChange={u('b2')} prefix="R$" />
        </div>
        <p className="mt-3 font-mono text-lg text-fg">= {pct(whatPercent(n(s.a2), n(s.b2)))}</p>
      </div>
      <div className={box}>
        <p className="mb-3 text-sm text-fg">Aumento ou desconto</p>
        <div className="grid grid-cols-2 gap-2">
          <Num label="Valor" value={s.v3} onChange={u('v3')} prefix="R$" />
          <Num label="Porcentagem" value={s.p3} onChange={u('p3')} suffix="%" />
        </div>
        <p className="mt-3 text-sm text-muted">
          com aumento: <Money value={ap.up} className="text-fg" />
        </p>
        <p className="text-sm text-muted">
          com desconto: <Money value={ap.down} className="text-fg" />
        </p>
      </div>
      <div className={box}>
        <p className="mb-3 text-sm text-fg">Quanto subiu ou desceu?</p>
        <div className="grid grid-cols-2 gap-2">
          <Num label="Antes" value={s.f4} onChange={u('f4')} prefix="R$" />
          <Num label="Depois" value={s.t4} onChange={u('t4')} prefix="R$" />
        </div>
        <p className={cn('mt-3 font-mono text-lg', varPct < 0 ? 'text-danger' : 'text-fg')}>
          {Number.isFinite(varPct) ? `${varPct > 0 ? '+' : ''}${pct(varPct)}` : '—'}
        </p>
      </div>
      <div className={cn(box, 'md:col-span-2')}>
        <p className="mb-1 text-sm text-fg">Preço para ter lucro de verdade</p>
        <p className="mb-3 text-xs text-muted">
          Custo + 30% não dá 30% de lucro. Aqui o lucro é sobre o preço de venda (a margem real).
        </p>
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          <Num label="Custo" value={s.c5} onChange={u('c5')} prefix="R$" />
          <Num label="Lucro desejado" value={s.m5} onChange={u('m5')} suffix="%" />
        </div>
        <p className="mt-3 text-sm text-muted">
          venda por <Money value={z(priceForMargin(n(s.c5), n(s.m5)))} className="text-lg text-fg" />
          {n(s.c5) > 0 && n(s.m5) > 0 && (
            <>
              {' '}
              · lucro <Money value={z(priceForMargin(n(s.c5), n(s.m5))) - n(s.c5)} className="text-fg-soft" />
            </>
          )}
        </p>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Gastos
// ------------------------------------------------------------
const FREQ_LABEL: Record<Frequency, string> = { dia: 'por dia', semana: 'por semana', mes: 'por mês', ano: 'por ano' }

function ExpensesCalc() {
  const [s, set] = useStored('gastos', {
    rows: [
      { name: 'Diesel', value: '', freq: 'semana' as Frequency },
      { name: 'Ajudante', value: '', freq: 'dia' as Frequency },
      { name: 'Aluguel da oficina', value: '', freq: 'mes' as Frequency },
    ],
    people: '1',
  })
  const rows = s.rows.map((r) => ({ value: n(r.value), freq: r.freq }))
  const t = expensesTotals(rows, n(s.people))
  const upd = (i: number, patch: Partial<(typeof s.rows)[number]>) => set((p) => ({ ...p, rows: p.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }))
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="space-y-2 lg:col-span-3">
        <p className="text-xs text-muted">Some gastos que acontecem de jeitos diferentes (por dia, semana, mês, ano) e veja quanto dá no mês.</p>
        {s.rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-b border-line pb-2 sm:grid-cols-[1fr_7rem_8rem_auto] sm:border-0 sm:pb-0">
            <Input value={r.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder="Gasto" aria-label="Nome do gasto" className="col-span-3 sm:col-span-1" />
            <Num label="" value={r.value} onChange={(v) => upd(i, { value: v })} prefix="R$" placeholder="valor" />
            <Select value={r.freq} onChange={(e) => upd(i, { freq: e.target.value as Frequency })} aria-label="Frequência">
              {(Object.keys(FREQ_LABEL) as Frequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQ_LABEL[f]}
                </option>
              ))}
            </Select>
            <button
              onClick={() => set((p) => ({ ...p, rows: p.rows.filter((_, j) => j !== i) }))}
              className="grid size-10 place-items-center rounded-xl text-faint hover:bg-white/5 hover:text-fg"
              aria-label="Tirar gasto"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <Button variant="ghost" size="sm" icon={<Plus className="size-3.5" />} onClick={() => set((p) => ({ ...p, rows: [...p.rows, { name: '', value: '', freq: 'mes' }] }))}>
          Mais um gasto
        </Button>
        <div className="max-w-[12rem] pt-2">
          <Num label="Dividir entre" value={s.people} onChange={(v) => set((p) => ({ ...p, people: v }))} suffix="pessoas" placeholder="1" />
        </div>
      </div>
      <div className="lg:col-span-2">
        <Result
          label="Total por mês"
          main={<Money value={t.month} />}
          lines={[
            ['Por ano', <Money key="a" value={t.year} />],
            ['Por dia', <Money key="d" value={t.day} />],
            ...(n(s.people) > 1 ? ([[`Por pessoa (mês)`, <Money key="p" value={t.perPerson} />]] as [ReactNode, ReactNode][]) : []),
          ]}
        />
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Orçamento de móvel
// ------------------------------------------------------------
function FurnitureCalc() {
  const [s, set] = useStored('movel', {
    title: '',
    materials: [
      { name: 'Chapa MDF 15mm', qty: '', unit: '' },
      { name: 'Chapa MDF 6mm (fundo)', qty: '', unit: '' },
      { name: 'Fita de borda (metros)', qty: '', unit: '' },
      { name: 'Ferragens (dobradiças, corrediças, puxadores)', qty: '1', unit: '' },
    ],
    hours: '',
    rate: '',
    extras: '',
    overhead: '10',
    tax: '0',
    margin: '30',
  })
  const r = furniturePrice({
    materials: s.materials.map((m) => ({ qty: n(m.qty), unit: n(m.unit) })),
    laborHours: n(s.hours),
    hourRate: n(s.rate),
    extras: n(s.extras),
    overheadPct: n(s.overhead),
    taxPct: n(s.tax),
    marginPct: n(s.margin),
  })
  const upd = (i: number, patch: Partial<(typeof s.materials)[number]>) =>
    set((p) => ({ ...p, materials: p.materials.map((m, j) => (j === i ? { ...m, ...patch } : m)) }))
  const u = (k: 'hours' | 'rate' | 'extras' | 'overhead' | 'tax' | 'margin') => (v: string) => set((p) => ({ ...p, [k]: v }))
  const name = s.title.trim() || 'Móvel sob medida'
  const share = `Orçamento: ${name}\nValor: ${formatCurrency(z(r.price))}\nSinal de 50% para começar: ${formatCurrency(z(r.deposit))}\nRestante na entrega.`

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Qual é o móvel</span>
          <Input value={s.title} onChange={(e) => set((p) => ({ ...p, title: e.target.value }))} placeholder="Ex.: Guarda-roupa 3 portas" />
        </label>
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Material</p>
          <div className="space-y-2">
            {s.materials.map((m, i) => (
              <div key={i} className="grid grid-cols-[5rem_1fr_auto] items-center gap-2 border-b border-line pb-2 sm:grid-cols-[1fr_5rem_7rem_auto] sm:border-0 sm:pb-0">
                <Input value={m.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder="Material" aria-label="Material" className="col-span-3 sm:col-span-1" />
                <Num label="" value={m.qty} onChange={(v) => upd(i, { qty: v })} placeholder="qtd" />
                <Num label="" value={m.unit} onChange={(v) => upd(i, { unit: v })} prefix="R$" placeholder="cada" />
                <button
                  onClick={() => set((p) => ({ ...p, materials: p.materials.filter((_, j) => j !== i) }))}
                  className="grid size-10 place-items-center rounded-xl text-faint hover:bg-white/5 hover:text-fg"
                  aria-label="Tirar material"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1"
            icon={<Plus className="size-3.5" />}
            onClick={() => set((p) => ({ ...p, materials: [...p.materials, { name: '', qty: '1', unit: '' }] }))}
          >
            Mais um material
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Num label="Horas de trabalho" value={s.hours} onChange={u('hours')} suffix="h" />
          <Num label="Valor da sua hora" value={s.rate} onChange={u('rate')} prefix="R$" />
          <Num label="Entrega / instalação" value={s.extras} onChange={u('extras')} prefix="R$" />
          <Num label="Custos da oficina" value={s.overhead} onChange={u('overhead')} suffix="%" />
          <Num label="Imposto / taxa" value={s.tax} onChange={u('tax')} suffix="%" />
          <Num label="Lucro desejado" value={s.margin} onChange={u('margin')} suffix="%" />
        </div>
      </div>
      <div className="lg:col-span-2">
        <Result
          label="Preço sugerido"
          main={<Money value={z(r.price)} />}
          lines={[
            ['Material', <Money key="m" value={r.material} />],
            ['Mão de obra', <Money key="l" value={r.labor} />],
            ['Entrega / instalação', <Money key="e" value={r.extras} />],
            ['Custos da oficina', <Money key="o" value={r.overhead} />],
            ['Custo total', <Money key="c" value={r.cost} />],
            ...(r.tax > 0 ? ([['Imposto', <Money key="t" value={z(r.tax)} />]] as [ReactNode, ReactNode][]) : []),
            ['Seu lucro', <Money key="p" value={z(r.profit)} />],
            ['Sinal de 50%', <Money key="s" value={z(r.deposit)} />],
          ]}
        >
          <ToJob preset={{ kind: 'movel', title: name, value: z(r.price), costEstimate: r.material + r.extras }} share={share} />
        </Result>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Frete
// ------------------------------------------------------------
function FreightCalc() {
  const [s, set] = useStored('frete', {
    km: '',
    roundTrip: true,
    kmPerLiter: '',
    fuel: '',
    tolls: '',
    helper: '',
    wear: '0,40',
    hours: '',
    rate: '',
    margin: '25',
    sheets: '',
  })
  const r = freightPrice({
    km: n(s.km),
    roundTrip: s.roundTrip,
    kmPerLiter: n(s.kmPerLiter),
    fuelPrice: n(s.fuel),
    tolls: n(s.tolls),
    helper: n(s.helper),
    wearPerKm: n(s.wear),
    hours: n(s.hours),
    hourRate: n(s.rate),
    marginPct: n(s.margin),
    sheets: n(s.sheets),
  })
  const u = (k: Exclude<keyof typeof s, 'roundTrip'>) => (v: string) => set((p) => ({ ...p, [k]: v }))
  const title = n(s.sheets) > 0 ? `Frete de ${num(n(s.sheets), 0)} chapas — ${num(r.km, 0)} km` : `Frete — ${num(r.km, 0)} km`
  const share = `Frete${n(s.sheets) > 0 ? ` de ${num(n(s.sheets), 0)} chapas` : ''}: ${formatCurrency(z(r.price))}`

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <div className="grid grid-cols-2 gap-3">
          <Num label="Distância até o destino" value={s.km} onChange={u('km')} suffix="km" />
          <Num label="Quantas chapas" value={s.sheets} onChange={u('sheets')} suffix="un" hint="opcional" />
        </div>
        <Toggle
          checked={s.roundTrip}
          onChange={(v) => set((p) => ({ ...p, roundTrip: v }))}
          label="Contar a volta"
          description={`Total rodado: ${num(r.km, 0)} km`}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Num label="Consumo do veículo" value={s.kmPerLiter} onChange={u('kmPerLiter')} suffix="km/l" placeholder="Ex.: 8" />
          <Num label="Preço do diesel" value={s.fuel} onChange={u('fuel')} prefix="R$" suffix="/l" />
          <Num label="Pedágios" value={s.tolls} onChange={u('tolls')} prefix="R$" />
          <Num label="Ajudante" value={s.helper} onChange={u('helper')} prefix="R$" />
          <Num label="Desgaste por km" value={s.wear} onChange={u('wear')} prefix="R$" suffix="/km" />
          <Num label="Horas gastas" value={s.hours} onChange={u('hours')} suffix="h" />
          <Num label="Valor da sua hora" value={s.rate} onChange={u('rate')} prefix="R$" />
          <Num label="Lucro desejado" value={s.margin} onChange={u('margin')} suffix="%" />
        </div>
      </div>
      <div className="lg:col-span-2">
        <Result
          label="Cobrar pelo frete"
          main={<Money value={z(r.price)} />}
          lines={[
            [`Diesel (${num(r.liters, 1)} litros)`, <Money key="f" value={r.fuel} />],
            ['Desgaste do veículo', <Money key="w" value={r.wear} />],
            ['Pedágio + ajudante', <Money key="t" value={n(s.tolls) + n(s.helper)} />],
            ['Seu tempo', <Money key="h" value={r.time} />],
            ['Custo total', <Money key="c" value={r.cost} />],
            ['Seu lucro', <Money key="p" value={z(r.profit)} />],
            ['Por km rodado', Number.isFinite(r.perKm) ? <Money key="k" value={r.perKm} /> : '—'],
            ...(Number.isFinite(r.perSheet) ? ([['Por chapa', <Money key="s" value={r.perSheet} />]] as [ReactNode, ReactNode][]) : []),
          ]}
        >
          <ToJob preset={{ kind: 'frete', title, value: z(r.price), costEstimate: r.fuel + n(s.tolls) + n(s.helper) }} share={share} />
        </Result>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Quantas chapas
// ------------------------------------------------------------
const SHEETS: { id: string; label: string; w: number; h: number }[] = [
  { id: 'mdf2750', label: 'MDF 2,75 × 1,84 m', w: 2750, h: 1840 },
  { id: 'mdf2750b', label: 'MDF 2,75 × 1,85 m', w: 2750, h: 1850 },
  { id: 'comp', label: 'Compensado 2,20 × 1,60 m', w: 2200, h: 1600 },
  { id: 'osb', label: 'OSB / compensado 2,44 × 1,22 m', w: 2440, h: 1220 },
  { id: 'outra', label: 'Outra medida', w: 0, h: 0 },
]

function SheetsCalc() {
  const [s, set] = useStored('chapas', {
    preset: 'mdf2750',
    w: '2750',
    h: '1840',
    waste: '15',
    price: '',
    pieces: [
      { name: 'Lateral', w: '', h: '', qty: '2' },
      { name: 'Prateleira', w: '', h: '', qty: '' },
    ],
  })
  const preset = SHEETS.find((p) => p.id === s.preset) ?? SHEETS[0]
  const sw = preset.id === 'outra' ? n(s.w) : preset.w
  const sh = preset.id === 'outra' ? n(s.h) : preset.h
  const r = sheetsNeeded(
    sw,
    sh,
    s.pieces.map((p) => ({ w: n(p.w), h: n(p.h), qty: n(p.qty) })),
    n(s.waste),
    n(s.price),
  )
  const upd = (i: number, patch: Partial<(typeof s.pieces)[number]>) => set((p) => ({ ...p, pieces: p.pieces.map((x, j) => (j === i ? { ...x, ...patch } : x)) }))

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Chapa</span>
            <Select value={s.preset} onChange={(e) => set((p) => ({ ...p, preset: e.target.value }))}>
              {SHEETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </label>
          <Num label="Preço da chapa" value={s.price} onChange={(v) => set((p) => ({ ...p, price: v }))} prefix="R$" hint="opcional" />
          {preset.id === 'outra' && (
            <>
              <Num label="Comprimento" value={s.w} onChange={(v) => set((p) => ({ ...p, w: v }))} suffix="mm" />
              <Num label="Largura" value={s.h} onChange={(v) => set((p) => ({ ...p, h: v }))} suffix="mm" />
            </>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Peças (em milímetros)</p>
          <div className="space-y-2">
            {s.pieces.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_4rem_auto] items-center gap-2 border-b border-line pb-2 sm:grid-cols-[1fr_5rem_5rem_4rem_auto] sm:border-0 sm:pb-0">
                <Input value={p.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder="Peça" aria-label="Peça" className="col-span-4 sm:col-span-1" />
                <Num label="" value={p.w} onChange={(v) => upd(i, { w: v })} placeholder="compr." />
                <Num label="" value={p.h} onChange={(v) => upd(i, { h: v })} placeholder="larg." />
                <Num label="" value={p.qty} onChange={(v) => upd(i, { qty: v })} placeholder="qtd" />
                <button
                  onClick={() => set((x) => ({ ...x, pieces: x.pieces.filter((_, j) => j !== i) }))}
                  className="grid size-10 place-items-center rounded-xl text-faint hover:bg-white/5 hover:text-fg"
                  aria-label="Tirar peça"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1"
            icon={<Plus className="size-3.5" />}
            onClick={() => set((x) => ({ ...x, pieces: [...x.pieces, { name: '', w: '', h: '', qty: '1' }] }))}
          >
            Mais uma peça
          </Button>
        </div>
        <div className="max-w-[12rem]">
          <Num label="Perda no corte" value={s.waste} onChange={(v) => set((p) => ({ ...p, waste: v }))} suffix="%" hint="serra, sobras" />
        </div>
      </div>
      <div className="lg:col-span-2">
        <Result
          label="Chapas necessárias"
          main={r.sheets ? `${r.sheets} ${r.sheets === 1 ? 'chapa' : 'chapas'}` : '—'}
          lines={[
            ['Área das peças', `${num(r.area, 2)} m²`],
            ['Área de uma chapa', `${num(r.sheetArea, 2)} m²`],
            ['Aproveitamento', r.sheets ? pct(r.usage * 100, 0) : '—'],
            ['Fita de borda (contorno)', `${r.edgeMeters} m`],
            ...(n(s.price) > 0 ? ([['Custo das chapas', <Money key="c" value={r.cost} />]] as [ReactNode, ReactNode][]) : []),
          ]}
        >
          {r.tooBig > 0 && (
            <p className="mt-3 text-xs text-danger">
              {r.tooBig === 1 ? '1 peça é maior' : `${r.tooBig} peças são maiores`} que a chapa — vai precisar de emenda.
            </p>
          )}
          <p className="mt-3 text-[11px] text-faint">Conta pela área, com a perda. O plano de corte real pode pedir uma chapa a mais.</p>
        </Result>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Maquininha
// ------------------------------------------------------------
const FEES = [
  { label: 'Débito', value: '1,99' },
  { label: 'Crédito', value: '3,49' },
  { label: 'Pix', value: '0' },
  { label: 'Parcelado 6x', value: '8,9' },
  { label: 'Parcelado 12x', value: '14,9' },
]

function CardFeeCalc() {
  const [s, set] = useStored('maquininha', { value: '', fee: '3,49' })
  const r = cardFee(n(s.value), n(s.fee))
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <div className="grid grid-cols-2 gap-3">
          <Num label="Valor da venda" value={s.value} onChange={(v) => set((p) => ({ ...p, value: v }))} prefix="R$" />
          <Num label="Taxa da maquininha" value={s.fee} onChange={(v) => set((p) => ({ ...p, fee: v }))} suffix="%" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FEES.map((f) => (
            <button key={f.label} onClick={() => set((p) => ({ ...p, fee: f.value }))} className={cn('chip', s.fee === f.value && 'chip-on')}>
              {f.label} · {f.value}%
            </button>
          ))}
        </div>
        <p className="text-xs text-faint">As taxas mudam de máquina para máquina: confira a sua no aplicativo dela.</p>
      </div>
      <div className="lg:col-span-2">
        <Result
          label="Cai na sua conta"
          main={<Money value={r.youGet} />}
          lines={[
            ['A maquininha fica com', <Money key="f" value={r.fee} />],
            ['Para receber o valor cheio, cobre', <Money key="c" value={z(r.chargeToGet)} />],
          ]}
        />
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Parcelado ou à vista
// ------------------------------------------------------------
function InstallmentsCalc() {
  const [s, set] = useStored('parcelado', { cash: '', n: '10', pmt: '' })
  const r = installmentsVsCash(n(s.cash), n(s.n), n(s.pmt))
  const cheaper = r.extra > 0
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <p className="text-xs text-muted">Compare o preço à vista com o parcelado e veja quanto de juros está escondido nas parcelas.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Num label="Preço à vista" value={s.cash} onChange={(v) => set((p) => ({ ...p, cash: v }))} prefix="R$" />
          <Num label="Parcelas" value={s.n} onChange={(v) => set((p) => ({ ...p, n: v }))} suffix="x" />
          <Num label="Valor de cada parcela" value={s.pmt} onChange={(v) => set((p) => ({ ...p, pmt: v }))} prefix="R$" />
        </div>
      </div>
      <div className="lg:col-span-2">
        <Result
          label="Total parcelado"
          main={<Money value={r.total} />}
          lines={[
            ['A mais que à vista', <Money key="e" value={r.extra} />],
            ['Isso é', pct(r.extraPct)],
            ['Juros por mês', Number.isFinite(r.monthly) ? pct(r.monthly, 2) : '—'],
          ]}
        >
          {n(s.cash) > 0 && n(s.pmt) > 0 && (
            <p className="mt-3 text-xs text-muted">{cheaper ? 'À vista sai mais barato.' : 'Parcelado sem juros: vale parcelar e deixar o dinheiro rendendo.'}</p>
          )}
        </Result>
      </div>
    </div>
  )
}

export default function Calculators() {
  const [tab, setTab] = useLocalStorage<Tab>('zenn-os:calc:tab', 'porcentagem')
  const current = TABS.find((t) => t.id === tab) ?? TABS[0]
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Calculator className="size-3.5" /> Ferramentas
          </>
        }
        title="Calculadoras"
        description="Porcentagem, gastos, preço de móvel e de frete, chapas, maquininha e parcelamento. O que você digita fica guardado neste aparelho."
      />
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn('chip', tab === t.id && 'chip-on')}>
            {t.label}
          </button>
        ))}
      </div>
      <Card>
        <CardHeader title={current.label} />
        <CardBody>
          {tab === 'porcentagem' && <PercentCalc />}
          {tab === 'gastos' && <ExpensesCalc />}
          {tab === 'movel' && <FurnitureCalc />}
          {tab === 'frete' && <FreightCalc />}
          {tab === 'chapas' && <SheetsCalc />}
          {tab === 'maquininha' && <CardFeeCalc />}
          {tab === 'parcelado' && <InstallmentsCalc />}
        </CardBody>
      </Card>
    </>
  )
}
