import { useCallback, useEffect, useState } from 'react'
import { Copy, KeyRound, Trash2, UserPlus } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import { getSupabase } from '@/lib/supabase'
import { provider } from '@/services/database'
import type { SpaceRole } from '@/context/AccessContext'

interface Member {
  space_id: string
  user_id: string
  email: string | null
  role: SpaceRole
}

/**
 * Acessos (só o administrador vê): libera um espaço para outra conta —
 * seu pai, um cliente. Assim dá para crescer para mais clientes, cada um
 * vendo só o espaço dele.
 */
export function AccessSettingsCard() {
  const { spaces } = useSpaces()
  const toast = useToast()
  const sb = provider.name === 'supabase' ? getSupabase() : null
  const [members, setMembers] = useState<Member[]>([])
  const [email, setEmail] = useState('')
  const [spaceId, setSpaceId] = useState('')
  const [role, setRole] = useState<SpaceRole>('editor')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!sb) return
    const { data } = await sb.from('space_members').select('space_id, user_id, email, role').order('created_at')
    setMembers((data ?? []) as Member[])
  }, [sb])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    if (!spaceId && spaces[0]) setSpaceId(spaces[0].id)
  }, [spaces, spaceId])

  const site = `${window.location.origin}${window.location.pathname}`
  const invite = `Oi! Para acessar o sistema: abra ${site}, toque em “Criar conta” e use este e-mail. Depois me avise que eu libero o seu acesso.`

  const grant = async () => {
    if (!sb || !email.trim() || !spaceId) return
    setBusy(true)
    try {
      const { error } = await sb.rpc('grant_space_access', { p_email: email.trim(), p_space_id: spaceId, p_role: role })
      if (error) {
        if (/conta_nao_encontrada/.test(error.message)) {
          toast.error('Essa pessoa ainda não tem conta', 'Mande o convite: ela cria a conta com esse e-mail e depois você libera.')
        } else toast.error('Não deu para liberar', error.message)
        return
      }
      toast.success('Acesso liberado', `${email.trim()} → ${spaces.find((s) => s.id === spaceId)?.name}`)
      setEmail('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (m: Member) => {
    if (!sb) return
    const { error } = await sb.from('space_members').delete().match({ space_id: m.space_id, user_id: m.user_id })
    if (error) toast.error('Não deu para tirar o acesso', error.message)
    else {
      toast.success('Acesso retirado', m.email ?? '')
      await load()
    }
  }

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(invite)
      toast.success('Convite copiado', 'Cole no WhatsApp da pessoa')
    } catch {
      toast.error('Não deu para copiar')
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader eyebrow="Acessos · mais clientes" title="Quem pode entrar em cada espaço" />
      <CardBody className="space-y-5">
        <p className="text-sm text-muted">
          Você é o <span className="text-fg">administrador</span> e vê tudo. Para outra pessoa (seu pai, um cliente) usar o sistema:
          ela cria a conta na tela de entrada e você libera aqui <span className="text-fg">só o espaço dela</span>. Para um cliente novo,
          crie um espaço para ele em “Espaços” e libere.
        </p>

        {!sb ? (
          <p className="rounded-xl border border-dashed border-white/25 px-3 py-2 text-xs text-muted">Disponível com o login real (Supabase).</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="E-mail da pessoa">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@email.com" />
              </FormField>
              <FormField label="Espaço">
                <Select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Pode">
                <Segmented<SpaceRole>
                  value={role}
                  onChange={setRole}
                  options={[
                    { value: 'editor', label: 'Ver e lançar' },
                    { value: 'leitor', label: 'Só ver' },
                  ]}
                />
              </FormField>
              <div className="flex items-end gap-2">
                <Button variant="primary" icon={<UserPlus className="size-4" />} loading={busy} disabled={!email.trim()} onClick={() => void grant()}>
                  Liberar acesso
                </Button>
                <Button variant="ghost" icon={<Copy className="size-4" />} onClick={() => void copyInvite()}>
                  Convite
                </Button>
              </div>
            </div>

            <div>
              <p className="eyebrow mb-2">Com acesso</p>
              {members.length ? (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {members.map((m) => (
                    <li key={`${m.space_id}-${m.user_id}`} className="flex items-center gap-3 px-3 py-2.5">
                      <KeyRound className="size-4 shrink-0 text-faint" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{m.email}</span>
                        <span className="block text-xs text-muted">
                          {spaces.find((s) => s.id === m.space_id)?.name ?? m.space_id} · {m.role === 'editor' ? 'vê e lança' : 'só vê'}
                        </span>
                      </span>
                      <Button variant="ghost" size="sm" icon={<Trash2 className="size-3.5" />} onClick={() => void remove(m)}>
                        Tirar
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Só você, por enquanto.</p>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  )
}
