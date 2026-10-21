import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Mail, User, Lock } from 'lucide-react'
import { Mascot } from '@/components/brand/Mascot'
import { Logo } from '@/components/brand/Logo'
import { asset } from '@/utils/asset'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Field'
import { useSession } from '@/context/SessionContext'
import { integrations } from '@/lib/env'

export default function Login() {
  const { session, onboarded, signInLocal, signInSupabase, signUpSupabase } = useSession()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar')
  const [notice, setNotice] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const supabaseAuth = integrations.supabase

  if (!onboarded) return <Navigate to="/welcome" replace />
  if (session) return <Navigate to="/inicio" replace />

  const creating = supabaseAuth && mode === 'criar'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (creating) {
        const mustConfirm = await signUpSupabase(name, email, password)
        if (mustConfirm) {
          setNotice('Conta criada! Abra o e-mail que enviamos, confirme, e depois entre aqui. Avise o administrador para liberar o seu acesso.')
          setMode('entrar')
          return
        }
      } else if (supabaseAuth) await signInSupabase(email, password)
      else signInLocal(name || email.split('@')[0] || 'Operador', email)
      navigate('/inicio')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao entrar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh bg-void lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line lg:block">
        <div className="absolute inset-0 flex flex-col items-center justify-center px-10">
          <img
            src={asset('brand/zenn-logo-full.webp')}
            alt="Zenn Works — Ideias → Código → Resultados"
            className="pointer-events-none w-full max-w-[620px] animate-fade-in mix-blend-screen [mask-image:radial-gradient(ellipse_at_center,black_60%,transparent_80%)]"
          />
          <p className="eyebrow mt-2">Trabalho · Pessoal · Zenn Works</p>
        </div>
        <div className="absolute bottom-8 left-10">
          <Logo />
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-sm animate-slide-up">
          <div className="mb-10 flex items-center gap-4 lg:hidden">
            <Mascot size={64} animated={false} />
            <Logo />
          </div>
          <p className="eyebrow mb-3">Acesso</p>
          <h1 className="text-3xl font-light tracking-tight">{creating ? 'Criar conta' : 'Entrar'}</h1>
          <p className="mt-2 text-sm text-muted">
            {!supabaseAuth
              ? 'Sessão local: seu perfil fica salvo apenas neste navegador.'
              : creating
                ? 'Depois de criar, o administrador libera o que você pode ver.'
                : 'Use o e-mail e a senha da sua conta.'}
          </p>

          <div className="mt-8 space-y-4">
            {(!supabaseAuth || creating) && (
              <FormField label="Nome" htmlFor="name">
                <Input id="name" icon={<User />} value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required autoFocus />
              </FormField>
            )}
            <FormField label="E-mail" htmlFor="email">
              <Input
                id="email"
                type="email"
                icon={<Mail />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@zennworks.com"
                required={supabaseAuth}
              />
            </FormField>
            {supabaseAuth && (
              <FormField label="Senha" htmlFor="password" hint={creating ? 'pelo menos 8 caracteres' : undefined}>
                <Input
                  id="password"
                  type="password"
                  icon={<Lock />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={creating ? 'new-password' : 'current-password'}
                  minLength={creating ? 8 : undefined}
                  required
                />
              </FormField>
            )}
          </div>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}
          {notice && <p className="mt-4 rounded-xl border border-line-strong px-3 py-2 text-sm text-fg-soft">{notice}</p>}

          <Button type="submit" variant="primary" size="lg" loading={busy} className="mt-8 w-full" icon={<ArrowRight className="size-4" />}>
            {creating ? 'Criar conta' : 'Entrar'}
          </Button>
          {supabaseAuth && (
            <p className="mt-5 text-center text-sm text-muted">
              {creating ? 'Já tem conta? ' : 'Ainda não tem conta? '}
              <button
                type="button"
                onClick={() => {
                  setMode(creating ? 'entrar' : 'criar')
                  setError(null)
                }}
                className="text-fg underline-offset-2 hover:underline"
              >
                {creating ? 'Entrar' : 'Criar conta'}
              </button>
            </p>
          )}
        </form>
      </section>
    </div>
  )
}
