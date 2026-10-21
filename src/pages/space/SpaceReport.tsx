import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { Money } from '@/components/space/Money'
import { MonthPicker } from '@/components/space/MonthPicker'
import { useSpacePage } from '@/layouts/SpaceLayout'
import { useSpaces } from '@/context/SpacesContext'
import { useSession } from '@/context/SessionContext'
import { useToast } from '@/components/ui/Toast'
import { addMonths, countsAsResult, currentYM, monthName, monthTotals, monthsEnding } from '@/services/spaceMath'
import { PAYMENT_METHOD_LABEL } from '@/data/constants'
import { formatDate, formatPercent, normalize } from '@/utils/format'
import { exportCsv } from '@/utils/csv'
import { cn } from '@/utils/cn'
import type { Entry } from '@/types'

type Period = 'mes' | 'ano'

function groupByCategory(rows: Entry[]) {
  const map = new Map<string, number>()
  for (const e of rows) map.set(e.category || 'Sem categoria', (map.get(e.category || 'Sem categoria') ?? 0) + e.amount)
  return [...map.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total)
}

function Line({ label, value, strong, sub, muted }: { label: string; value: number; strong?: boolean; sub?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-2', sub && 'pl-4', strong && 'border-t border-line pt-3')}>
      <span className={cn('text-sm', strong ? 'font-medium text-fg' : muted ? 'text-muted' : 'text-fg-soft')}>{label}</span>
      <Money value={value} className={cn('text-sm', strong ? 'text-fg' : 'text-fg-soft')} />
    </div>
  )
}

export default function SpaceReport() {
  const { space, words } = useSpacePage()
  const { entries } = useSpaces()
  const { session } = useSession()
  const toast = useToast()
  const [params] = useSearchParams()
  const [period, setPeriod] = useState<Period>('mes')
  const [ym, setYm] = useState(params.get('mes') ?? currentYM())
  const [year, setYear] = useState(Number(currentYM().slice(0, 4)))

  const mine = useMemo(() => entries.filter((e) => e.spaceId === space.id), [entries, space.id])
  const inPeriod = (e: Entry) => (period === 'mes' ? e.date.startsWith(ym) : e.date.startsWith(String(year)))
  const rows = mine.filter((e) => countsAsResult(e) && inPeriod(e))
  const ins = rows.filter((e) => e.type === 'receita')
  const outs = rows.filter((e) => e.type === 'despesa')
  const income = ins.reduce((a, e) => a + e.amount, 0)
  const expense = outs.reduce((a, e) => a + e.amount, 0)
  const result = income - expense
  const realized = ins.filter((e) => e.status === 'pago').reduce((a, e) => a + e.amount, 0) - outs.filter((e) => e.status === 'pago').reduce((a, e) => a + e.amount, 0)
  const toReceive = ins.filter((e) => e.status === 'pendente').reduce((a, e) => a + e.amount, 0)
  const toPay = outs.filter((e) => e.status === 'pendente').reduce((a, e) => a + e.amount, 0)
  const margin = income ? result / income : 0

  const prevLabel = period === 'mes' ? monthName(addMonths(ym, -1), false).toLowerCase() : String(year - 1)
  const prev = useMemo(() => {
    const prefix = period === 'mes' ? addMonths(ym, -1) : String(year - 1)
    const p = mine.filter((e) => countsAsResult(e) && e.date.startsWith(prefix))
    return p.reduce((a, e) => a + (e.type === 'receita' ? e.amount : -e.amount), 0)
  }, [mine, period, ym, year])

  const months = period === 'ano' ? monthsEnding(`${year}-12`, 12) : []
  const title = period === 'mes' ? monthName(ym) : String(year)

  const exportRows = () => {
    exportCsv(`relatorio-${normalize(space.name).replace(/\s+/g, '-')}-${period === 'mes' ? ym : year}.csv`, rows, [
      { header: 'Data', value: (e) => formatDate(e.date) },
      { header: 'Tipo', value: (e) => (e.type === 'receita' ? words.in : words.out) },
      { header: 'Descrição', value: (e) => e.description },
      { header: 'Categoria', value: (e) => e.category },
      { header: words.counterparty, value: (e) => e.counterparty },
      { header: 'Forma', value: (e) => PAYMENT_METHOD_LABEL[e.method] },
      { header: 'Situação', value: (e) => (e.status === 'pago' ? 'pago' : 'em aberto') },
      { header: 'Valor', value: (e) => ((e.type === 'receita' ? 1 : -1) * e.amount).toFixed(2).replace('.', ',') },
    ])
    toast.success('Planilha baixada', `${rows.length} lançamentos`)
  }

  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow={space.name}
          title="Relatório"
          description={`${words.ins}, ${words.outs.toLowerCase()} e ${words.result.toLowerCase()} por categoria. Imprima ou salve em PDF para mostrar ou guardar.`}
          actions={
            <>
              <Segmented<Period>
                value={period}
                onChange={setPeriod}
                options={[
                  { value: 'mes', label: 'Mês' },
                  { value: 'ano', label: 'Ano' },
                ]}
              />
              {period === 'mes' ? (
                <MonthPicker value={ym} onChange={setYm} />
              ) : (
                <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-ink p-1">
                  <button onClick={() => setYear((y) => y - 1)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-fg" aria-label="Ano anterior">
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="px-2 font-mono text-sm">{year}</span>
                  <button onClick={() => setYear((y) => y + 1)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-fg" aria-label="Próximo ano">
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}
              <Button variant="outline" icon={<Download className="size-4" />} onClick={exportRows} disabled={!rows.length}>
                Planilha
              </Button>
              <Button variant="primary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
                PDF
              </Button>
            </>
          }
        />
      </div>

      <Card className="print-sheet mx-auto max-w-3xl p-5 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-4">
          <div>
            <p className="eyebrow">Relatório financeiro</p>
            <h2 className="mt-1 text-xl font-light tracking-tight">
              {space.name} · {title}
            </h2>
          </div>
          <p className="text-[11px] text-faint">
            Gerado em {formatDate(new Date().toISOString())}
            {session?.name ? ` por ${session.name}` : ''}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: words.ins, value: income },
            { label: words.outs, value: expense },
            { label: words.result, value: result },
            { label: 'Margem', text: formatPercent(margin, 1) },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-line p-3">
              <p className="text-[10px] tracking-widest text-muted uppercase">{k.label}</p>
              <p className={cn('mt-1.5 font-mono text-base', k.value !== undefined && k.value < 0 && 'text-danger')}>
                {k.text ?? <Money value={k.value ?? 0} />}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-muted">
          {prev ? (
            <>
              {words.result} de {prevLabel}: <Money value={prev} className="text-fg-soft" /> ·{' '}
              {result >= prev ? 'melhor' : 'pior'} em <Money value={Math.abs(result - prev)} className="text-fg-soft" />
            </>
          ) : (
            `Sem lançamentos em ${prevLabel} para comparar.`
          )}
        </p>

        <div className="mt-6">
          <Line label={words.ins} value={income} strong />
          {groupByCategory(ins).map((c) => (
            <Line key={c.category} label={c.category} value={c.total} sub muted />
          ))}
          <Line label={`(−) ${words.outs}`} value={expense} strong />
          {groupByCategory(outs).map((c) => (
            <Line key={c.category} label={c.category} value={c.total} sub muted />
          ))}
          <div className="mt-2 flex items-baseline justify-between gap-4 rounded-xl border border-line-strong bg-white/[0.03] px-4 py-3">
            <span className="text-sm font-medium">= {words.result}</span>
            <Money value={result} className={cn('text-lg', result < 0 ? 'text-danger' : 'text-fg')} />
          </div>
          <div className="mt-3 grid gap-1 text-xs text-muted sm:grid-cols-3">
            <span>
              Já realizado: <Money value={realized} className="text-fg-soft" />
            </span>
            <span>
              A receber: <Money value={toReceive} className="text-fg-soft" />
            </span>
            <span>
              A pagar: <Money value={toPay} className="text-fg-soft" />
            </span>
          </div>
        </div>

        {period === 'ano' && (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[10px] tracking-widest text-muted uppercase">
                  <th className="py-2 font-normal">Mês</th>
                  <th className="py-2 text-right font-normal">{words.ins}</th>
                  <th className="py-2 text-right font-normal">{words.outs}</th>
                  <th className="py-2 text-right font-normal">{words.result}</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => {
                  const t = monthTotals(mine, m)
                  return (
                    <tr key={m} className="border-b border-line">
                      <td className="py-2 text-fg-soft">{monthName(m, false)}</td>
                      <td className="py-2 text-right">
                        <Money value={t.income} />
                      </td>
                      <td className="py-2 text-right text-fg-soft">
                        <Money value={t.expense} />
                      </td>
                      <td className={cn('py-2 text-right', t.forecast < 0 && 'text-danger')}>
                        <Money value={t.forecast} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!rows.length && <p className="mt-6 text-center text-sm text-muted">Nenhum lançamento neste período.</p>}
      </Card>
    </>
  )
}
