/**
 * AI Tool Individual API Routes
 * 
 * Operações individuais em ferramentas de agentes de IA
 * 
 * GET    /api/ai-agents/[id]/tools/[toolId] - Detalhes da ferramenta
 * DELETE /api/ai-agents/[id]/tools/[toolId] - Remove ferramenta
 */

import { NextRequest, NextResponse } from 'next/server'
import { aiAgentDb, aiToolDb } from '@/lib/supabase-db'

// =============================================================================
// GET - Get tool details
// =============================================================================

/**
 * @api {get} /api/ai-agents/:id/tools/:toolId Detalhes da ferramenta
 * @apiDescription Retorna detalhes de uma ferramenta específica
 * 
 * @apiParam {String} id ID do agente
 * @apiParam {String} toolId ID da ferramenta
 * 
 * @apiSuccess {Object} tool Ferramenta encontrada
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  try {
    const { id: agentId, toolId } = await params

    // Verificar se agente existe
    const agent = await aiAgentDb.getById(agentId)
    if (!agent) {
      return NextResponse.json(
        { error: 'Agente não encontrado' },
        { status: 404 }
      )
    }

    // Buscar ferramenta
    const tool = await aiToolDb.getById(toolId)
    if (!tool || tool.agentId !== agentId) {
      return NextResponse.json(
        { error: 'Ferramenta não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({ tool })
  } catch (error) {
    console.error('Error fetching tool:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar ferramenta' },
      { status: 500 }
    )
  }
}

// =============================================================================
// DELETE - Delete tool
// =============================================================================

/**
 * @api {delete} /api/ai-agents/:id/tools/:toolId Remove ferramenta
 * @apiDescription Remove uma ferramenta do agente
 * 
 * @apiParam {String} id ID do agente
 * @apiParam {String} toolId ID da ferramenta
 * 
 * @apiSuccess {Boolean} success true se removido com sucesso
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  try {
    const { id: agentId, toolId } = await params

    // Verificar se agente existe
    const agent = await aiAgentDb.getById(agentId)
    if (!agent) {
      return NextResponse.json(
        { error: 'Agente não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se ferramenta existe e pertence ao agente
    const tool = await aiToolDb.getById(toolId)
    if (!tool || tool.agentId !== agentId) {
      return NextResponse.json(
        { error: 'Ferramenta não encontrada' },
        { status: 404 }
      )
    }

    // Remover ferramenta
    await aiToolDb.delete(toolId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tool:', error)
    return NextResponse.json(
      { error: 'Erro ao remover ferramenta' },
      { status: 500 }
    )
  }
}
