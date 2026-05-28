import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * Webhook Endpoint — SmartZap EVO
 *
 * Processa webhooks da EVOlution API.
 */

// GET - Verificação
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    engine: 'SmartZap EVO',
    message: 'Webhook endpoint active. EVOlution API webhooks can be configured here.'
  })
}

// POST - Receive incoming webhook events
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('📨 EVO Webhook received:', JSON.stringify(body).substring(0, 500))

    if (body.event === 'messages.update' && Array.isArray(body.data)) {
      for (const item of body.data) {
        const messageId = item.key?.id
        const updateStatus = item.update?.status

        if (!messageId || !updateStatus) continue

        let newStatus = ''
        let timestampField = ''

        if (updateStatus === 'DELIVERY_ACK') {
          newStatus = 'delivered'
          timestampField = 'delivered_at'
        } else if (updateStatus === 'READ' || updateStatus === 'PLAYED') {
          newStatus = 'read'
          timestampField = 'read_at'
        } else if (updateStatus === 'ERROR') {
          newStatus = 'failed'
          timestampField = 'failed_at'
        }

        if (newStatus) {
          // Atualiza status do contato
          const { data: contactData } = await supabase
            .from('campaign_contacts')
            .update({
              status: newStatus,
              [timestampField]: new Date().toISOString()
            })
            .eq('message_id', messageId)
            .select('campaign_id')
            .single()

          // Atualiza contadores da campanha
          if (contactData?.campaign_id) {
            const campaignId = contactData.campaign_id
            if (newStatus === 'delivered') {
              await supabase.rpc('increment_campaign_stat', { cid: campaignId, stat_col: 'delivered' })
            } else if (newStatus === 'read') {
              await supabase.rpc('increment_campaign_stat', { cid: campaignId, stat_col: 'read' })
            } else if (newStatus === 'failed') {
              await supabase.rpc('increment_campaign_stat', { cid: campaignId, stat_col: 'failed' })
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
