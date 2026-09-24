import { useId, useState } from 'react'
import { cn } from '@/utils/cn'

/**
 * Personagem Zenn.
 * Se existir /public/brand/zenn-mascot.png (arte oficial da Zenn Works),
 * ela é usada automaticamente. Caso contrário, renderiza a versão vetorial
 * cromada abaixo — mesma direção: preto, branco, metálico, orbital.
 */
// Lembra o resultado da verificação da arte oficial (evita requisições repetidas).
let officialArtMissing = false

export function Mascot({
  size = 160,
  className,
  animated = true,
  mood = 'calm',
}: {
  size?: number
  className?: string
  animated?: boolean
  mood?: 'calm' | 'happy'
}) {
  const [useVector, setUseVector] = useState(officialArtMissing)
  const id = useId().replace(/:/g, '')

  if (!useVector) {
    return (
      <img
        src="/brand/zenn-mascot.png"
        alt="Zenn"
        width={size}
        height={size}
        onError={() => {
          officialArtMissing = true
          setUseVector(true)
        }}
        className={cn('object-contain select-none', animated && 'animate-float', className)}
        style={{ width: size, height: size }}
        draggable={false}
      />
    )
  }

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label="Zenn, mascote da Zenn Works"
      className={cn('select-none', animated && 'animate-float', className)}
    >
      <defs>
        <linearGradient id={`chrome-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#a4a4aa" />
          <stop offset="0.55" stopColor="#f2f2f4" />
          <stop offset="0.8" stopColor="#5d5d63" />
          <stop offset="1" stopColor="#d9d9de" />
        </linearGradient>
        <linearGradient id={`body-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9e9ec" />
          <stop offset="0.5" stopColor="#8e8e94" />
          <stop offset="1" stopColor="#2a2a2e" />
        </linearGradient>
        <radialGradient id={`visor-${id}`} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#2b2b31" />
          <stop offset="0.6" stopColor="#0a0a0c" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="100" cy="100" r="96" fill={`url(#glow-${id})`} />

      {/* órbita traseira */}
      <ellipse cx="100" cy="108" rx="88" ry="22" fill="none" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" transform="rotate(-14 100 108)" />

      {/* corpo */}
      <path d="M62 170c2-26 18-40 38-40s36 14 38 40z" fill={`url(#body-${id})`} />
      <path d="M86 150h28" stroke="#000" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />

      {/* antena */}
      <line x1="100" y1="34" x2="100" y2="18" stroke={`url(#chrome-${id})`} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="100" cy="15" r="4.5" fill="#fff" />

      {/* cabeça cromada */}
      <rect x="44" y="34" width="112" height="100" rx="46" fill={`url(#chrome-${id})`} />
      <rect x="44.5" y="34.5" width="111" height="99" rx="45.5" fill="none" stroke="#fff" strokeOpacity="0.6" />

      {/* visor */}
      <rect x="56" y="52" width="88" height="62" rx="31" fill={`url(#visor-${id})`} />
      <path d="M68 62c10-6 26-8 40-6" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" fill="none" />

      {/* olhos */}
      {mood === 'happy' ? (
        <g stroke="#fff" strokeWidth="4.5" strokeLinecap="round" fill="none">
          <path d="M78 88q8-9 16 0" />
          <path d="M106 88q8-9 16 0" />
        </g>
      ) : (
        <g fill="#fff">
          <rect x="78" y="80" width="16" height="6" rx="3" />
          <rect x="106" y="80" width="16" height="6" rx="3" />
        </g>
      )}

      {/* orelhas / sensores */}
      <rect x="36" y="72" width="10" height="26" rx="5" fill={`url(#body-${id})`} />
      <rect x="154" y="72" width="10" height="26" rx="5" fill={`url(#body-${id})`} />

      {/* órbita frontal */}
      <path d="M17 125c30 12 136 -8 166 -46" fill="none" stroke={`url(#chrome-${id})`} strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
      <circle cx="176" cy="88" r="3.5" fill="#fff">
        {animated && <animate attributeName="opacity" values="1;0.3;1" dur="3.2s" repeatCount="indefinite" />}
      </circle>
    </svg>
  )
}
