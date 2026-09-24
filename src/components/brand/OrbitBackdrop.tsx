import { cn } from '@/utils/cn'

/** Linhas orbitais finas — elemento decorativo cinematográfico. */
export function OrbitBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute top-1/2 left-1/2 size-[900px] -translate-x-1/2 -translate-y-1/2 animate-orbit-slow rounded-full border border-white/[0.05]" />
      <div className="absolute top-1/2 left-1/2 size-[620px] -translate-x-1/2 -translate-y-1/2 animate-orbit rounded-full border border-white/[0.06]">
        <span className="absolute top-0 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_14px_3px_rgba(255,255,255,0.45)]" />
      </div>
      <div className="absolute top-1/2 left-1/2 size-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/[0.07]" />
      <div className="absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.09),transparent_65%)]" />
    </div>
  )
}
