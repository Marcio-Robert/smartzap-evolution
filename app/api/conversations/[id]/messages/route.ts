/**
 * API Route: Send Message to Conversation
 * 
 * POST /api/conversations/[id]/messages - Enviar mensagem manual para uma conversa
 */

import { NextResponse } from 'next/server'
import { botConversationDb, botMessageDb, botDb } from '@/lib/supabase-db'
import { getEvoConfig, sendText } from '@/lib/evo-client'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/conversations/[id]/messages
 * 
 * Envia mensagem manual do atendente para o contato
 * 
 * Body:
 * - text: string - Texto da mensagem
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { text } = body as { text: string }

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json(
        { error: 'Texto da mensagem é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se conversa existe
    const conversation = await botConversationDb.getById(id)
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversa não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se conversa está em atendimento humano
    if (conversation.status !== 'paused') {
      return NextResponse.json(
        { error: 'Conversa deve estar em atendimento humano para enviar mensagens manuais. Use /takeover primeiro.' },
        { status: 400 }
      )
    }

    // Buscar bot
    const bot = await botDb.getById(conversation.botId)
    if (!bot) {
      return NextResponse.json(
        { error: 'Bot não encontrado' },
        { status: 404 }
      )
    }

    // Configurações da EVO
    const evoConfig = getEvoConfig()
    if (!evoConfig) {
      return NextResponse.json(
        { error: 'EVOlution API não configurada' },
        { status: 500 }
      )
    }

    // Enviar via EVOlution API
    const result = await sendText(evoConfig, {
      number: conversation.contactPhone,
      text: text.trim(),
      delay: 500, // delay curto para mensagens manuais
      linkPreview: true,
    })

    if (!result.success) {
      console.error('Erro ao enviar mensagem via EVO:', result.error)
      return NextResponse.json(
        {
          error: 'Erro ao enviar mensagem pelo WhatsApp',
          details: result.error || 'Erro desconhecido'
        },
        { status: result.statusCode || 500 }
      )
    }

    const waMessageId = result.messageId

    // Salvar mensagem no banco
    const savedMessage = await botMessageDb.create({
      conversationId: id,
      content: { text: text.trim() },
      type: 'text',
      direction: 'outbound',
      status: 'sent',
      waMessageId,
      origin: 'operator',
    })

    // Atualizar última mensagem da conversa
    await botConversationDb.update(id, {
      lastMessageAt: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: savedMessage,
      waMessageId,
    })
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error)
    return NextResponse.json(
      { error: 'Erro interno ao enviar mensagem' },
      { status: 500 }
    )
  }
}
