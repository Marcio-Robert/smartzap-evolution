import { NextRequest, NextResponse } from 'next/server'
import { getEvoConfig, checkInstanceStatus } from '@/lib/evo-client'

/**
 * Settings Credentials API — SmartZap EVO
 *
 * Manages EVOlution API credentials stored in environment variables.
 * Validates connection to the EVO instance.
 */

// GET - Fetch EVO credentials from env (without exposing full API key)
export async function GET() {
  try {
    const config = getEvoConfig()

    if (config) {
      // Check instance connection status
      let displayPhoneNumber: string | undefined
      let verifiedName: string | undefined
      let instanceConnected = false

      try {
        const status = await checkInstanceStatus(config)
        instanceConnected = status.connected
        // EVO instance state info
        verifiedName = status.state || undefined
      } catch {
        // Ignore errors, just won't have status
      }

      return NextResponse.json({
        source: 'env',
        evoApiUrl: config.apiUrl,
        evoInstanceName: config.instanceName,
        evoApiKey: true, // Don't expose the key, just confirm it exists
        displayPhoneNumber,
        verifiedName,
        hasToken: true,
        isConnected: instanceConnected,
      })
    }

    // Not configured
    return NextResponse.json({
      source: 'none',
      isConnected: false,
    })
  } catch (error) {
    console.error('Error fetching credentials:', error)
    return NextResponse.json(
      { error: 'Failed to fetch credentials' },
      { status: 500 }
    )
  }
}

// POST - Validate EVO credentials
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { evoApiUrl, evoApiKey, evoInstanceName } = body

    if (!evoApiUrl || !evoApiKey || !evoInstanceName) {
      return NextResponse.json(
        { error: 'Missing required fields: evoApiUrl, evoApiKey, evoInstanceName' },
        { status: 400 }
      )
    }

    // Validate by checking instance connection
    const config = {
      apiUrl: evoApiUrl.replace(/\/+$/, ''),
      apiKey: evoApiKey,
      instanceName: evoInstanceName,
    }

    const status = await checkInstanceStatus(config)

    if (!status.connected && status.error) {
      return NextResponse.json(
        {
          error: 'Não foi possível conectar à instância EVOlution',
          details: status.error,
          state: status.state,
        },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      evoApiUrl: config.apiUrl,
      evoInstanceName: config.instanceName,
      state: status.state,
      isConnected: status.connected,
      message: 'Credenciais EVO validadas. Armazene-as nas variáveis de ambiente.',
    })
  } catch (error) {
    console.error('Error validating credentials:', error)
    return NextResponse.json(
      { error: 'Failed to validate credentials' },
      { status: 500 }
    )
  }
}

// DELETE - No-op since credentials are in env vars
export async function DELETE() {
  return NextResponse.json({
    success: true,
    message: 'Para remover credenciais, atualize as variáveis de ambiente no dashboard Vercel.',
  })
}
