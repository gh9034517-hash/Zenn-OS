import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, Download, Trash2, Upload, Sparkles, CheckCircle2, CircleDashed } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { FormField, Input } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FacebookIcon } from '@/components/ui/BrandIcons'
import { Mascot } from '@/components/brand/Mascot'
import { useData } from '@/context/DataContext'
import { useSpaces } from '@/context/SpacesContext'
import { SpacesSettingsCard } from '@/components/space/SpacesSettingsCard'
import { AccessSettingsCard } from '@/components/space/AccessSettingsCard'
import { useAccess } from '@/context/AccessContext'
import { useSession } from '@/context/SessionContext'
import { useToast } from '@/components/ui/Toast'
import { integrations, env } from '@/lib/env'
import { importSnapshot, provider, type Snapshot } from '@/services/database'
import { downloadFile } from '@/utils/csv'

function PasswordCard() {
  const toast = useToast()
  const { changePassword } = useSession()
  const [currentPassword, setCurrentPassword] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const tooShort = next.length > 0 && next.length < 8
  const mismatch = confirm.length > 0 && next !== confirm
  const canSave = !!currentPassword && next.length >= 8 && next === confirm && !busy && integrations.supabase

  const save = async () => {
    setBusy(true)
    try {
      await changePassword(currentPassword, next)
      setCurrentPassword('')
      setNext('')
      setConfirm('')
      toast.success('Senha alterada. Use a nova senha no próximo acesso.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível alterar a senha.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader eyebrow="Conta · segurança" title="Alterar senha" />
      <CardBody className="space-y-4">
        <p className="text-sm text-muted">
          Troque a senha de acesso ao Zenn OS. Ela é verificada e guardada pelo
          <span className="text-fg"> Supabase Auth</span> (criptografada) — o sistema nunca salva sua senha no navegador nem no código.
        </p>
        {!integrations.supabase && (
          <p className="rounded-xl border border-dashed border-white/25 px-3 py-2 text-xs text-muted">
            Disponível apenas no modo Supabase (login real). Neste modo local não há senha.
          </p>
        )}
        <FormField label="Senha atual">
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            disabled={!integrations.supabase}
          />
        </FormField>
        <FormField label="Nova senha" hint={tooShort ? 'Use pelo menos 8 caracteres.' : undefined}>
          <Input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Mínimo de 8 caracteres"
            disabled={!integrations.supabase}
          />
        </FormField>
        <FormField label="Repetir nova senha" hint={mismatch ? 'As senhas não conferem.' : undefined}>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repita a nova senha"
            disabled={!integrations.supabase}
          />
        </FormField>
        <Button variant="primary" loading={busy} disabled={!canSave} onClick={save}>
          Alterar senha
        </Button>
      </CardBody>
    </Card>
  )
}

function IntegrationRow({
  icon,
  name,
  configured,
  detail,
  envVars,
}: {
  icon: React.ReactNode
  name: string
  configured: boolean
  detail: string
  envVars: string[]
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line py-4 last:border-0 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-muted [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {name}
          {configured ? (
            <Badge tone="solid" icon={<CheckCircle2 className="size-3" />}>
              Configurado
            </Badge>
          ) : (
            <Badge tone="dashed" icon={<CircleDashed className="size-3" />}>
              Demo mode
            </Badge>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted">{detail}</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {envVars.map((v) => (
          <code key={v} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint">
            {v}
          </code>
        ))}
      </div>
    </div>
  )
}

export default function Settings() {
  const data = useData()
  const spacesData = useSpaces()
  const { isAdmin } = useAccess()
  const { session, updateProfile } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(session?.name ?? '')
  const [email, setEmail] = useState(session?.email ?? '')
  const [confirm, setConfirm] = useState<null | 'clearDemo' | 'reset'>(null)

  const counts = [
    ['Leads', data.leads.length],
    ['Clientes', data.clients.length],
    ['Projetos', data.projects.length],
    ['Tarefas', data.tasks.length],
    ['Transações', data.transactions.length],
    ['Pagamentos', data.payments.length],
    ['Atividades', data.activities.length],
    ['Lançamentos', spacesData.entries.length],
  ] as const

  // Espaços (Pessoal, Trabalho...) entram no mesmo backup, na ordem certa para importar.
  const SPACE_KEYS = ['spaces', 'wallets', 'entries', 'recurrings', 'budgets', 'goals', 'reminders'] as const

  const exportBackup = () => {
    const snapshot = {
      leads: data.leads,
      clients: data.clients,
      projects: data.projects,
      tasks: data.tasks,
      transactions: data.transactions,
      payments: data.payments,
      activities: data.activities,
      ...Object.fromEntries(SPACE_KEYS.map((k) => [k, spacesData[k]])),
    }
    downloadFile(`zenn-os-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(snapshot, null, 2), 'application/json')
    toast.success('Backup exportado')
  }

  const importBackup = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<Snapshot>
      const existing = new Set(
        [...data.leads, ...data.clients, ...data.projects, ...data.tasks, ...data.transactions, ...data.payments, ...data.activities].map(
          (r) => r.id,
        ),
      )
      const fresh = Object.fromEntries(
        Object.entries(parsed)
          .filter(([k]) => !(SPACE_KEYS as readonly string[]).includes(k))
          .map(([k, rows]) => [k, Array.isArray(rows) ? rows.filter((r: { id?: string }) => r?.id && !existing.has(r.id)) : []]),
      ) as Partial<Snapshot>
      await importSnapshot(fresh)
      let total = Object.values(fresh).reduce((a, r) => a + (r?.length ?? 0), 0)
      const raw = parsed as Record<string, unknown>
      for (const key of SPACE_KEYS) {
        const known = new Set((spacesData[key] as { id: string }[]).map((r) => r.id))
        const rows = Array.isArray(raw[key]) ? (raw[key] as { id?: string }[]).filter((r) => r?.id && !known.has(r.id)) : []
        if (rows.length) await provider.insertMany(key, rows as never[])
        total += rows.length
      }
      await Promise.all([data.refresh(), spacesData.refresh()])
      toast.success('Backup importado', `${total} registros novos`)
    } catch (e) {
      toast.error('Arquivo inválido', e instanceof Error ? e.message : undefined)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Sistema" title="Configurações" description="Perfil, espaços, segurança, integrações e backup dos dados." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader eyebrow="Operador" title="Perfil" />
          <CardBody className="space-y-4">
            <FormField label="Nome">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label="E-mail">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormField>
            <div className="flex items-center justify-between">
              <span className="text-xs text-faint">{session?.mode === 'supabase' ? 'Supabase Auth' : 'Sessão local'}</span>
              <Button
                variant="primary"
                size="sm"
                disabled={!name.trim()}
                onClick={() => {
                  updateProfile({ name: name.trim(), email: email.trim() })
                  toast.success('Perfil atualizado')
                }}
              >
                Salvar perfil
              </Button>
            </div>
          </CardBody>
        </Card>

        {isAdmin && <SpacesSettingsCard />}

        {isAdmin && <AccessSettingsCard />}

        {isAdmin && (
          <Card className="lg:col-span-2">
            <CardHeader eyebrow="Integrações" title="Status das APIs" />
            <CardBody className="pt-2">
              <IntegrationRow
                icon={<Database />}
                name="Supabase"
                configured={integrations.supabase}
                envVars={['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_DATA_PROVIDER']}
                detail={`Persistência atual: ${data.providerName === 'supabase' ? 'Supabase (Postgres)' : 'localStorage deste navegador'}. ${integrations.supabase && data.providerName !== 'supabase' ? 'Defina VITE_DATA_PROVIDER=supabase para usar o banco.' : ''} Schema em supabase/schema.sql.`}
              />
              <IntegrationRow
                icon={<FacebookIcon />}
                name="Meta Graph API"
                configured={integrations.meta}
                envVars={['META_ACCESS_TOKEN', 'META_APP_ID', 'META_GRAPH_VERSION']}
                detail={
                  integrations.meta
                    ? `Enriquecimento de leads via Graph API ${env.metaGraphVersion}.`
                    : 'Sem token: o enriquecimento pelo Facebook/Instagram fica desligado.'
                }
              />
            </CardBody>
          </Card>
        )}

        <PasswordCard />

        {isAdmin && (
          <Card className="lg:col-span-2">
            <CardHeader eyebrow="Dados" title="Base armazenada" action={<Badge tone="muted">{data.providerName}</Badge>} />
            <CardBody>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {counts.map(([label, n]) => (
                  <div key={label} className="rounded-xl border border-line px-3 py-2.5">
                    <p className="text-[10px] tracking-wider text-faint uppercase">{label}</p>
                    <p className="mt-1 font-mono text-lg">{n}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="outline" icon={<Download className="size-4" />} onClick={exportBackup}>
                  Exportar backup JSON
                </Button>
                <Button variant="outline" icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
                  Importar backup
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void importBackup(f)
                    e.target.value = ''
                  }}
                />
                {data.hasDemoData && (
                  <Button variant="outline" icon={<Trash2 className="size-4" />} onClick={() => setConfirm('clearDemo')}>
                    Remover dados demo
                  </Button>
                )}
                <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirm('reset')}>
                  Apagar tudo
                </Button>
              </div>
              <p className="mt-3 text-xs text-faint">
                O backup leva tudo: Zenn Works e os espaços (lançamentos, carteiras, contas fixas, metas e lembretes). Guarde de vez em
                quando.
              </p>
            </CardBody>
          </Card>
        )}

        <Card className="relative overflow-hidden">
          <CardBody className="flex h-full flex-col items-center justify-center text-center">
            <Mascot size={200} variant="mark" />
            <p className="mt-4 text-sm font-medium">Deixe com a sua cara</p>
            <p className="mt-1 text-xs text-muted">Nome do sistema, cor, tamanho da letra e o que aparece no menu.</p>
            <Button
              className="mt-4"
              size="sm"
              variant="primary"
              icon={<Sparkles className="size-3.5" />}
              onClick={() => navigate('/personalizar')}
            >
              Personalizar
            </Button>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirm === 'clearDemo'}
        onClose={() => setConfirm(null)}
        title="Remover dados demo?"
        description="Remove apenas registros marcados como DEMO. Seus dados reais permanecem."
        confirmLabel="Remover"
        danger
        onConfirm={async () => {
          await data.clearDemo()
          toast.success('Dados demo removidos')
        }}
      />
      <ConfirmDialog
        open={confirm === 'reset'}
        onClose={() => setConfirm(null)}
        title="Apagar todos os dados?"
        description="Remove TODOS os leads, clientes, projetos, tarefas e transações da Zenn Works (os espaços Pessoal/Trabalho não são afetados). Exporte um backup antes."
        confirmLabel="Apagar tudo"
        danger
        onConfirm={async () => {
          await data.resetAll()
          toast.success('Base zerada')
          navigate('/')
        }}
      />
    </>
  )
}
