import { useId } from 'react'
import { usePrefs } from '@/context/PrefsContext'
import { cn } from '@/utils/cn'

export function LogoMark({ className }: { className?: string }) {
  const gid = `zenn-logo-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 40 40" className={cn('size-8', className)} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.5" stopColor="#8d8d92" />
          <stop offset="1" stopColor="#ededf0" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="39" height="39" rx="11" fill="#0b0b0d" stroke="rgba(255,255,255,0.14)" />
      <ellipse cx="20" cy="20" rx="16" ry="6" fill="none" stroke={`url(#${gid})`} strokeWidth="0.9" transform="rotate(-24 20 20)" opacity="0.8" />
      <path d="M13 13h14L13 27h14" fill="none" stroke={`url(#${gid})`} strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  )
}

export function Logo({ collapsed, className }: { collapsed?: boolean; className?: string }) {
  const { prefs } = usePrefs()
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <LogoMark className="shrink-0" />
      {!collapsed && (
        <div className="min-w-0 leading-none">
          <p
            className={cn(
              'text-metal truncate font-display text-[13px] font-bold uppercase',
              (prefs.appName || 'ZENN OS').length > 9 ? 'tracking-[0.12em]' : 'tracking-[0.32em]',
            )}
          >
            {prefs.appName || 'ZENN OS'}
          </p>
          {prefs.appTagline && <p className="mt-1 truncate text-[10px] tracking-[0.2em] text-faint uppercase">{prefs.appTagline}</p>}
        </div>
      )}
    </div>
  )
}
