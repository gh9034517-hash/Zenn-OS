import { cn } from '@/utils/cn'
import { asset } from '@/utils/asset'

/**
 * Zennzinho — mascote oficial da Zenn Works (artes em /public/brand).
 * - "mark": personagem com o Z e a órbita (telas de destaque)
 * - "head": avatar do rosto (tamanhos pequenos, empty states)
 * - "desk": cena do Zennzinho trabalhando (onboarding)
 * As artes têm fundo preto; o blend "screen" funde o preto com o fundo da UI.
 */
type Variant = 'auto' | 'mark' | 'head' | 'desk'

const SRC = {
  mark: asset('brand/zennzinho-mark.webp'),
  head: asset('brand/zennzinho-head.webp'),
  desk: asset('brand/zennzinho-desk.webp'),
}

export function Mascot({
  size = 160,
  variant = 'auto',
  className,
  animated = true,
}: {
  size?: number
  variant?: Variant
  className?: string
  animated?: boolean
}) {
  const v = variant === 'auto' ? (size < 140 ? 'head' : 'mark') : variant

  if (v === 'head') {
    return (
      <span
        className={cn(
          'relative inline-block shrink-0 overflow-hidden rounded-full border border-white/15 bg-black shadow-[0_0_40px_-8px_rgba(255,255,255,0.25)]',
          animated && 'animate-float',
          className,
        )}
        style={{ width: size, height: size }}
      >
        <img src={SRC.head} alt="Zennzinho" draggable={false} className="size-full object-cover object-[50%_35%] select-none" />
        <span className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]" />
      </span>
    )
  }

  return (
    <img
      src={SRC[v]}
      alt="Zennzinho, mascote da Zenn Works"
      draggable={false}
      className={cn(
        // pointer-events-none: a arte é decorativa e nunca deve interceptar
        // cliques dos botões que ficam por perto (ou por baixo).
        'pointer-events-none shrink-0 object-contain mix-blend-screen select-none [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_78%)]',
        animated && v === 'mark' && 'animate-float',
        className,
      )}
      style={{ width: size, height: v === 'mark' ? size * 0.76 : size }}
    />
  )
}
