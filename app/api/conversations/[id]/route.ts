/**
 * API Route: Conversation Detail
 * 
 * GET /api/conversations/[id] - Obter detalhes de uma conversa
 */

import { NextResponse } from 'next/server'
import { botConversationDb, botMessageDb, conversationVariableDb, botDb } from '@/lib/supabase-db'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/conversations/[id]
 * 
 * Retorna detalhes de uma conversa incluindo mensagens e variáveis
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params

    // Buscar conversa
    const conversation = await botConversationDb.getById(id)
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversa não encontrada' },
        { status: 404 }
      )
    }

    // Buscar informações do bot
    const bot = await botDb.getById(conversation.botId)

    // Buscar mensagens
    const messages = await botMessageDb.getByConversation(id)

    // Buscar variáveis
    const variables = await conversationVariableDb.getAsMap(id)

    return NextResponse.json({
      conversation: {
        ...conversation,
        botName: bot?.name || 'Bot desconhecido',
      },
      messages: messages.sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
      variables,
    })
  } catch (error) {
    console.error('Erro ao buscar conversa:', error)
    return NextResponse.json(
      { error: 'Erro interno ao buscar conversa' },
      { status: 500 }
    )
  }
}
