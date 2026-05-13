import { serve } from '@upstash/workflow/nextjs'
import { campaignDb } from '@/lib/supabase-db'
import { supabase } from '@/lib/supabase'
import { CampaignStatus } from '@/types'
import { getUserFriendlyMessage } from '@/lib/whatsapp-errors'

interface Contact {
  phone: string
  name: string
}

interface CampaignWorkflowInput {
  campaignId: string
  templateName: string
  templateLanguage?: string
  templateComponents?: any[]
  contacts: Contact[]
  templateVariables?: string[]  // Static values for {{2}}, {{3}}, etc.
  phoneNumberId: string
  accessToken: string
}

/**
 * Build template components (Header, Body, Buttons) by mapping UI variables
 * to the correct parameters expected by Meta API.
 */
function buildMetaComponents(contactName: string, templateVariables: string[], templateComponents?: any[]): any[] {
  if (!templateComponents || templateComponents.length === 0) {
    // Fallback if no components were passed
    const parameters = [{ type: 'text', text: contactName || 'Cliente' }]
    for (const val of templateVariables) {
      parameters.push({ type: 'text', text: val || '' })
    }
    return [{ type: 'body', parameters }]
  }

  const resultComponents: any[] = []
  
  // Calculate how many body variables and build body parameters in order
  const bodyComponent = templateComponents.find(c => c.type === 'BODY')
  let bodyVarsCount = 0
  const bodyParameters: any[] = []
  
  if (bodyComponent?.text) {
    const matches = bodyComponent.text.match(/\{\{([^}]+)\}\}/g) || []
    matches.forEach((m: string) => {
      const varName = m.replace(/[{}]/g, '')
      const isNamed = isNaN(Number(varName))
      const isContactName = varName === '1' || varName.toLowerCase() === 'nome' || varName.toLowerCase() === 'cliente'
      
      const param: any = { type: 'text', text: isContactName ? (contactName || 'Cliente') : (templateVariables[bodyVarsCount] || '') }
      if (isNamed) param.parameter_name = varName
      
      bodyParameters.push(param)
      if (!isContactName) bodyVarsCount++
    })
  }

  if (bodyParameters.length > 0) {
    resultComponents.push({ type: 'body', parameters: bodyParameters })
  }

  // Header variables count
  const headerComponent = templateComponents.find(c => c.type === 'HEADER')
  let headerVarsCount = 0
  if (headerComponent?.format === 'TEXT' && headerComponent?.text) {
    const matches = headerComponent.text.match(/\{\{([^}]+)\}\}/g) || []
    
    if (matches.length > 0) {
      const headerParameters: any[] = []
      matches.forEach((m: string) => {
        const varName = m.replace(/[{}]/g, '')
        const isNamed = isNaN(Number(varName))
        const val = templateVariables[bodyVarsCount + headerVarsCount] || ''
        
        const param: any = { type: 'text', text: val }
        if (isNamed) param.parameter_name = varName
        
        headerParameters.push(param)
        headerVarsCount++
      })
      resultComponents.push({ type: 'header', parameters: headerParameters })
    }
  }

  // Build Button Parameters
  const buttonsComponent = templateComponents.find(c => c.type === 'BUTTONS')
  if (buttonsComponent?.buttons) {
    let buttonVarIndexOffset = bodyVarsCount + headerVarsCount
    buttonsComponent.buttons.forEach((button: any, btnIdx: number) => {
      if (button.type === 'URL' && button.url?.includes('{{')) {
        const matches = button.url.match(/\{\{([^}]+)\}\}/g) || []
        if (matches.length > 0) {
          const buttonParams: any[] = []
          matches.forEach((m: string) => {
            const varName = m.replace(/[{}]/g, '')
            const isNamed = isNaN(Number(varName))
            const param: any = {
              type: 'text',
              text: templateVariables[buttonVarIndexOffset++] || ''
            }
            if (isNamed) param.parameter_name = varName
            buttonParams.push(param)
          })
          resultComponents.push({
            type: 'button',
            sub_type: 'url',
            index: btnIdx.toString(),
            parameters: buttonParams
          })
        }
      }
    })
  }

  return resultComponents
}

// Update contact status in Turso
async function updateContactStatus(campaignId: string, phone: string, status: 'sent' | 'failed', messageId?: string, error?: string) {
  try {
    await supabase
      .from('campaign_contacts')
      .update({
        status,
        sent_at: new Date().toISOString(),
        message_id: messageId || null,
        error: error || null
      })
      .eq('campaign_id', campaignId)
      .eq('phone', phone)
  } catch (e) {
    console.error(`Failed to update contact status: ${phone}`, e)
  }
}

// Upstash Workflow - Durable background processing
// Each step is a separate HTTP request, bypasses Vercel 10s timeout
export const { POST } = serve<CampaignWorkflowInput>(
  async (context) => {
    const { campaignId, templateName, templateLanguage, templateComponents, contacts, templateVariables, phoneNumberId, accessToken } = context.requestPayload

    // Step 1: Mark campaign as SENDING in Turso
    await context.run('init-campaign', async () => {
      await campaignDb.updateStatus(campaignId, {
        status: CampaignStatus.SENDING,
        startedAt: new Date().toISOString()
      })

      console.log(`📊 Campaign ${campaignId} started with ${contacts.length} contacts`)
      console.log(`📝 Template variables: ${JSON.stringify(templateVariables || [])}`)
    })

    // Step 2: Process contacts in batches of 40
    // Each batch is a separate step = separate HTTP request = bypasses 10s limit
    const BATCH_SIZE = 40
    const batches: Contact[][] = []

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      batches.push(contacts.slice(i, i + BATCH_SIZE))
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]

      await context.run(`send-batch-${batchIndex}`, async () => {
        let sentCount = 0
        let failedCount = 0

        for (const contact of batch) {
          try {
            // Check if campaign is paused (via Supabase)
            const { data: campaignStatus } = await supabase
              .from('campaigns')
              .select('status')
              .eq('id', campaignId)
              .single()

            if (campaignStatus?.status === CampaignStatus.PAUSED) {
              console.log(`⏸️ Campaign ${campaignId} is paused, skipping remaining`)
              break
            }

            // Send message via WhatsApp Cloud API
            // Dynamically build components based on template blueprint
            const components = buildMetaComponents(contact.name, templateVariables || [], templateComponents)

            const response = await fetch(
              `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  to: contact.phone,
                  type: 'template',
                  template: {
                    name: templateName,
                    language: { code: templateLanguage || 'pt_BR' },
                    ...(components.length > 0 ? { components } : {}),
                  },
                }),
              }
            )

            const data = await response.json()

            if (response.ok && data.messages?.[0]?.id) {
              const messageId = data.messages[0].id

              // Update contact status in Supabase (stores message_id for webhook lookup)
              await updateContactStatus(campaignId, contact.phone, 'sent', messageId)

              sentCount++
              console.log(`✅ Sent to ${contact.phone}`)
            } else {
              // Extract error code and translate to Portuguese
              const errorCode = data.error?.code || 0
              const originalError = data.error?.message || 'Unknown error'
              const translatedError = getUserFriendlyMessage(errorCode) || originalError
              const errorWithCode = `(#${errorCode}) ${translatedError}`

              // Update contact status in Turso
              await updateContactStatus(campaignId, contact.phone, 'failed', undefined, errorWithCode)

              failedCount++
              console.log(`❌ Failed ${contact.phone}: ${errorWithCode}`)
            }

            // Small delay between messages (15ms ~ 66 msgs/sec)
            await new Promise(resolve => setTimeout(resolve, 15))

          } catch (error) {
            // Update contact status in Turso
            const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido'
            await updateContactStatus(campaignId, contact.phone, 'failed', undefined, errorMsg)
            failedCount++
            console.error(`❌ Error sending to ${contact.phone}:`, error)
          }
        }

        // Update stats in Supabase (source of truth)
        // Supabase Realtime will propagate changes to frontend
        const campaign = await campaignDb.getById(campaignId)
        if (campaign) {
          await campaignDb.updateStatus(campaignId, {
            sent: campaign.sent + sentCount,
            failed: campaign.failed + failedCount
          })
        }

        console.log(`📦 Batch ${batchIndex + 1}/${batches.length}: ${sentCount} sent, ${failedCount} failed`)
      })
    }

    // Step 3: Mark campaign as completed
    await context.run('complete-campaign', async () => {
      const campaign = await campaignDb.getById(campaignId)

      let finalStatus = CampaignStatus.COMPLETED
      if (campaign && campaign.failed === campaign.recipients && campaign.recipients > 0) {
        finalStatus = CampaignStatus.FAILED
      }

      await campaignDb.updateStatus(campaignId, {
        status: finalStatus,
        completedAt: new Date().toISOString()
      })

      console.log(`🎉 Campaign ${campaignId} completed!`)
    })
  },
  {
    baseUrl: process.env.NEXT_PUBLIC_APP_URL?.trim()
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}` : undefined)
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : undefined),
    retries: 3,
  }
)
