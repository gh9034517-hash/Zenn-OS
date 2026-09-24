import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, Download, MapPinned, RefreshCw, Trash2, Upload, Sparkles, CheckCircle2, CircleDashed } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { FormField, Input } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FacebookIcon } from '@/components/ui/BrandIcons'
import { Mascot } from '@/components/brand/Mascot'
import { useData } from '@/context/DataContext'
import { useSession } from '@/context/SessionContext'
import { useToast } from '@/components/ui/Toast'
import { integrations, env } from '@/lib/env'
import { importSnapshot, type Snapshot } from '@/services/database'
import { downloadFile } from '@/utils/csv'

function IntegrationRow({ icon, name, configured, detail, envVars }: { icon: React.ReactNode; name: string; configured: boolean; detail: string; envVars: string[] }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line py-4 last:border-0 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-muted [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {name}
          {configured ? <Badge tone="solid" icon={<CheckCircle2 className="size-3" />}>Configurado</Badge> : <Badge tone="dashed" icon={<CircleDashed className="size-3" />}>Demo mode</Badge>}
        </p>
        <p className="mt-0.5 text-xs text-muted">{detail}</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {envVars.map((v) => <code key={v} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint">{v}</code>)}
      </div>
    </div>
  )
}

export default function Settings() {
  const data = useData()
  const { session, updateProfile } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(session?.name ?? '')
  const [email, setEmail] = useState(session?.email ?? '')
  const [confirm, setConfirm] = useState<null | 'reseed' | 'clearDemo' | 'reset'>(null)

  const counts = [
    ['Leads', data.leads.length], ['Clientes', data.clients.length], ['Projetos', data.projects.length], ['Tarefas', data.tasks.length],
    ['Transações', data.transactions.length], ['Pagamentos', data.payments.length], ['Atividades', data.activities.length],
  ] as const

  const exportBackup = () => {
    const snapshot: Snapshot = {
      leads: data.leads, clients: data.clients, projects: data.projects, tasks: data.tasks,
      transactions: data.transactions, payments: data.payments, activities: data.activities,
    }
    downloadFile(`zenn-os-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(snapshot, null, 2), 'application/json')
    toast.success('Backup exportado')
  }

  const importBackup = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<Snapshot>
      const existing = new Set([...data.leads, ...data.clients, ...data.projects, ...data.tasks, ...data.transactions, ...data.payments, ...data.activities].map((r) => r.id))
      const fresh = Object.fromEntries(
        Object.entries(parsed).map(([k, rows]) => [k, Array.isArray(rows) ? rows.filter((r: { id?: string }) => r?.id && !existing.has(r.id)) : []]),
      ) as Partial<Snapshot>
      await importSnapshot(fresh)
      await data.refresh()
      const total = Object.values(fresh).reduce((a, r) => a + (r?.length ?? 0), 0)
      toast.success('Backup importado', `${total} registros novos`)
    } catch (e) {
      toast.error('Arquivo inválido', e instanceof Error ? e.message : undefined)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Sistema" title="Configurações" description="Perfil, integrações e gestão dos dados." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader eyebrow="Operador" title="Perfil" />
          <CardBody className="space-y-4">
            <FormField label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} /></FormField>
            <FormField label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></FormField>
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

        <Card className="lg:col-span-2">
          <CardHeader eyebrow="Integrações" title="Status das APIs" />
          <CardBody className="pt-2">
            <IntegrationRow icon={<MapPinned />} name="Google Places API" configured={integrations.googlePlaces} envVars={['GOOGLE_MAPS_API_KEY']}
              detail={integrations.googlePlaces ? 'Buscas de prospecção usam dados reais (Places API New · Text Search).' : 'Sem chave: a prospecção gera resultados fictícios marcados como DEMO.'} />
            <IntegrationRow icon={<Database />} name="Supabase" configured={integrations.supabase} envVars={['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_DATA_PROVIDER']}
              detail={`Persistência atual: ${data.providerName === 'supabase' ? 'Supabase (Postgres)' : 'localStorage deste navegador'}. ${integrations.supabase && data.providerName !== 'supabase' ? 'Defina VITE_DATA_PROVIDER=supabase para usar o banco.' : ''} Schema em supabase/schema.sql.`} />
            <IntegrationRow icon={<FacebookIcon />} name="Meta Graph API" configured={integrations.meta} envVars={['META_ACCESS_TOKEN', 'META_APP_ID', 'META_GRAPH_VERSION']}
              detail={integrations.meta ? `Enriquecimento de leads via Graph API ${env.metaGraphVersion}.` : 'Sem token: o enriquecimento no detalhe do lead retorna dados DEMO.'} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader eyebrow="Dados" title="Base armazenada" action={<Badge tone="muted">{data.providerName}</Badge>} />
          <CardBody>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {counts.map(([label, n]) => (
                <div key={label} className="rounded-xl border border-line px-3 py-2.5">
                  <p className="text-[10px] tracking-wider text-faint uppercase">{label}</p>
                  <p className="mt-1 font-mono text-lg">{n}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" icon={<Download className="size-4" />} onClick={exportBackup}>Exportar backup JSON</Button>
              <Button variant="outline" icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>Importar backup</Button>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importBackup(f); e.target.value = '' }} />
              <Button variant="outline" icon={<RefreshCw className="size-4" />} onClick={() => setConfirm('reseed')}>Recarregar dados demo</Button>
              <Button variant="outline" icon={<Trash2 className="size-4" />} onClick={() => setConfirm('clearDemo')} disabled={!data.hasDemoData}>Remover dados demo</Button>
              <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirm('reset')}>Apagar tudo</Button>
            </div>
            <p className="mt-3 text-xs text-faint">
              Dados demo são fictícios (40 leads, 10 clientes, 8 projetos, 30 tarefas, 30 transações) e marcados como DEMO em toda a interface.
            </p>
          </CardBody>
        </Card>

        <Card className="relative overflow-hidden">
          <CardBody className="flex h-full flex-col items-center justify-center text-center">
            <Mascot size={200} variant="mark" />
            <p className="mt-4 text-sm font-medium">Rever apresentação</p>
            <p className="mt-1 text-xs text-muted">Mostra novamente o onboarding do Zennzinho.</p>
            <Button className="mt-4" size="sm" variant="outline" icon={<Sparkles className="size-3.5" />} onClick={() => { localStorage.removeItem('zenn-os:onboarded'); window.location.assign('/welcome') }}>
              Abrir onboarding
            </Button>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirm === 'reseed'}
        onClose={() => setConfirm(null)}
        title="Recarregar dados demo?"
        description="Os registros DEMO atuais serão substituídos pelo conjunto original. Seus dados reais não são afetados."
        confirmLabel="Recarregar"
        onConfirm={async () => { await data.seedDemo(); toast.success('Dados demo recarregados') }}
      />
      <ConfirmDialog
        open={confirm === 'clearDemo'}
        onClose={() => setConfirm(null)}
        title="Remover dados demo?"
        description="Remove apenas registros marcados como DEMO. Seus dados reais permanecem."
        confirmLabel="Remover"
        danger
        onConfirm={async () => { await data.clearDemo(); toast.success('Dados demo removidos') }}
      />
      <ConfirmDialog
        open={confirm === 'reset'}
        onClose={() => setConfirm(null)}
        title="Apagar todos os dados?"
        description="Remove TODOS os leads, clientes, projetos, tarefas e transações. Exporte um backup antes."
        confirmLabel="Apagar tudo"
        danger
        onConfirm={async () => { await data.resetAll(); toast.success('Base zerada'); navigate('/') }}
      />
    </>
  )
}
