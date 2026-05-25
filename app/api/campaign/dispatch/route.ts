import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@upstash/workflow'
import { isEvoConfigured } from '@/lib/evo-client'
import { supabase } from '@/lib/supabase'

interface DispatchContact {
  phone: string
  name: string
}

// Generate simple ID
const generateId = () => Math.random().toString(36).substr(2, 9)

// Trigger campaign dispatch workflow
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { campaignId, campaignText, scheduledAt } = body
  let { contacts } = body

  // Validate EVO configuration
  if (!isEvoConfigured()) {
    return NextResponse.json(
      { error: 'EVOlution API não configurada. Defina EVO_API_URL, EVO_API_KEY e EVO_INSTANCE_NAME no .env.' },
      { status: 401 }
    )
  }

  // Validate campaign text
  if (!campaignText || typeof campaignText !== 'string' || campaignText.trim().length === 0) {
    return NextResponse.json(
      { error: 'Texto da campanha é obrigatório.' },
      { status: 400 }
    )
  }

  // If no contacts provided, fetch from campaign_contacts (for cloned/scheduled campaigns)
  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    const { data: existingContacts, error } = await supabase
      .from('campaign_contacts')
      .select('phone, name')
      .eq('campaign_id', campaignId)

    if (error) {
      console.error('Failed to fetch existing contacts:', error)
      return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 })
    }

    if (!existingContacts || existingContacts.length === 0) {
      return NextResponse.json({ error: 'No contacts found for campaign' }, { status: 400 })
    }

    contacts = existingContacts.map(row => ({
      phone: row.phone as string,
      name: (row.name as string) || ''
    }))

    console.log(`[Dispatch] Loaded ${contacts.length} contacts from database for campaign ${campaignId}`)
  } else {
    // Save contacts to campaign_contacts table in Supabase (Bulk Upsert)
    try {
      const dbContacts = (contacts as DispatchContact[]).map(c => ({
        id: generateId(),
        campaign_id: campaignId,
        phone: c.phone,
        name: c.name || '',
        status: 'pending'
      }))

      const { error } = await supabase
        .from('campaign_contacts')
        .upsert(dbContacts, { onConflict: 'campaign_id, phone' })

      if (error) throw error

      console.log(`[Dispatch] Saved ${contacts.length} contacts for campaign ${campaignId}`)
    } catch (error) {
      console.error('Failed to save campaign contacts:', error)
    }
  }

  // Check if Upstash Workflow is configured
  if (!process.env.QSTASH_TOKEN) {
    return NextResponse.json(
      { error: 'Serviço de workflow não configurado. Configure QSTASH_TOKEN.' },
      { status: 503 }
    )
  }

  try {
    // Priority: NEXT_PUBLIC_APP_URL > VERCEL_PROJECT_PRODUCTION_URL > VERCEL_URL > localhost
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim())
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}` : null)
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : null)
      || 'http://localhost:3000'

    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')

    console.log(`[Dispatch] Triggering workflow at: ${baseUrl}/api/campaign/workflow`)
    console.log(`[Dispatch] Campaign text: "${campaignText.substring(0, 60)}..."`)
    console.log(`[Dispatch] Is localhost: ${isLocalhost}`)

    const workflowPayload = {
      campaignId,
      campaignText,
      contacts: contacts as DispatchContact[],
      scheduledAt,
      // EVO credentials are read from process.env in the workflow (not transmitted)
    }

    if (isLocalhost) {
      // DEV: Call workflow endpoint directly (QStash can't reach localhost)
      console.log('[Dispatch] Localhost detected - calling workflow directly (bypassing QStash)')

      const response = await fetch(`${baseUrl}/api/campaign/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowPayload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Workflow failed with status ${response.status}`)
      }
    } else {
      // PROD: Use QStash for reliable async execution
      const workflowClient = new Client({ token: process.env.QSTASH_TOKEN })
      await workflowClient.trigger({
        url: `${baseUrl}/api/campaign/workflow`,
        body: workflowPayload,
      })
    }

    return NextResponse.json({
      status: 'queued',
      count: contacts.length,
      message: `${contacts.length} mensagens enfileiradas com sucesso`
    }, { status: 202 })

  } catch (error) {
    console.error('Error triggering workflow:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error: 'Falha ao iniciar workflow da campanha',
        details: errorMessage,
        baseUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'not-set'
      },
      { status: 500 }
    )
  }
}
