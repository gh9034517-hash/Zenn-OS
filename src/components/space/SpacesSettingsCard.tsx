import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useSpaces } from '@/context/SpacesContext'
import { useToast } from '@/components/ui/Toast'
import { spaceIcon } from '@/components/layout/Sidebar'
import type { Space, SpaceKind } from '@/types'

/** Criar, renomear e apagar espaços (Pessoal, Trabalho, outra empresa...). */
export function SpacesSettingsCard() {
  const { spaces, entries, createSpace, updateSpace, deleteSpace } = useSpaces()
  const toast = useToast()
  const [names, setNames] = useState<Record<string, string>>({})
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<SpaceKind>('empresa')
  const [busy, setBusy] = useState(false)
  const [toDelete, setToDelete] = useState<Space | null>(null)

  const rename = async (s: Space) => {
    const name = (names[s.id] ?? s.name).trim()
    if (!name || name === s.name) return
    try {
      await updateSpace(s.id, { name })
      toast.success('Nome salvo', name)
    } catch (e) {
      toast.error('Não deu para salvar', e instanceof Error ? e.message : String(e))
    }
  }

  const add = async () => {
    if (!newName.trim()) return
    setBusy(true)
    try {
      await createSpace({ name: newName.trim(), kind: newKind })
      toast.success('Espaço criado', newName.trim())
      setNewName('')
    } catch (e) {
      toast.error('Não deu para criar', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader eyebrow="Espaços" title="Suas áreas separadas" />
      <CardBody className="space-y-4">
        <p className="text-sm text-muted">
          Cada espaço tem dinheiro, contas e relatórios próprios — nada se mistura. A <span className="text-fg">Zenn Works</span> continua com
          prospecção, clientes e projetos.
        </p>
        <ul className="space-y-2">
          {spaces.map((s) => {
            const Icon = spaceIcon(s)
            const count = entries.filter((e) => e.spaceId === s.id).length
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2.5 sm:flex-nowrap">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-muted">
                  <Icon className="size-4" />
                </span>
                <Input
                  value={names[s.id] ?? s.name}
                  onChange={(e) => setNames((n) => ({ ...n, [s.id]: e.target.value }))}
                  onBlur={() => void rename(s)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  aria-label="Nome do espaço"
                  className="min-w-0 flex-1"
                />
                <div className="w-36 shrink-0">
                  <Select value={s.kind} onChange={(e) => void updateSpace(s.id, { kind: e.target.value as SpaceKind })} aria-label="Tipo">
                    <option value="empresa">Empresa</option>
                    <option value="pessoal">Pessoal</option>
                  </Select>
                </div>
                <span className="w-24 shrink-0 text-right text-[11px] text-faint">{count} lançamentos</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setToDelete(s)}
                  disabled={spaces.length <= 1}
                  aria-label={`Apagar ${s.name}`}
                  title={spaces.length <= 1 ? 'Precisa ter pelo menos um espaço' : `Apagar ${s.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Novo espaço, ex.: Loja 2" className="flex-1" />
          <div className="sm:w-36">
            <Select value={newKind} onChange={(e) => setNewKind(e.target.value as SpaceKind)} aria-label="Tipo do novo espaço">
              <option value="empresa">Empresa</option>
              <option value="pessoal">Pessoal</option>
            </Select>
          </div>
          <Button variant="primary" icon={<Plus className="size-4" />} loading={busy} disabled={!newName.trim()} onClick={() => void add()}>
            Criar espaço
          </Button>
        </div>
      </CardBody>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Apagar ${toDelete?.name}?`}
        description="Apaga o espaço com TODOS os lançamentos, carteiras, contas fixas, metas e lembretes dele. Não dá para desfazer — exporte um backup antes."
        confirmLabel="Apagar espaço"
        danger
        onConfirm={async () => {
          if (!toDelete) return
          await deleteSpace(toDelete.id)
          toast.success('Espaço apagado', toDelete.name)
        }}
      />
    </Card>
  )
}
