import { NextResponse } from 'next/server'
import { getEvoConfig, checkInstanceStatus } from '@/lib/evo-client'

/**
 * API Route: Phone/Instance Status
 *
 * Returns the connection status of the EVOlution instance.
 * Replaces the old Meta Graph API phone-number lookup.
 */
export async function GET() {
  try {
    const config = getEvoConfig()

    if (!config) {
      return NextResponse.json(
        { error: 'EVOlution API não configurada' },
        { status: 400 }
      )
    }

    const status = await checkInstanceStatus(config)

    return NextResponse.json({
      instanceName: config.instanceName,
      state: status.state || 'unknown',
      connected: status.connected,
    })
  } catch (error) {
    console.error('EVO instance status error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
