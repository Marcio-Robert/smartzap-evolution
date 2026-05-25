import { serve } from '@upstash/workflow/nextjs'
import { campaignDb } from '@/lib/supabase-db'
import { supabase } from '@/lib/supabase'
import { CampaignStatus } from '@/types'
import { getEvoConfig, sendText, randomDelay, formatDelay } from '@/lib/evo-client'
import type { EvoConfig } from '@/lib/evo-client'

interface Contact {
  phone: string
  name: string
}

interface CampaignWorkflowInput {
  campaignId: string
  campaignText: string       // Texto livre da campanha
  contacts: Contact[]
  scheduledAt?: string
}

// Update contact status in Supabase
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
    const { campaignId, campaignText, contacts, scheduledAt } = context.requestPayload

    // Step 0: If scheduled, wait until the scheduled time
    if (scheduledAt) {
      await context.sleepUntil('wait-for-schedule', new Date(scheduledAt))

      // Verify campaign wasn't started manually or cancelled while sleeping
      const shouldProceed = await context.run('verify-status', async () => {
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('status')
          .eq('id', campaignId)
          .single()

        return campaign?.status === CampaignStatus.SCHEDULED
      })

      if (!shouldProceed) {
        console.log(`Workflow aborted: Campaign ${campaignId} is no longer scheduled.`)
        return
      }
    }

    // Step 1: Validate EVO config and mark campaign as SENDING
    const evoConfig = await context.run('init-campaign', async () => {
      const config = getEvoConfig()
      if (!config) {
        throw new Error('EVOlution API não configurada. Defina EVO_API_URL, EVO_API_KEY e EVO_INSTANCE_NAME.')
      }

      await campaignDb.updateStatus(campaignId, {
        status: CampaignStatus.SENDING,
        startedAt: new Date().toISOString()
      })

      console.log(`📊 Campaign ${campaignId} started with ${contacts.length} contacts`)
      console.log(`📝 Campaign text: "${campaignText.substring(0, 80)}..."`)

      return config
    })

    // Step 2: Process contacts in batches of 10
    // Smaller batches = more checkpoints = more resilient
    const BATCH_SIZE = 10
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

            // ============================================
            // ANTI-BAN DELAY (15-35 seconds between sends)
            // ============================================
            if (sentCount > 0 || batchIndex > 0) {
              const delayMs = await randomDelay()
              console.log(`⏳ Anti-ban delay: ${formatDelay(delayMs)}`)
            }

            // ============================================
            // SEND MESSAGE VIA EVOLUTION API
            // ============================================
            // Personalizar texto: substituir {{nome}} pelo nome do contato
            let personalizedText = campaignText
            const contactName = contact.name || 'Cliente'
            personalizedText = personalizedText
              .replace(/\{\{nome\}\}/gi, contactName)
              .replace(/\{\{name\}\}/gi, contactName)
              .replace(/\{\{1\}\}/g, contactName)

            const result = await sendText(
              evoConfig as EvoConfig,
              {
                number: contact.phone,
                text: personalizedText,
                delay: 1200,
                linkPreview: true,
              }
            )

            if (result.success) {
              // Update contact status in Supabase
              await updateContactStatus(campaignId, contact.phone, 'sent', result.messageId)

              sentCount++
              console.log(`✅ Sent to ${contact.phone} (msgId: ${result.messageId})`)

              // ============================================
              // WEBHOOK LOGGER — Ponte com n8n / CRM Flow89
              // ============================================
              if (process.env.N8N_WEBHOOK_LOGGER_URL) {
                fetch(process.env.N8N_WEBHOOK_LOGGER_URL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    telefone: contact.phone,
                    texto_campanha: personalizedText,
                    tipo: 'texto_livre'
                  })
                }).catch(() => {
                  // Catch silencioso garantindo a integridade do fluxo principal
                })
              }
            } else {
              // Update contact status with error
              await updateContactStatus(campaignId, contact.phone, 'failed', undefined, result.error)

              failedCount++
              console.log(`❌ Failed ${contact.phone}: ${result.error}`)
            }

          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido'
            await updateContactStatus(campaignId, contact.phone, 'failed', undefined, errorMsg)
            failedCount++
            console.error(`❌ Error sending to ${contact.phone}:`, error)
          }
        }

        // Update stats in Supabase (source of truth)
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
