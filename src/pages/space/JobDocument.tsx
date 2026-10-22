import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Field'
import { useSpacePage } from '@/layouts/SpaceLayout'
import { useSpaces } from '@/context/SpacesContext'
import { usePrefs } from '@/context/PrefsContext'
import { JOB_KIND_LABEL, addDays, jobFinance, localISO } from '@/services/spaceMath'
import { PAYMENT_METHOD_LABEL } from '@/data/constants'
import { formatCurrency, formatDate, whatsappLink } from '@/utils/format'
import { valorPorExtenso } from '@/utils/extenso'

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

/** Orçamento ou recibo de um serviço, pronto para imprimir / salvar em PDF / mandar no WhatsApp. */
export default function JobDocument() {
  const { jobId, doc } = useParams()
  const { space } = useSpacePage()
  const { jobs, entries } = useSpaces()
  const { prefs } = usePrefs()
  const navigate = useNavigate()
  const job = jobs.find((j) => j.id === jobId)
  const [conditions, setConditions] = useState('Sinal de 50% para começar e o restante na entrega.')
  const [validDays, setValidDays] = useState('15')
  if (!job || (doc !== 'orcamento' && doc !== 'recibo')) return <Navigate to={`/e/${space.id}/servicos`} replace />

  const isQuote = doc === 'orcamento'
  const f = jobFinance(job, entries)
  const paid = f.entries.filter((e) => e.type === 'receita' && e.status === 'pago').sort((a, b) => a.date.localeCompare(b.date))
  const today = localISO()
  const number = job.id.replace(/[^a-z0-9]/gi, '').slice(-5).toUpperCase()
  const company = prefs.businessName.trim() || space.name
  const companyLine = [prefs.businessPhone, prefs.businessCity, prefs.businessDoc && `CNPJ/CPF ${prefs.businessDoc}`].filter(Boolean).join(' · ')
  const valid = Math.max(1, Math.floor(Number(validDays) || 15))

  const text = isQuote
    ? [
        `*Orçamento nº ${number}* — ${company}`,
        `${job.title}${job.description ? `\n${job.description}` : ''}`,
        `Valor: ${formatCurrency(job.value)}`,
        job.deadline ? `Prazo de entrega: ${formatDate(job.deadline)}` : '',
        conditions,
        `Válido até ${formatDate(addDays(today, valid))}.`,
      ]
        .filter(Boolean)
        .join('\n\n')
    : `*Recibo* — ${company}\n\nRecebi de ${job.client || 'cliente'} a importância de ${formatCurrency(f.received)} (${valorPorExtenso(f.received)}), referente a ${job.title}.\n\n${prefs.businessCity ? `${prefs.businessCity}, ` : ''}${longDate(today)}.`
  const wa = whatsappLink(job.phone, text) ?? `https://wa.me/?text=${encodeURIComponent(text)}`

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => navigate(`/e/${space.id}/servicos?abrir=${job.id}`)}>
          Voltar
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-medium text-fg transition hover:bg-white/[0.04]"
          >
            <MessageCircle className="size-4" /> WhatsApp
          </a>
          <Button variant="primary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {isQuote && (
        <div className="no-print mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Condições de pagamento</span>
            <Textarea value={conditions} onChange={(e) => setConditions(e.target.value)} className="min-h-14" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Validade (dias)</span>
            <Input inputMode="numeric" value={validDays} onChange={(e) => setValidDays(e.target.value)} />
          </label>
        </div>
      )}
      {!prefs.businessName && (
        <p className="no-print mb-4 text-xs text-muted">
          Dica: coloque o nome, telefone e cidade da empresa em Personalizar → Dados da empresa para saírem aqui.
        </p>
      )}

      <Card className="print-sheet mx-auto max-w-2xl p-6 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="text-xl font-medium tracking-tight">{company}</p>
            {companyLine && <p className="mt-1 text-xs text-muted">{companyLine}</p>}
          </div>
          <div className="text-right">
            <p className="eyebrow">{isQuote ? 'Orçamento' : 'Recibo'}</p>
            <p className="mt-1 font-mono text-sm">nº {number}</p>
            <p className="text-xs text-muted">{formatDate(today)}</p>
          </div>
        </header>

        {isQuote ? (
          <div className="mt-6 space-y-6 text-sm">
            <section>
              <p className="eyebrow mb-1.5">Cliente</p>
              <p className="text-fg">{job.client || '—'}</p>
              {(job.phone || job.address) && <p className="text-muted">{[job.phone, job.address].filter(Boolean).join(' · ')}</p>}
            </section>
            <section>
              <p className="eyebrow mb-1.5">{JOB_KIND_LABEL[job.kind]}</p>
              <p className="text-base text-fg">{job.title}</p>
              {job.description && <p className="mt-1.5 whitespace-pre-line text-muted">{job.description}</p>}
            </section>
            <section className="flex items-baseline justify-between gap-4 rounded-xl border border-line-strong px-4 py-3">
              <span className="font-medium">Valor total</span>
              <span className="font-mono text-xl">{formatCurrency(job.value)}</span>
            </section>
            <section className="grid gap-1 text-muted">
              <p>
                <span className="text-fg">Prazo de entrega:</span> {job.deadline ? formatDate(job.deadline) : 'a combinar'}
              </p>
              <p>
                <span className="text-fg">Pagamento:</span> {conditions}
              </p>
              <p>
                <span className="text-fg">Validade:</span> até {formatDate(addDays(today, valid))}
              </p>
            </section>
          </div>
        ) : (
          <div className="mt-6 space-y-6 text-sm">
            <p className="text-base leading-relaxed text-fg">
              Recebi de <strong className="font-medium">{job.client || '__________________'}</strong> a importância de{' '}
              <strong className="font-mono font-medium">{formatCurrency(f.received)}</strong> ({valorPorExtenso(f.received)}), referente a{' '}
              {job.title}.
            </p>
            {paid.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[10px] tracking-widest text-muted uppercase">
                    <th className="py-2 font-normal">Data</th>
                    <th className="py-2 font-normal">Forma</th>
                    <th className="py-2 text-right font-normal">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {paid.map((e) => (
                    <tr key={e.id} className="border-b border-line">
                      <td className="py-2">{formatDate(e.date)}</td>
                      <td className="py-2">{PAYMENT_METHOD_LABEL[e.method]}</td>
                      <td className="py-2 text-right font-mono">{formatCurrency(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {f.value > f.received && (
              <p className="text-muted">
                Valor total do serviço: {formatCurrency(f.value)} · falta {formatCurrency(f.value - f.received)}.
              </p>
            )}
            <p className="text-muted">
              {prefs.businessCity ? `${prefs.businessCity}, ` : ''}
              {longDate(today)}.
            </p>
          </div>
        )}

        <footer className="mt-16 grid gap-10 sm:grid-cols-2">
          <div className="border-t border-line-strong pt-2 text-center text-xs text-muted">{company}</div>
          {isQuote && <div className="border-t border-line-strong pt-2 text-center text-xs text-muted">{job.client || 'Cliente'} — de acordo</div>}
        </footer>
      </Card>
    </>
  )
}
