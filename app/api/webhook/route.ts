import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * Webhook Endpoint — SmartZap EVO
 *
 * Recebe webhooks da EVOlution API (via n8n) para atualizar status das
 * mensagens enviadas pelas campanhas (delivered, read, failed).
 *
 * ─── Payload Real da Evolution API (v2) ───
 *
 * {
 *   "event": "messages.update",
 *   "instance": "Lais_Melo_1",
 *   "data": {
 *     "keyId": "3EB017363CD9B439D2A1A4",      ← ID da mensagem (salvo em campaign_contacts.message_id)
 *     "remoteJid": "55899...@s.whatsapp.net",
 *     "fromMe": true,
 *     "status": "DELIVERY_ACK",                 ← Status como STRING
 *     "instanceId": "e3a06817-...",
 *     "messageId": "cmprtuww400l8p24q88drsvyr"   ← ID interno da Evolution (não usado)
 *   }
 * }
 *
 * ─── Mapeamento de Status ───
 *
 *   SERVER_ACK   → ignorado (servidor recebeu, já marcado como 'sent' no disparo)
 *   DELIVERY_ACK → delivered (entregue ao destinatário)
 *   READ         → read (lido)
 *   PLAYED       → read (áudio/vídeo reproduzido)
 *   ERROR        → failed
 *   FAILED       → failed
 *
 * Também aceita status numérico (2=error, 3=sent, 4=delivered, 5=read)
 * para compatibilidade com outras versões da Evolution API.
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
 * Mapeia o status da Evolution API para o formato interno.
 * Aceita tanto strings (DELIVERY_ACK, READ, etc.) quanto números (3, 4, 5).
 */
function mapEvoStatus(rawStatus: unknown): StatusMapping | null {
  // Formato STRING — payload real da Evolution API v2
  if (typeof rawStatus === 'string') {
    const stringMap: Record<string, StatusMapping> = {
      // Status que atualizamos no banco:
      'DELIVERY_ACK': { newStatus: 'delivered', timestampField: 'delivered_at', counterField: 'delivered' },
      'READ':         { newStatus: 'read',      timestampField: 'read_at',      counterField: 'read' },
      'PLAYED':       { newStatus: 'read',      timestampField: 'read_at',      counterField: 'read' },
      'ERROR':        { newStatus: 'failed',    timestampField: 'failed_at',    counterField: 'failed' },
      'FAILED':       { newStatus: 'failed',    timestampField: 'failed_at',    counterField: 'failed' },
      // Status que IGNORAMOS (já tratado no disparo):
      'SERVER_ACK':   { newStatus: 'sent',      timestampField: 'sent_at',      counterField: 'sent' },
    }
    return stringMap[rawStatus.toUpperCase()] ?? null
  }

  // Formato NUMÉRICO — compatibilidade com versões alternativas
  if (typeof rawStatus === 'number') {
    const numericMap: Record<number, StatusMapping> = {
      2: { newStatus: 'failed',    timestampField: 'failed_at',    counterField: 'failed' },
      3: { newStatus: 'sent',      timestampField: 'sent_at',      counterField: 'sent' },
      4: { newStatus: 'delivered',  timestampField: 'delivered_at', counterField: 'delivered' },
      5: { newStatus: 'read',      timestampField: 'read_at',      counterField: 'read' },
    }
    return numericMap[rawStatus] ?? null
  }

  return null
}

/**
 * Extrai o message ID do item de update.
 * A Evolution API usa diferentes estruturas dependendo da versão:
 *   - v2 real:  data.keyId (string plana)
 *   - v2 docs:  data.key.id (objeto aninhado)
 *   - fallback: data.id
 */
function extractMessageId(item: Record<string, unknown>): string | null {
  // Formato real da Evolution API v2 — data.keyId
  if (typeof item.keyId === 'string' && item.keyId) {
    return item.keyId
  }

  // Formato documentação — data.key.id
  const key = item.key as Record<string, unknown> | undefined
  if (key && typeof key.id === 'string' && key.id) {
    return key.id
  }

  // Fallback genérico
  if (typeof item.id === 'string' && item.id) {
    return item.id
  }

  return null
}

/**
 * Extrai o status do item de update.
 * Tenta múltiplos caminhos no objeto:
 *   - data.status (formato real)
 *   - data.update.status (formato documentação)
 */
function extractStatus(item: Record<string, unknown>): unknown {
  // Formato real — data.status (string direta)
  if (item.status !== undefined && item.status !== null) {
    return item.status
  }

  // Formato documentação — data.update.status
  const update = item.update as Record<string, unknown> | undefined
  if (update && update.status !== undefined && update.status !== null) {
    return update.status
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

// POST - Recebe eventos de status da Evolution API (via n8n)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('📨 EVO Webhook received:', JSON.stringify(body).substring(0, 800))

    // =========================================================================
    // Evento: messages.update — Atualização de status de mensagem
    // =========================================================================
    if (body.event === 'messages.update') {
      // A Evolution API pode enviar `data` como objeto plano ou array
      const items: Record<string, unknown>[] = Array.isArray(body.data)
        ? body.data
        : (body.data ? [body.data] : [])

      let processedCount = 0

      for (const item of items) {
        if (!item) continue

        // ─── Extrair messageId ───
        const messageId = extractMessageId(item)
        if (!messageId) {
          console.log('⚠️ Webhook item sem message_id, ignorando. Keys:', Object.keys(item).join(', '))
          continue
        }

        // ─── Extrair status ───
        const rawStatus = extractStatus(item)
        if (rawStatus === null) {
          console.log(`⚠️ Webhook item sem status para keyId: ${messageId}. Keys:`, Object.keys(item).join(', '))
          continue
        }

        // ─── Mapear status ───
        const mapping = mapEvoStatus(rawStatus)
        if (!mapping) {
          console.log(`⚠️ Status não mapeado: "${rawStatus}" (tipo: ${typeof rawStatus}) para keyId: ${messageId}`)
          continue
        }

        // Ignora SERVER_ACK / sent (3) — o workflow já marca como sent no momento do envio
        if (mapping.newStatus === 'sent') {
          console.log(`⏭️ Ignorando SERVER_ACK para keyId: ${messageId} (já marcado como sent)`)
          continue
        }

        console.log(`📬 Status update: keyId=${messageId} → ${mapping.newStatus} (raw: ${rawStatus})`)

        // ─── Atualizar campaign_contacts ───
        const { data: contactData, error: updateError } = await supabase
          .from('campaign_contacts')
          .update({
            status: mapping.newStatus,
            [mapping.timestampField]: new Date().toISOString()
          })
          .eq('message_id', messageId)
          .select('campaign_id')

        if (updateError) {
          console.error(`❌ Erro ao atualizar campaign_contacts para keyId ${messageId}:`, updateError)
          continue
        }

        if (!contactData || contactData.length === 0) {
          console.log(`ℹ️ keyId ${messageId} não encontrado em campaign_contacts (pode ser mensagem fora de campanha)`)
          continue
        }

        processedCount++

        // ─── Atualizar contador da campanha ───
        const campaignId = contactData[0].campaign_id
        if (campaignId) {
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

      console.log(`✅ Webhook processado: ${processedCount} status atualizados`)
    }

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('❌ Error processing webhook:', error)
    // Retorna 200 mesmo em caso de erro para evitar retry storms da Evolution API
    return NextResponse.json({ status: 'error', message: 'Webhook processing failed' }, { status: 200 })
  }
}
