/**
 * API Route: Release Conversation
 * 
 * POST /api/conversations/[id]/release - Devolver conversa para o bot
 * All state stored in Supabase (no Redis dependency)
 */

import { NextResponse } from 'next/server'
import { botConversationDb } from '@/lib/supabase-db'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/conversations/[id]/release
 * 
 * Retorna a conversa para o controle do bot
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params

    // Verificar se conversa existe
    const conversation = await botConversationDb.getById(id)
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversa não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se está pausada
    if (conversation.status !== 'paused') {
      return NextResponse.json(
        { error: 'Conversa não está em atendimento humano' },
        { status: 400 }
      )
    }

    // Atualizar status para ativa - clear operator
    // Supabase Realtime automatically propagates this DB change
    await botConversationDb.update(id, {
      status: 'active',
      assignedOperatorId: undefined,
    })

    return NextResponse.json({
      success: true,
      message: 'Conversa devolvida ao bot',
      conversationId: id,
      status: 'active',
    })
  } catch (error) {
    console.error('Erro ao devolver conversa:', error)
    return NextResponse.json(
      { error: 'Erro interno ao devolver conversa' },
      { status: 500 }
    )
  }
}
