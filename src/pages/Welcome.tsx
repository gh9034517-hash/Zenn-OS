import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Radar, Users, Briefcase, Wallet } from 'lucide-react'
import { Mascot } from '@/components/brand/Mascot'
import { Logo } from '@/components/brand/Logo'
import { OrbitBackdrop } from '@/components/brand/OrbitBackdrop'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/context/SessionContext'
import { cn } from '@/utils/cn'

const STEPS = [
  {
    icon: Radar,
    title: 'Prospecção',
    text: 'Encontre empresas por nicho e cidade. Destaque imediato para quem ainda não tem site.',
  },
  { icon: Users, title: 'CRM', text: 'Leads em tabela ou kanban, do primeiro contato até virar cliente.' },
  { icon: Briefcase, title: 'Projetos', text: 'Projetos vinculados aos clientes, tarefas e progresso automático.' },
  { icon: Wallet, title: 'Financeiro', text: 'Receitas, pagamentos, pendências e lucro — tudo sincronizado.' },
]

export default function Welcome() {
  const navigate = useNavigate()
  const { completeOnboarding, session } = useSession()
  const [step, setStep] = useState(0)

  const finish = () => {
    completeOnboarding()
    navigate(session ? '/' : '/login')
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-void">
      <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <Logo />
        <button onClick={finish} className="text-xs tracking-widest text-faint uppercase transition hover:text-fg">
          Pular
        </button>
      </header>

      <main className="relative z-10 grid flex-1 items-center gap-10 px-6 pb-12 sm:px-10 lg:grid-cols-2 lg:gap-6">
        <div className="relative flex h-[320px] items-center justify-center sm:h-[440px] lg:h-full">
          <OrbitBackdrop />
          <Mascot size={260} className="relative drop-shadow-[0_30px_60px_rgba(255,255,255,0.12)]" mood="happy" />
        </div>

        <div className="mx-auto w-full max-w-lg animate-slide-up">
          <p className="eyebrow mb-4">Sistema interno · Zenn Works</p>
          <h1 className="text-4xl leading-[1.05] font-light tracking-tight sm:text-6xl">
            Olá, eu sou o <span className="text-metal-animated font-display font-bold tracking-[0.08em]">ZENN</span>.
          </h1>
          <p className="mt-5 text-base text-muted sm:text-lg">
            Vou te acompanhar da prospecção ao pagamento. Aqui está o que o Zenn OS faz:
          </p>

          <div className="mt-8 grid gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                onClick={() => setStep(i)}
                className={cn(
                  'flex items-start gap-4 rounded-2xl border p-4 text-left transition-all duration-300',
                  i === step ? 'border-white/25 bg-white/[0.05]' : 'border-transparent opacity-60 hover:opacity-100',
                )}
              >
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-xl border transition-colors',
                    i === step ? 'border-white bg-white text-black' : 'border-line text-muted',
                  )}
                >
                  <s.icon className="size-4" strokeWidth={1.7} />
                </span>
                <span>
                  <span className="block text-sm font-medium">{s.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{s.text}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3">
            {step < STEPS.length - 1 ? (
              <Button variant="primary" size="lg" onClick={() => setStep(step + 1)} icon={<ArrowRight className="size-4" />}>
                Próximo
              </Button>
            ) : (
              <Button variant="primary" size="lg" onClick={finish} icon={<ArrowRight className="size-4" />}>
                Começar
              </Button>
            )}
            <div className="ml-2 flex gap-1.5">
              {STEPS.map((_, i) => (
                <span key={i} className={cn('h-1 rounded-full transition-all', i === step ? 'w-6 bg-white' : 'w-1.5 bg-white/20')} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
