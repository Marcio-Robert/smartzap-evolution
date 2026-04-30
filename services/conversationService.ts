/**
 * Conversation Service
 * 
 * Client-side service for conversation API operations
 */

import type { BotConversation, BotMessage } from '@/types'

const BASE_URL = '/api/conversations'

// =============================================================================
// Types
// =============================================================================

export interface ConversationListResponse {
  conversations: (BotConversation & { botName: string })[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface ConversationDetailResponse {
  conversation: BotConversation & { botName: string }
  messages: BotMessage[]
  variables: Record<string, string>
}

export interface ConversationListParams {
  status?: 'active' | 'paused' | 'ended'
  botId?: string
  limit?: number
  offset?: number
}

// =============================================================================
// API Functions
// =============================================================================

export const conversationService = {
  /**
   * Lista conversas com filtros e paginação
   */
  getConversations: async (
    params: ConversationListParams = {}
  ): Promise<ConversationListResponse> => {
    const searchParams = new URLSearchParams()

    if (params.status) searchParams.set('status', params.status)
    if (params.botId) searchParams.set('botId', params.botId)
    if (params.limit) searchParams.set('limit', params.limit.toString())
    if (params.offset) searchParams.set('offset', params.offset.toString())

    const url = `${BASE_URL}?${searchParams.toString()}`
    const response = await fetch(url)

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || 'Erro ao listar conversas')
    }

    return response.json()
  },

  /**
   * Obtém detalhes de uma conversa específica
   */
  getConversation: async (id: string): Promise<ConversationDetailResponse> => {
    const response = await fetch(`${BASE_URL}/${id}`)

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || 'Erro ao buscar conversa')
    }

    return response.json()
  },

  /**
   * Assume o atendimento de uma conversa (pausa o bot)
   */
  takeoverConversation: async (
    id: string,
    agentName?: string
  ): Promise<{ success: boolean; conversationId: string; status: string }> => {
    const response = await fetch(`${BASE_URL}/${id}/takeover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentName }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || 'Erro ao assumir conversa')
    }

    return response.json()
  },

  /**
   * Devolve a conversa para o bot
   */
  releaseConversation: async (
    id: string
  ): Promise<{ success: boolean; conversationId: string; status: string }> => {
    const response = await fetch(`${BASE_URL}/${id}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || 'Erro ao devolver conversa')
    }

    return response.json()
  },

  /**
   * Envia mensagem manual para uma conversa em atendimento humano
   */
  sendMessage: async (
    conversationId: string,
    text: string
  ): Promise<{ success: boolean; message: BotMessage; waMessageId?: string }> => {
    const response = await fetch(`${BASE_URL}/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || 'Erro ao enviar mensagem')
    }

    return response.json()
  },

  /**
   * Encerra uma conversa
   */
  endConversation: async (
    id: string
  ): Promise<{ success: boolean; conversationId: string; status: string }> => {
    const response = await fetch(`${BASE_URL}/${id}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || 'Erro ao encerrar conversa')
    }

    return response.json()
  },

  /**
   * Obtém variáveis de uma conversa
   */
  getConversationVariables: async (
    conversationId: string
  ): Promise<{ conversationId: string; variables: Record<string, string> }> => {
    const response = await fetch(`${BASE_URL}/${conversationId}/variables`)

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || 'Erro ao buscar variáveis')
    }

    return response.json()
  },

  /**
   * Atualiza variáveis de uma conversa
   */
  updateConversationVariables: async (
    conversationId: string,
    variables: Record<string, string>,
    deleteKeys?: string[]
  ): Promise<{ conversationId: string; variables: Record<string, string>; success: boolean }> => {
    const response = await fetch(`${BASE_URL}/${conversationId}/variables`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variables, deleteKeys }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || 'Erro ao atualizar variáveis')
    }

    return response.json()
  }
}
