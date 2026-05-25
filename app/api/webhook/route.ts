import { NextRequest, NextResponse } from 'next/server'

/**
 * Webhook Endpoint — SmartZap EVO
 *
 * Simplified webhook handler. The Meta webhook verification (GET)
 * and status tracking (delivered/read/failed) have been removed
 * since we no longer use the Meta Cloud API.
 *
 * This endpoint is kept as a stub for future EVOlution API webhook
 * integration if needed (e.g., message status callbacks from EVO).
 */

// GET - Stub (no Meta verification needed)
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    engine: 'SmartZap EVO',
    message: 'Webhook endpoint active. EVOlution API webhooks can be configured here.'
  })
}

// POST - Receive incoming webhook events
// Can be configured in EVOlution API to receive message status updates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('📨 EVO Webhook received:', JSON.stringify(body).substring(0, 500))

    // TODO: Process EVOlution API webhook events here
    // Example events: message status updates, incoming messages, etc.
    // For now, just acknowledge receipt.

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
