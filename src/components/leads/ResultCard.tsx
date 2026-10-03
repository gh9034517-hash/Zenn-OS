import { Bookmark, BookmarkCheck, Eye, MessageCircle, Phone, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { LeadStatusBadge } from '@/components/leads/LeadBadges'
import { categoriaLabel } from '@/services/outreach'
import { hasNoWebsite } from '@/services/googlePlaces'
import type { Lead, PlaceResult } from '@/types'
import { cn } from '@/utils/cn'

function Monogram({ name }: { name: string }) {
  const initials = name
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong bg-gradient-to-br from-white/[0.12] to-white/[0.02] font-display text-[11px] tracking-wider text-fg-soft">
      {initials || '•'}
    </span>
  )
}

/** Cartão de resultado da busca — pensado para o polegar, no celular. */
export function ResultCard({
  r,
  saved,
  busy,
  onContact,
  onSave,
  onPreview,
  delay = 0,
}: {
  r: PlaceResult
  saved: Lead | undefined
  busy: boolean
  onContact: () => void
  onSave: () => void
  onPreview: () => void
  delay?: number
}) {
  const semSite = hasNoWebsite(r.website)
  // Cidade sempre visível: na busca por Brasil/estado os leads vêm de várias.
  const local = [categoriaLabel(r.category), r.city, r.address].filter(Boolean).join(' · ')
  const telHref = r.phone ? `tel:${r.phone.replace(/[^\d+]/g, '')}` : null

  return (
    <li className="animate-fade-in px-4 py-4 sm:px-5" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start gap-3">
        <Monogram name={r.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button onClick={onPreview} className="min-w-0 text-left">
              <p className="truncate text-[15px] leading-tight font-medium text-fg">{r.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{local}</p>
            </button>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 font-display text-[9px] tracking-[0.14em]',
                semSite ? 'bg-white text-black' : 'border border-line text-faint',
              )}
            >
              {semSite ? 'SEM SITE' : 'TEM SITE'}
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {telHref ? (
              <a
                href={telHref}
                className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-ink px-2.5 py-1.5 font-mono text-sm text-fg transition-colors hover:border-white/40"
              >
                <Phone className="size-3.5 text-muted" />
                {r.phone}
              </a>
            ) : (
              r.googleMapsUrl && (
                <a
                  href={r.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-white/30 hover:text-fg"
                >
                  <ExternalLink className="size-3.5" />
                  Sem telefone no mapa · ver no Google
                </a>
              )
            )}
            {saved && <LeadStatusBadge status={saved.status} />}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2 sm:pl-[52px]">
        <Button size="sm" variant="primary" icon={<MessageCircle className="size-3.5" />} onClick={onContact}>
          Contatar
        </Button>
        <Button
          size="sm"
          variant={saved ? 'ghost' : 'secondary'}
          loading={busy}
          icon={saved ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
          onClick={onSave}
        >
          {saved ? 'Salvo' : 'Salvar'}
        </Button>
        <Button size="sm" variant="outline" icon={<Eye className="size-3.5" />} onClick={onPreview} aria-label="Ver detalhes">
          <span className="hidden sm:inline">Ver</span>
        </Button>
      </div>
    </li>
  )
}

export function ResultsSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      {label && <p className="eyebrow px-4 pt-4 sm:px-5">{label}</p>}
      <ul className="divide-y divide-line">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="px-4 py-4 sm:px-5" style={{ opacity: 1 - i * 0.15 }}>
            <div className="flex items-start gap-3">
              <span className="skeleton size-10 shrink-0 !rounded-full" />
              <div className="flex-1 space-y-2">
                <span className="skeleton block h-3.5 w-2/3" />
                <span className="skeleton block h-3 w-1/2" />
                <span className="skeleton mt-3 block h-7 w-40" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
