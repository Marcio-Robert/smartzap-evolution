/**
 * Setup Validation API
 * 
 * POST: Validate credentials for each service
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, credentials } = body as {
      type: 'database' | 'redis' | 'qstash' | 'evolution'
      credentials: Record<string, string>
    }

    switch (type) {
      case 'database':
        return await validateSupabase(credentials)
      case 'redis':
        return await validateRedis(credentials)
      case 'qstash':
        return await validateQStash(credentials)
      case 'evolution':
        return await validateEvolution(credentials)
      default:
        return NextResponse.json(
          { error: 'Tipo de validação inválido' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Validation error:', error)
    return NextResponse.json(
      { error: 'Erro ao validar credenciais' },
      { status: 500 }
    )
  }
}

function cleanCredential(value: string | undefined): string {
  if (!value) return ''
  let cleaned = value.trim()

  // Handle "KEY=VALUE" format (pasted from .env)
  // Matches uppercase/underscore key followed by =
  const envVarMatch = cleaned.match(/^[A-Z0-9_]+=(.*)$/)
  if (envVarMatch) {
    cleaned = envVarMatch[1].trim()
  }

  // Remove surrounding quotes (" or ')
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1)
  }

  return cleaned.trim()
}

async function validateSupabase(credentials: Record<string, string>) {
  const url = cleanCredential(credentials.url)
  const key = cleanCredential(credentials.key)

  if (!url || !key) {
    return NextResponse.json(
      { valid: false, error: 'URL e chave são obrigatórios' },
      { status: 400 }
    )
  }

  try {
    // Attempt to fetch the root of the REST API to verify credentials
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    })

    if (!response.ok) {
      // 401 Unauthorized or 403 Forbidden usually mean bad key
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({
          valid: false,
          error: 'Chave de API inválida'
        })
      }
      return NextResponse.json({
        valid: false,
        error: `Erro de conexão com Supabase (${response.status})`
      })
    }

    return NextResponse.json({ valid: true, message: 'Conexão Supabase OK!' })
  } catch (error) {
    console.error('Supabase validation error:', error)
    return NextResponse.json({
      valid: false,
      error: 'Não foi possível conectar ao Supabase (verifique a URL)'
    })
  }
}

async function validateRedis(credentials: Record<string, string>) {
  const url = cleanCredential(credentials.url)
  const token = cleanCredential(credentials.token)

  if (!url || !token) {
    return NextResponse.json(
      { valid: false, error: 'URL e token são obrigatórios' },
      { status: 400 }
    )
  }

  try {
    // Test Redis connection with a simple PING
    const response = await fetch(`${url}/ping`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erro desconhecido')
      return NextResponse.json({
        valid: false,
        error: response.status === 401 ? 'Token do Redis inválido. Verifique o UPSTASH_REDIS_REST_TOKEN.' : `Erro de conexão com Redis: ${errorText}`
      })
    }

    const data = await response.json()

    if (data.result === 'PONG') {
      return NextResponse.json({ valid: true, message: 'Redis OK!' })
    }

    return NextResponse.json({
      valid: false,
      error: 'Resposta inesperada do Redis'
    })
  } catch (error) {
    console.error('Redis validation error:', error)
    return NextResponse.json({
      valid: false,
      error: 'Não foi possível conectar ao Redis'
    })
  }
}

async function validateQStash(credentials: Record<string, string>) {
  const token = cleanCredential(credentials.token)

  if (!token) {
    return NextResponse.json(
      { valid: false, error: 'Token é obrigatório' },
      { status: 400 }
    )
  }

  try {
    // Test QStash by fetching signing keys (confirms token is valid and can retrieve keys)
    const response = await fetch('https://qstash.upstash.io/v2/keys', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erro desconhecido')
      return NextResponse.json({
        valid: false,
        error: response.status === 401 ? 'Token do QStash inválido. Verifique o QSTASH_TOKEN (não é o Current Signing Key).' : `Erro QStash: ${errorText}`
      })
    }

    // Optional: could return keys here to verify they match if frontend had them
    const keys = await response.json()
    if (!keys.current || !keys.next) {
      return NextResponse.json({
        valid: false,
        error: 'Token válido, mas não foi possível recuperar as Signing Keys. Verifique se sua conta QStash está ativa.'
      })
    }

    return NextResponse.json({ valid: true, message: 'QStash OK! (Keys recuperadas com sucesso)' })
  } catch (error) {
    console.error('QStash validation error:', error)
    return NextResponse.json({
      valid: false,
      error: `Erro ao conectar QStash: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}

async function validateEvolution(credentials: Record<string, string>) {
  const url = cleanCredential(credentials.url)
  const key = cleanCredential(credentials.key)
  const instance = cleanCredential(credentials.instance)

  if (!url || !key || !instance) {
    return NextResponse.json(
      { valid: false, error: 'URL, API Key e Nome da Instância são obrigatórios' },
      { status: 400 }
    )
  }

  try {
    // Test EVOlution API by checking instance connection state
    const response = await fetch(
      `${url.replace(/\/+$/, '')}/instance/connectionState/${instance}`,
      {
        headers: {
          'apikey': key,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({
          valid: false,
          error: 'API Key inválida. Verifique a chave global ou de instância.'
        })
      }
      if (response.status === 404) {
        return NextResponse.json({
          valid: false,
          error: `Instância "${instance}" não encontrada. Verifique o nome.`
        })
      }
      return NextResponse.json({
        valid: false,
        error: `Erro de conexão com EVOlution API (${response.status})`
      })
    }

    const data = await response.json()
    const state = data?.instance?.state || data?.state || 'unknown'
    const connected = state === 'open'

    return NextResponse.json({
      valid: true,
      message: connected
        ? `EVOlution OK! Instância "${instance}" conectada.`
        : `Instância encontrada (estado: ${state}). Verifique se o QR Code foi escaneado.`
    })
  } catch (error) {
    console.error('EVOlution validation error:', error)
    return NextResponse.json({
      valid: false,
      error: 'Não foi possível conectar à EVOlution API (verifique a URL)'
    })
  }
}

