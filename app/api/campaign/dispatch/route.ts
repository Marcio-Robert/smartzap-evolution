import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@upstash/workflow'
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials'
import { supabase } from '@/lib/supabase'
import { flowDb } from '@/lib/supabase-db'

import { ContactStatus } from '@/types'

interface DispatchContact {
  phone: string
  name: string
}

// Generate simple ID
const generateId = () => Math.random().toString(36).substr(2, 9)

// Trigger campaign dispatch workflow
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { campaignId, templateName, whatsappCredentials, templateVariables, flowId } = body
  let { contacts } = body

  // Get template variables from campaign if not provided directly
  let resolvedTemplateVariables: string[] = templateVariables || []
  if (!resolvedTemplateVariables.length) {
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select('template_variables')
      .eq('id', campaignId)
      .single()

    if (campaign && campaign.template_variables) {
      // Supabase JSONB columns return native JavaScript arrays, no JSON.parse needed
      if (Array.isArray(campaign.template_variables)) {
        resolvedTemplateVariables = campaign.template_variables
      } else if (typeof campaign.template_variables === 'string') {
        // Fallback for legacy string storage (should not happen with JSONB)
        try {
          resolvedTemplateVariables = JSON.parse(campaign.template_variables)
        } catch {
          console.error('[Dispatch] Failed to parse template_variables string:', campaign.template_variables)
          resolvedTemplateVariables = []
        }
      }
    }
    console.log(`[Dispatch] Loaded template_variables from database:`, resolvedTemplateVariables)
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

  // Get credentials: Body (if valid) > Redis > Env
  let phoneNumberId: string | undefined
  let accessToken: string | undefined

  // Try from body first (only if not masked)
  if (whatsappCredentials?.phoneNumberId &&
    whatsappCredentials?.accessToken &&
    !whatsappCredentials.accessToken.includes('***')) {
    phoneNumberId = whatsappCredentials.phoneNumberId
    accessToken = whatsappCredentials.accessToken
  }

  // Fallback to Redis credentials
  if (!phoneNumberId || !accessToken) {
    const redisCredentials = await getWhatsAppCredentials()
    if (redisCredentials) {
      phoneNumberId = redisCredentials.phoneNumberId
      accessToken = redisCredentials.accessToken
    }
  }

  // Final fallback to env vars
  if (!phoneNumberId) phoneNumberId = process.env.WHATSAPP_PHONE_ID
  if (!accessToken) accessToken = process.env.WHATSAPP_TOKEN

  if (!phoneNumberId || !accessToken) {
    return NextResponse.json(
      { error: 'Credenciais WhatsApp não configuradas. Configure em Configurações.' },
      { status: 401 }
    )
  }

  // =========================================================================
  // FLOW ENGINE DISPATCH (if flowId is provided)
  // =========================================================================

  // =========================================================================
  // FLOW ENGINE DISPATCH (Disabled in Template)
  // =========================================================================

  if (flowId) {
    console.log('[Dispatch] Flow Engine is disabled in this template. Using legacy workflow.')
    // Fallthrough to legacy workflow
  }

  // =========================================================================
  // LEGACY WORKFLOW DISPATCH (for template-based campaigns)
  // =========================================================================

  // Check if Upstash Workflow is configured
  if (!process.env.QSTASH_TOKEN) {
    return NextResponse.json(
      { error: 'Serviço de workflow não configurado. Configure QSTASH_TOKEN.' },
      { status: 503 }
    )
  }

  try {
    // Priority: NEXT_PUBLIC_APP_URL > VERCEL_PROJECT_PRODUCTION_URL > VERCEL_URL > localhost
    // VERCEL_PROJECT_PRODUCTION_URL is auto-set by Vercel to the production domain (stable)
    // VERCEL_URL changes with each deployment (not ideal for QStash callbacks)
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim())
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}` : null)
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : null)
      || 'http://localhost:3000'

    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')

    console.log(`[Dispatch] Triggering workflow at: ${baseUrl}/api/campaign/workflow`)
    console.log(`[Dispatch] Template variables: ${JSON.stringify(resolvedTemplateVariables)}`)
    console.log(`[Dispatch] Is localhost: ${isLocalhost}`)

    const workflowPayload = {
      campaignId,
      templateName,
      contacts: contacts as DispatchContact[],
      templateVariables: resolvedTemplateVariables,
      phoneNumberId,
      accessToken,
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
