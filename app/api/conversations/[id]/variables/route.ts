/**
 * API Route: Conversation Variables
 * 
 * GET /api/conversations/[id]/variables - Listar variáveis da conversa
 * PUT /api/conversations/[id]/variables - Atualizar variáveis da conversa
 */

import { NextResponse } from 'next/server'
import { conversationVariableDb, botConversationDb } from '@/lib/supabase-db'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/conversations/[id]/variables
 * 
 * Retorna todas as variáveis de uma conversa
 */
export async function GET(request: Request, { params }: RouteParams) {
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

    // Buscar variáveis
    const variables = await conversationVariableDb.getByConversation(id)

    // Converter para mapa e lista
    const variablesMap = await conversationVariableDb.getAsMap(id)

    return NextResponse.json({
      conversationId: id,
      variables: variablesMap,
      details: variables.map(v => ({
        key: v.key,
        value: v.value,
        collectedAt: v.collectedAt,
      }))
    })
  } catch (error) {
    console.error('Erro ao buscar variáveis:', error)
    return NextResponse.json(
      { error: 'Erro interno ao buscar variáveis' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/conversations/[id]/variables
 * 
 * Atualiza variáveis de uma conversa
 * 
 * Body:
 * - variables: Record<string, string> - Variáveis a serem setadas/atualizadas
 * - deleteKeys?: string[] - Chaves a serem removidas
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    // Verificar se conversa existe
    const conversation = await botConversationDb.getById(id)
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversa não encontrada' },
        { status: 404 }
      )
    }

    const { variables, deleteKeys } = body as {
      variables?: Record<string, string>
      deleteKeys?: string[]
    }

    // Deletar variáveis especificadas
    if (deleteKeys && Array.isArray(deleteKeys)) {
      await Promise.all(
        deleteKeys.map(key => conversationVariableDb.delete(id, key))
      )
    }

    // Setar novas variáveis
    if (variables && typeof variables === 'object') {
      await Promise.all(
        Object.entries(variables).map(([key, value]) =>
          conversationVariableDb.set(id, key, String(value))
        )
      )
    }

    // Retornar estado atualizado
    const updatedVariables = await conversationVariableDb.getAsMap(id)

    return NextResponse.json({
      conversationId: id,
      variables: updatedVariables,
      success: true
    })
  } catch (error) {
    console.error('Erro ao atualizar variáveis:', error)
    return NextResponse.json(
      { error: 'Erro interno ao atualizar variáveis' },
      { status: 500 }
    )
  }
}
