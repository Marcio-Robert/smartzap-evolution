/**
 * API Route: AI Agent Detail
 * 
 * GET /api/ai-agents/[id] - Obter detalhes de um agente
 * PUT /api/ai-agents/[id] - Atualizar agente
 * DELETE /api/ai-agents/[id] - Deletar agente
 */

import { NextRequest, NextResponse } from 'next/server'
import { aiAgentDb, aiToolDb } from '@/lib/supabase-db'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/ai-agents/[id]
 * 
 * Retorna detalhes de um agente incluindo suas ferramentas
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params

    const agent = await aiAgentDb.getById(id)
    if (!agent) {
      return NextResponse.json(
        { error: 'Agente não encontrado' },
        { status: 404 }
      )
    }

    // Buscar ferramentas do agente
    const tools = await aiToolDb.getByAgent(id)

    return NextResponse.json({
      agent,
      tools,
    })
  } catch (error) {
    console.error('Erro ao buscar AI agent:', error)
    return NextResponse.json(
      { error: 'Erro interno ao buscar agente' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/ai-agents/[id]
 * 
 * Atualiza um agente de IA
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    // Verificar se agente existe
    const existing = await aiAgentDb.getById(id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Agente não encontrado' },
        { status: 404 }
      )
    }

    const { name, systemPrompt, model, maxTokens, temperature } = body

    // Validações
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return NextResponse.json(
        { error: 'Nome do agente inválido' },
        { status: 400 }
      )
    }

    if (systemPrompt !== undefined && (typeof systemPrompt !== 'string' || systemPrompt.trim() === '')) {
      return NextResponse.json(
        { error: 'Prompt do sistema inválido' },
        { status: 400 }
      )
    }

    const validModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.0-pro']
    if (model !== undefined && !validModels.includes(model)) {
      return NextResponse.json(
        { error: `Modelo inválido. Use: ${validModels.join(', ')}` },
        { status: 400 }
      )
    }

    if (maxTokens !== undefined && (typeof maxTokens !== 'number' || maxTokens < 50 || maxTokens > 8192)) {
      return NextResponse.json(
        { error: 'maxTokens deve ser um número entre 50 e 8192' },
        { status: 400 }
      )
    }

    if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
      return NextResponse.json(
        { error: 'temperature deve ser um número entre 0 e 2' },
        { status: 400 }
      )
    }

    // Atualizar
    const updated = await aiAgentDb.update(id, {
      name: name?.trim(),
      systemPrompt: systemPrompt?.trim(),
      model,
      maxTokens,
      temperature,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro ao atualizar AI agent:', error)
    return NextResponse.json(
      { error: 'Erro interno ao atualizar agente' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ai-agents/[id]
 * 
 * Deleta um agente de IA e suas ferramentas
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params

    // Verificar se agente existe
    const existing = await aiAgentDb.getById(id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Agente não encontrado' },
        { status: 404 }
      )
    }

    // Deletar agente (ferramentas são deletadas em cascata pelo DB)
    await aiAgentDb.delete(id)

    return NextResponse.json({
      success: true,
      message: 'Agente deletado com sucesso',
    })
  } catch (error) {
    console.error('Erro ao deletar AI agent:', error)
    return NextResponse.json(
      { error: 'Erro interno ao deletar agente' },
      { status: 500 }
    )
  }
}
