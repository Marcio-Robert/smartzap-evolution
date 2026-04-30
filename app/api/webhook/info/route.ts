import { NextResponse } from 'next/server'
import { settingsDb } from '@/lib/supabase-db'

// Get or generate webhook verify token (stored in Supabase settings)
async function getVerifyToken(): Promise<string> {
  try {
    // Try to get token from Supabase settings
    const storedToken = await settingsDb.get('webhook_verify_token')
    if (storedToken) {
      return storedToken
    }

    // Generate new UUID token and store in Supabase
    const newToken = crypto.randomUUID()
    await settingsDb.set('webhook_verify_token', newToken)
    console.log('🔑 Generated new webhook verify token:', newToken)
    return newToken
  } catch {
    // Fallback to env var
    if (process.env.WEBHOOK_VERIFY_TOKEN) {
      return process.env.WEBHOOK_VERIFY_TOKEN.trim()
    }
    return 'not-configured'
  }
}

export async function GET() {
  // Build webhook URL - prioritize Vercel Production URL
  let webhookUrl: string

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    webhookUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}/api/webhook`
  } else if (process.env.NEXT_PUBLIC_APP_URL) {
    webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL.trim()}/api/webhook`
  } else if (process.env.VERCEL_URL) {
    webhookUrl = `https://${process.env.VERCEL_URL.trim()}/api/webhook`
  } else {
    webhookUrl = 'http://localhost:3000/api/webhook'
  }

  // Get token from Supabase or env
  const webhookToken = await getVerifyToken()

  // Stats are now tracked in Supabase (campaign_contacts table)
  // No Redis stats anymore

  return NextResponse.json({
    webhookUrl,
    webhookToken,
    stats: null, // Stats removed - use campaign details page instead
  })
}
