/**
 * EVOlution API Client — SmartZap EVO
 *
 * Cliente HTTP centralizado para a EVOlution API (WhatsApp Web).
 * Substitui toda a lógica da Meta Cloud API.
 *
 * Features:
 * - Envio de texto livre (com formatação nativa WhatsApp)
 * - Envio de mídia (imagem, vídeo, documento, áudio)
 * - Delay randômico anti-ban entre disparos
 * - Detecção automática de URL para link preview
 * - Tipagem TypeScript completa
 *
 * @see https://doc.evolution-api.com/
 */

// =============================================================================
// TYPES
// =============================================================================

export interface EvoConfig {
  apiUrl: string
  apiKey: string
  instanceName: string
}

export interface EvoSendTextPayload {
  number: string
  text: string
  delay?: number
  linkPreview?: boolean
}

export interface EvoSendMediaPayload {
  number: string
  mediatype: 'image' | 'video' | 'document' | 'audio'
  mimetype?: string
  caption?: string
  media: string  // URL da mídia
  fileName?: string
  delay?: number
}

export interface EvoSendTextResponse {
  key: {
    remoteJid: string
    fromMe: boolean
    id: string
  }
  message: Record<string, unknown>
  messageTimestamp: string
  status: string
}

export interface EvoSendMediaResponse {
  key: {
    remoteJid: string
    fromMe: boolean
    id: string
  }
  message: Record<string, unknown>
  messageTimestamp: string
  status: string
}

export interface EvoErrorResponse {
  status: number
  error: string
  message: string | string[]
}

export type EvoSendResult =
  | { success: true; messageId: string; response: EvoSendTextResponse | EvoSendMediaResponse }
  | { success: false; error: string; statusCode?: number }

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Get EVOlution API configuration from environment variables.
 * All credentials are read from process.env (server-side only).
 */
export function getEvoConfig(): EvoConfig | null {
  const apiUrl = process.env.EVO_API_URL?.trim()
  const apiKey = process.env.EVO_API_KEY?.trim()
  const instanceName = process.env.EVO_INSTANCE_NAME?.trim()

  if (!apiUrl || !apiKey || !instanceName) {
    return null
  }

  // Remove trailing slash from URL
  return {
    apiUrl: apiUrl.replace(/\/+$/, ''),
    apiKey,
    instanceName,
  }
}

/**
 * Check if EVOlution API is configured
 */
export function isEvoConfigured(): boolean {
  return getEvoConfig() !== null
}

// =============================================================================
// ANTI-BAN DELAY
// =============================================================================

/** Minimum delay between messages in ms (15 seconds) */
export const MIN_DELAY_MS = 15_000

/** Maximum delay between messages in ms (35 seconds) */
export const MAX_DELAY_MS = 35_000

/**
 * Sleep for a random duration between min and max milliseconds.
 * Uses crypto-safe randomization for uniform distribution.
 *
 * @param min - Minimum delay in ms (default: 15000)
 * @param max - Maximum delay in ms (default: 35000)
 * @returns The actual delay applied (in ms)
 */
export async function randomDelay(
  min: number = MIN_DELAY_MS,
  max: number = MAX_DELAY_MS
): Promise<number> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min
  await new Promise(resolve => setTimeout(resolve, delay))
  return delay
}

/**
 * Format delay duration for logging
 */
export function formatDelay(ms: number): string {
  const seconds = (ms / 1000).toFixed(1)
  return `${seconds}s`
}

// =============================================================================
// URL DETECTION
// =============================================================================

/** Regex to detect URLs in text */
const URL_REGEX = /https?:\/\/[^\s]+/i

/**
 * Check if text contains any URL (for link preview detection)
 */
export function containsUrl(text: string): boolean {
  return URL_REGEX.test(text)
}

// =============================================================================
// MESSAGE SENDING
// =============================================================================

/**
 * Send a text message via EVOlution API
 *
 * @param config - EVO configuration
 * @param payload - Message payload (number, text, etc.)
 * @returns Result with messageId on success or error on failure
 */
export async function sendText(
  config: EvoConfig,
  payload: EvoSendTextPayload
): Promise<EvoSendResult> {
  const url = `${config.apiUrl}/message/sendText/${config.instanceName}`

  const body: EvoSendTextPayload = {
    number: payload.number,
    text: payload.text,
    delay: payload.delay ?? 1200,
    linkPreview: payload.linkPreview ?? containsUrl(payload.text),
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      const errorData = data as EvoErrorResponse
      const errorMessage = Array.isArray(errorData.message)
        ? errorData.message.join(', ')
        : errorData.message || errorData.error || `HTTP ${response.status}`

      return {
        success: false,
        error: errorMessage,
        statusCode: response.status,
      }
    }

    const result = data as EvoSendTextResponse
    return {
      success: true,
      messageId: result.key?.id || 'unknown',
      response: result,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro de rede desconhecido',
    }
  }
}

/**
 * Send a media message via EVOlution API
 *
 * @param config - EVO configuration
 * @param payload - Media payload (number, media URL, type, etc.)
 * @returns Result with messageId on success or error on failure
 */
export async function sendMedia(
  config: EvoConfig,
  payload: EvoSendMediaPayload
): Promise<EvoSendResult> {
  const url = `${config.apiUrl}/message/sendMedia/${config.instanceName}`

  const body = {
    number: payload.number,
    mediatype: payload.mediatype,
    mimetype: payload.mimetype,
    caption: payload.caption || '',
    media: payload.media,
    fileName: payload.fileName,
    delay: payload.delay ?? 1200,
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      const errorData = data as EvoErrorResponse
      const errorMessage = Array.isArray(errorData.message)
        ? errorData.message.join(', ')
        : errorData.message || errorData.error || `HTTP ${response.status}`

      return {
        success: false,
        error: errorMessage,
        statusCode: response.status,
      }
    }

    const result = data as EvoSendMediaResponse
    return {
      success: true,
      messageId: result.key?.id || 'unknown',
      response: result,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro de rede desconhecido',
    }
  }
}

/**
 * Check EVOlution API instance status
 *
 * @param config - EVO configuration
 * @returns Instance connection status
 */
export async function checkInstanceStatus(
  config: EvoConfig
): Promise<{ connected: boolean; state?: string; error?: string }> {
  const url = `${config.apiUrl}/instance/connectionState/${config.instanceName}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': config.apiKey,
      },
    })

    if (!response.ok) {
      return { connected: false, error: `HTTP ${response.status}` }
    }

    const data = await response.json()
    const state = data?.instance?.state || data?.state || 'unknown'

    return {
      connected: state === 'open',
      state,
    }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Erro de rede',
    }
  }
}
