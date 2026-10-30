import { useEffect } from 'react'
import { Check, Palette, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Toggle } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { Logo } from '@/components/brand/Logo'
import {
  ACCENTS,
  DEFAULT_PREFS,
  FONTS,
  THEMES,
  ensureFont,
  usePrefs,
  type Accent,
  type BackgroundId,
  type FontId,
  type FontScale,
  type PanelId,
  type RadiusId,
  type ThemeId,
} from '@/context/PrefsContext'
import { useSpaces } from '@/context/SpacesContext'
import { useAccess } from '@/context/AccessContext'
import { useToast } from '@/components/ui/Toast'
import { provider } from '@/services/database'
import { cn } from '@/utils/cn'

export default function Customize() {
  const { prefs, update, reset } = usePrefs()
  const { spaces } = useSpaces()
  const { isAdmin } = useAccess()
  const toast = useToast()
  const synced = provider.name === 'supabase'
  const customOn = /^#[0-9a-f]{6}$/i.test(prefs.accentCustom)

  // para mostrar cada fonte com o seu próprio desenho
  useEffect(() => {
    ;(Object.keys(FONTS) as FontId[]).forEach(ensureFont)
  }, [])

  const toggleSpace = (id: string, visible: boolean) =>
    update({ hiddenSpaces: visible ? prefs.hiddenSpaces.filter((s) => s !== id) : [...new Set([...prefs.hiddenSpaces, id])] })

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Palette className="size-3.5" /> Sistema
          </>
        }
        title="Personalizar"
        description={
          synced
            ? 'Deixe o sistema com a sua cara. Fica salvo na sua conta e vale em todos os seus aparelhos.'
            : 'Deixe o sistema com a sua cara. Fica salvo neste aparelho.'
        }
        actions={
          <Button
            variant="ghost"
            icon={<RotateCcw className="size-4" />}
            onClick={() => {
              reset()
              toast.success('Voltou ao padrão')
            }}
          >
            Voltar ao padrão
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader eyebrow="Aparência" title="Tema" />
          <CardBody>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {(Object.keys(THEMES) as ThemeId[]).map((id) => {
                const t = THEMES[id]
                const on = prefs.theme === id
                const [hi] = ACCENTS[t.accent].colors
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => update({ theme: id, accent: t.accent, accentCustom: '' })}
                    aria-pressed={on}
                    className={cn(
                      'rounded-2xl border p-2 text-left transition',
                      on ? 'border-accent' : 'border-line hover:border-line-strong',
                    )}
                  >
                    <span
                      className="relative flex h-20 overflow-hidden rounded-xl border border-white/10"
                      style={{ background: t.vars.void }}
                      aria-hidden
                    >
                      <span className="w-5 shrink-0" style={{ background: t.vars.ink }} />
                      <span className="m-2 flex flex-1 flex-col justify-between rounded-lg p-1.5" style={{ background: t.vars.surface, border: `1px solid ${t.vars.elevated}` }}>
                        <span className="block h-1.5 w-2/3 rounded-full" style={{ background: t.vars.fg }} />
                        <span className="block h-1 w-1/2 rounded-full" style={{ background: t.vars.muted }} />
                        <span className="block h-2 w-5 rounded-full" style={{ background: hi }} />
                      </span>
                      {on && (
                        <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-accent text-accent-ink">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className="mt-2 block px-1 text-sm font-medium text-fg">{t.label}</span>
                    <span className="block px-1 pb-1 text-xs text-muted">{t.tag}</span>
                  </button>
                )
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader eyebrow="Aparência" title="Cor de destaque" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3">
              {(Object.keys(ACCENTS) as Accent[]).map((id) => {
                const [hi, lo, ink] = ACCENTS[id].colors
                const on = !customOn && prefs.accent === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => update({ accent: id, accentCustom: '' })}
                    aria-pressed={on}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-2xl border p-3 text-xs transition',
                      on ? 'border-accent text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
                    )}
                  >
                    <span
                      className="grid size-10 place-items-center rounded-full shadow-inner"
                      style={{ background: `linear-gradient(160deg, ${hi}, ${lo})`, color: ink }}
                    >
                      {on && <Check className="size-4" strokeWidth={3} />}
                    </span>
                    {ACCENTS[id].label}
                  </button>
                )
              })}
              <label
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-3 text-xs transition focus-within:ring-1 focus-within:ring-white/40',
                  customOn ? 'border-accent text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
                )}
              >
                <span
                  className="grid size-10 place-items-center rounded-full shadow-inner"
                  style={{
                    background: customOn
                      ? prefs.accentCustom
                      : 'conic-gradient(from 0deg, #ff6b6b, #ffd166, #7bd88f, #4cc9f0, #9b7bff, #ff6b6b)',
                  }}
                >
                  {customOn && <Check className="size-4 text-white mix-blend-difference" strokeWidth={3} />}
                </span>
                Outra cor
                <input
                  type="color"
                  aria-label="Escolher outra cor de destaque"
                  value={customOn ? prefs.accentCustom : '#c9c9ce'}
                  onChange={(e) => update({ accentCustom: e.target.value })}
                  className="sr-only"
                />
              </label>
            </div>
            <p className="text-xs text-faint">Ao escolher um tema, a cor combinando já vem junto. Dá para trocar depois.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader eyebrow="Aparência" title="Estilo" />
          <CardBody className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Tipo de letra</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(FONTS) as FontId[]).map((id) => {
                  const on = prefs.font === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => update({ font: id })}
                      aria-pressed={on}
                      className={cn(
                        'rounded-xl border px-2 py-2.5 text-center transition',
                        on ? 'border-accent text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
                      )}
                    >
                      <span className="block text-xl leading-none" style={{ fontFamily: FONTS[id].stack }}>
                        Aa
                      </span>
                      <span className="mt-1.5 block text-[11px]">{FONTS[id].label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Tamanho da letra</p>
              <Segmented<FontScale>
                value={prefs.fontScale}
                onChange={(fontScale) => update({ fontScale })}
                options={[
                  { value: 'normal', label: 'Normal' },
                  { value: 'grande', label: 'Grande' },
                  { value: 'maior', label: 'Maior' },
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Cantos</p>
              <Segmented<RadiusId>
                value={prefs.radius}
                onChange={(radius) => update({ radius })}
                options={[
                  { value: 'reto', label: 'Retos' },
                  { value: 'normal', label: 'Suaves' },
                  { value: 'redondo', label: 'Redondos' },
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Fundo</p>
              <Segmented<BackgroundId>
                value={prefs.background}
                onChange={(background) => update({ background })}
                options={[
                  { value: 'liso', label: 'Liso' },
                  { value: 'grade', label: 'Grade' },
                  { value: 'pontos', label: 'Pontos' },
                  { value: 'aurora', label: 'Aurora' },
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Cartões</p>
              <Segmented<PanelId>
                value={prefs.panel}
                onChange={(panel) => update({ panel })}
                options={[
                  { value: 'vidro', label: 'Vidro' },
                  { value: 'solido', label: 'Sólido' },
                  { value: 'contorno', label: 'Contorno' },
                  { value: 'brilho', label: 'Brilho' },
                ]}
              />
            </div>
            <div className="panel space-y-3 p-4">
              <p className="eyebrow">Prévia</p>
              <p className="text-lg font-semibold text-fg">Título de exemplo</p>
              <p className="text-sm text-muted">Assim ficam textos, botões e cartões com as suas escolhas.</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="primary">
                  Botão
                </Button>
                <span className="chip chip-on">Selecionado</span>
                <span className="chip">Normal</span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader eyebrow="Nome" title="Nome do sistema" />
          <CardBody className="space-y-4">
            <div className="rounded-2xl border border-line bg-ink p-4">
              <Logo />
            </div>
            <FormField label="Nome" hint="aparece no menu e na aba">
              <Input value={prefs.appName} maxLength={24} onChange={(e) => update({ appName: e.target.value })} placeholder={DEFAULT_PREFS.appName} />
            </FormField>
            <FormField label="Embaixo do nome" hint="opcional">
              <Input value={prefs.appTagline} maxLength={32} onChange={(e) => update({ appTagline: e.target.value })} placeholder="Ex.: Marcenaria Silva" />
            </FormField>
          </CardBody>
        </Card>

        <Card>
          <CardHeader eyebrow="Ao abrir" title="Página inicial" />
          <CardBody className="space-y-4">
            <FormField label="Quando entrar no sistema, abrir">
              <Select value={prefs.homePage} onChange={(e) => update({ homePage: e.target.value })}>
                <option value="/geral">Visão geral</option>
                {isAdmin && <option value="/">Zenn Works</option>}
                {spaces.map((s) => (
                  <option key={s.id} value={`/e/${s.id}`}>
                    {s.name}
                  </option>
                ))}
                {spaces.map((s) => (
                  <option key={`${s.id}-contas`} value={`/e/${s.id}/contas`}>
                    {s.name} · Contas a pagar
                  </option>
                ))}
              </Select>
            </FormField>
            <Toggle
              checked={prefs.startHidden}
              onChange={(startHidden) => update({ startHidden })}
              label="Abrir com os valores escondidos"
              description="Bom para abrir o app perto de outras pessoas (o olho no topo mostra)"
            />
            <Toggle
              checked={prefs.reduceMotion}
              onChange={(reduceMotion) => update({ reduceMotion })}
              label="Menos animações"
              description="Telas aparecem na hora, sem efeitos"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader eyebrow="Menu" title="O que aparece no menu" />
          <CardBody className="space-y-2">
            {isAdmin && (
              <Toggle
                checked={!prefs.hideZenn}
                onChange={(v) => update({ hideZenn: !v })}
                label="Zenn Works"
                description="Leads, clientes, projetos e financeiro da agência"
              />
            )}
            {spaces.map((s) => (
              <Toggle
                key={s.id}
                checked={!prefs.hiddenSpaces.includes(s.id)}
                onChange={(v) => toggleSpace(s.id, v)}
                label={s.name}
                description={s.kind === 'empresa' ? 'Empresa' : 'Pessoal'}
              />
            ))}
            <p className="pt-2 text-xs text-faint">Esconder só tira do menu: nada é apagado e dá para mostrar de novo aqui.</p>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader eyebrow="Orçamentos e recibos" title="Dados da empresa" />
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <p className="text-sm text-muted sm:col-span-2">Saem no cabeçalho do orçamento e do recibo que você imprime ou manda para o cliente.</p>
            <FormField label="Nome da empresa">
              <Input value={prefs.businessName} onChange={(e) => update({ businessName: e.target.value })} placeholder="Ex.: Marcenaria Silva" />
            </FormField>
            <FormField label="Telefone / WhatsApp">
              <Input value={prefs.businessPhone} onChange={(e) => update({ businessPhone: e.target.value })} placeholder="(11) 99999-0000" inputMode="tel" />
            </FormField>
            <FormField label="Cidade">
              <Input value={prefs.businessCity} onChange={(e) => update({ businessCity: e.target.value })} placeholder="Ex.: Campinas - SP" />
            </FormField>
            <FormField label="CNPJ ou CPF" hint="opcional">
              <Input value={prefs.businessDoc} onChange={(e) => update({ businessDoc: e.target.value })} placeholder="00.000.000/0001-00" />
            </FormField>
            <FormField label="WhatsApp de quem recebe o resumo da semana" hint="ex.: seu pai" className="sm:col-span-2">
              <Input value={prefs.reportPhone} onChange={(e) => update({ reportPhone: e.target.value })} placeholder="(11) 99999-0000" inputMode="tel" />
            </FormField>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
