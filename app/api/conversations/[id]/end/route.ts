/**
 * API Route: End Conversation
 * 
 * POST /api/conversations/[id]/end - Encerrar uma conversa
 * All state stored in Supabase (no Redis dependency)
 */

import { NextResponse } from 'next/server'
import { botConversationDb } from '@/lib/supabase-db'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/conversations/[id]/end
 * 
 * Encerra uma conversa permanentemente
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

    // Verificar se já foi encerrada
    if (conversation.status === 'ended') {
      return NextResponse.json(
        { error: 'Conversa já está encerrada' },
        { status: 400 }
      )
    }

    // Atualizar status para encerrada
    // Supabase Realtime automatically propagates this DB change
    await botConversationDb.update(id, {
      status: 'ended',
      assignedOperatorId: undefined,
    })

    return NextResponse.json({
      success: true,
      message: 'Conversa encerrada com sucesso',
      conversationId: id,
      status: 'ended',
    })
  } catch (error) {
    console.error('Erro ao encerrar conversa:', error)
    return NextResponse.json(
      { error: 'Erro interno ao encerrar conversa' },
      { status: 500 }
    )
  }
}
