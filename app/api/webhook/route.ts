import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * Webhook Endpoint — SmartZap EVO
 *
 * Recebe webhooks da EVOlution API para atualizar status das mensagens
 * enviadas pelas campanhas (delivered, read, failed).
 *
 * A Evolution API envia o evento `messages.update` com status NUMÉRICO:
 *   2 → ERROR (falha)
 *   3 → DELIVERY_ACK (enviado/servidor recebeu)
 *   4 → DELIVERED (entregue ao destinatário)
 *   5 → READ (lido)
 *
 * Também aceita o formato string legado (DELIVERY_ACK, READ, etc.)
 * para compatibilidade com versões anteriores ou outros providers.
 */

// =============================================================================
// STATUS MAPPING
// =============================================================================

interface StatusMapping {
  newStatus: string
  timestampField: string
  counterField: string
}

/**
 * Mapeia o status da Evolution API (numérico ou string) para o formato interno.
 */
function mapEvoStatus(rawStatus: unknown): StatusMapping | null {
  // Evolution API v2 envia números
  if (typeof rawStatus === 'number') {
    const numericMap: Record<number, StatusMapping> = {
      2: { newStatus: 'failed',    timestampField: 'failed_at',    counterField: 'failed' },
      3: { newStatus: 'sent',      timestampField: 'sent_at',      counterField: 'sent' },
      4: { newStatus: 'delivered',  timestampField: 'delivered_at', counterField: 'delivered' },
      5: { newStatus: 'read',      timestampField: 'read_at',      counterField: 'read' },
    }
    return numericMap[rawStatus] ?? null
  }

  // Formato string legado (Z-API / Meta Cloud API / algumas versões Evolution)
  if (typeof rawStatus === 'string') {
    const stringMap: Record<string, StatusMapping> = {
      'DELIVERY_ACK': { newStatus: 'delivered', timestampField: 'delivered_at', counterField: 'delivered' },
      'READ':         { newStatus: 'read',      timestampField: 'read_at',      counterField: 'read' },
      'PLAYED':       { newStatus: 'read',      timestampField: 'read_at',      counterField: 'read' },
      'ERROR':        { newStatus: 'failed',    timestampField: 'failed_at',    counterField: 'failed' },
      'FAILED':       { newStatus: 'failed',    timestampField: 'failed_at',    counterField: 'failed' },
    }
    return stringMap[rawStatus.toUpperCase()] ?? null
  }

  return null
}

// =============================================================================
// HANDLERS
// =============================================================================

// GET - Verificação de saúde do endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    engine: 'SmartZap EVO',
    message: 'Webhook endpoint active. EVOlution API webhooks can be configured here.'
  })
}

// POST - Recebe eventos de status da Evolution API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('📨 EVO Webhook received:', JSON.stringify(body).substring(0, 500))

    // =========================================================================
    // Evento: messages.update — Atualização de status de mensagem
    // =========================================================================
    if (body.event === 'messages.update') {
      // A Evolution API pode enviar os dados como array ou objeto único
      const updates = Array.isArray(body.data) ? body.data : [body.data]

      for (const item of updates) {
        if (!item) continue

        const messageId = item.key?.id
        const rawStatus = item.update?.status ?? item.status

        if (!messageId) {
          console.log('⚠️ Webhook item sem message_id, ignorando')
          continue
        }

        if (rawStatus === undefined || rawStatus === null) {
          console.log(`⚠️ Webhook item sem status para messageId: ${messageId}`)
          continue
        }

        const mapping = mapEvoStatus(rawStatus)
        if (!mapping) {
          console.log(`⚠️ Status não mapeado: ${rawStatus} (tipo: ${typeof rawStatus}) para messageId: ${messageId}`)
          continue
        }

        // Ignora status 'sent' (3) — o workflow já marca como sent no momento do envio
        if (mapping.newStatus === 'sent') {
          continue
        }

        console.log(`📬 Status update: messageId=${messageId} → ${mapping.newStatus} (raw: ${rawStatus})`)

        // Atualiza o status do contato na campaign_contacts
        const { data: contactData, error: updateError } = await supabase
          .from('campaign_contacts')
          .update({
            status: mapping.newStatus,
            [mapping.timestampField]: new Date().toISOString()
          })
          .eq('message_id', messageId)
          .select('campaign_id')

        if (updateError) {
          console.error(`❌ Erro ao atualizar campaign_contacts para messageId ${messageId}:`, updateError)
          continue
        }

        if (!contactData || contactData.length === 0) {
          // Mensagem não encontrada — pode ser de outra fonte (chatbot, mensagem manual)
          console.log(`ℹ️ messageId ${messageId} não encontrado em campaign_contacts (pode ser mensagem fora de campanha)`)
          continue
        }

        // Atualiza o contador da campanha diretamente
        const campaignId = contactData[0].campaign_id
        if (campaignId) {
          // Busca valores atuais e incrementa o campo correspondente
          const { data: campaign } = await supabase
            .from('campaigns')
            .select('delivered, read, failed')
            .eq('id', campaignId)
            .single()

          if (campaign) {
            const currentValue = (campaign as Record<string, number>)[mapping.counterField] || 0
            const { error: campaignError } = await supabase
              .from('campaigns')
              .update({
                [mapping.counterField]: currentValue + 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', campaignId)

            if (campaignError) {
              console.error(`❌ Erro ao atualizar contador ${mapping.counterField} da campanha ${campaignId}:`, campaignError)
            } else {
              console.log(`📊 Campanha ${campaignId}: ${mapping.counterField} → ${currentValue + 1}`)
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('❌ Error processing webhook:', error)
    // Retorna 200 mesmo em caso de erro para evitar retry storms da Evolution API
    return NextResponse.json({ status: 'error', message: 'Webhook processing failed' }, { status: 200 })
  }
}
