// Fluxo compartilhado de ações sobre leads/resultados de busca:
// SALVAR · CONTATAR · CONVERTER — usado em Prospecção, Leads e no drawer.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lead, PlaceResult } from '@/types'
import { useData } from '@/context/DataContext'
import { useToast } from '@/components/ui/Toast'
import { ContactModal } from '@/components/leads/ContactModal'
import { ConvertModal } from '@/components/leads/ConvertModal'

export type LeadTarget = Lead | PlaceResult

export const isSavedLead = (t: LeadTarget): t is Lead => 'status' in t

export function useLeadWorkflow() {
  const data = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const [contactTarget, setContactTarget] = useState<LeadTarget | null>(null)
  const [convertTarget, setConvertTarget] = useState<LeadTarget | null>(null)

  const resolveLead = async (t: LeadTarget): Promise<Lead> => {
    if (isSavedLead(t)) return t
    return data.findLeadByPlace(t.placeId) ?? data.saveLeadFromPlace(t)
  }

  const save = async (t: LeadTarget) => {
    if (!isSavedLead(t) && data.findLeadByPlace(t.placeId)) {
      toast.info('Lead já salvo', t.name)
      return data.findLeadByPlace(t.placeId)!
    }
    const lead = await resolveLead(t)
    toast.success('Lead salvo no CRM', lead.name)
    return lead
  }

  const modals = (
    <>
      <ContactModal
        open={!!contactTarget}
        target={contactTarget}
        onClose={() => setContactTarget(null)}
        onContact={async (channel) => {
          if (!contactTarget) return
          const lead = await resolveLead(contactTarget)
          await data.registerContact(lead.id, channel)
        }}
      />
      <ConvertModal
        open={!!convertTarget}
        companyName={convertTarget?.name ?? ''}
        onClose={() => setConvertTarget(null)}
        onConfirm={async (input) => {
          if (!convertTarget) return
          try {
            const lead = await resolveLead(convertTarget)
            const client = await data.convertLeadToClient(lead.id, {
              contactName: input.contactName,
              email: input.email || null,
              contractedValue: input.contractedValue,
            })
            toast.success('Lead convertido em cliente', client.company)
            navigate(`/clientes/${client.id}`)
          } catch (e) {
            toast.error('Falha na conversão', e instanceof Error ? e.message : undefined)
          }
        }}
      />
    </>
  )

  return {
    save,
    contact: (t: LeadTarget) => setContactTarget(t),
    convert: async (t: LeadTarget) => {
      const existing = isSavedLead(t) ? t : data.findLeadByPlace(t.placeId)
      if (existing?.clientId) {
        navigate(`/clientes/${existing.clientId}`)
        return
      }
      setConvertTarget(t)
    },
    modals,
  }
}
