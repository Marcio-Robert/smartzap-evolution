/**
 * API Route: Takeover Conversation
 * 
 * POST /api/conversations/[id]/takeover - Assumir atendimento de uma conversa
 * All state stored in Supabase (no Redis dependency)
 */

import { NextResponse } from 'next/server'
import { botConversationDb } from '@/lib/supabase-db'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/conversations/[id]/takeover
 * 
 * Pausa o bot e marca a conversa como sendo atendida por humano
 * Supabase Realtime will automatically propagate the status change.
 * 
 * Body:
 * - agentName?: string - Nome do atendente (opcional)
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { agentName } = body as { agentName?: string }

    // Verificar se conversa existe
    const conversation = await botConversationDb.getById(id)
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversa não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se já está pausada
    if (conversation.status === 'paused') {
      return NextResponse.json(
        { error: 'Conversa já está em atendimento humano' },
        { status: 400 }
      )
    }

    // Verificar se já foi encerrada
    if (conversation.status === 'ended') {
      return NextResponse.json(
        { error: 'Conversa já foi encerrada' },
        { status: 400 }
      )
    }

    // Atualizar status para pausada - store agent name in assigned_operator_id
    // Supabase Realtime automatically propagates this DB change
    await botConversationDb.update(id, {
      status: 'paused',
      assignedOperatorId: agentName || 'Atendente',
    })

    return NextResponse.json({
      success: true,
      message: 'Conversa assumida com sucesso',
      conversationId: id,
      status: 'paused',
    })
  } catch (error) {
    console.error('Erro ao assumir conversa:', error)
    return NextResponse.json(
      { error: 'Erro interno ao assumir conversa' },
      { status: 500 }
    )
  }
}
