import { GlobeLock, Globe } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { hasNoWebsite } from '@/services/googlePlaces'
import type { LeadStatus } from '@/types'
import { LEAD_STATUS_LABEL } from '@/data/constants'

export function WebsiteBadge({ website }: { website: string | null | undefined }) {
  return hasNoWebsite(website) ? (
    <Badge tone="solid" icon={<GlobeLock className="size-3" />}>
      Sem site
    </Badge>
  ) : (
    <Badge tone="muted" icon={<Globe className="size-3" />}>
      Com site
    </Badge>
  )
}

const STATUS_TONE: Record<LeadStatus, 'bright' | 'default' | 'muted' | 'outline' | 'dashed' | 'solid'> = {
  novo: 'outline',
  qualificado: 'default',
  contatado: 'default',
  respondeu: 'bright',
  negociacao: 'bright',
  cliente: 'solid',
  perdido: 'dashed',
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{LEAD_STATUS_LABEL[status]}</Badge>
}

export function Rating({ value, count }: { value: number | null; count?: number }) {
  if (value === null) return <span className="text-faint">—</span>
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      <span className="text-fg">{value.toFixed(1)}</span>
      <span className="relative inline-block h-1 w-10 overflow-hidden rounded-full bg-white/10">
        <span className="absolute inset-y-0 left-0 rounded-full bg-white/80" style={{ width: `${(value / 5) * 100}%` }} />
      </span>
      {count !== undefined && <span className="text-faint">({count})</span>}
    </span>
  )
}
