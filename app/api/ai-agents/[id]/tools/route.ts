/**
 * AI Tools API Routes
 * 
 * CRUD de ferramentas (webhooks) para agentes de IA
 * 
 * GET    /api/ai-agents/[id]/tools     - Lista todas as ferramentas do agente
 * POST   /api/ai-agents/[id]/tools     - Cria nova ferramenta
 */

import { NextRequest, NextResponse } from 'next/server'
import { aiAgentDb, aiToolDb } from '@/lib/supabase-db'
import { z } from 'zod'

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateToolSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/, {
    message: 'Nome deve seguir o padrão snake_case (ex: consultar_pedido)'
  }),
  description: z.string().min(1).max(500),
  parametersSchema: z.record(z.string(), z.unknown()).optional().default({}),
  webhookUrl: z.string().url(),
  timeoutMs: z.number().min(1000).max(60000).optional().default(10000),
})

// =============================================================================
// GET - List tools for agent
// =============================================================================

/**
 * @api {get} /api/ai-agents/:id/tools Lista ferramentas do agente
 * @apiDescription Retorna todas as ferramentas configuradas para um agente de IA
 * 
 * @apiParam {String} id ID do agente
 * 
 * @apiSuccess {Object[]} tools Lista de ferramentas
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    // Verificar se agente existe
    const agent = await aiAgentDb.getById(agentId)
    if (!agent) {
      return NextResponse.json(
        { error: 'Agente não encontrado' },
        { status: 404 }
      )
    }

    // Buscar ferramentas do agente
    const tools = await aiToolDb.getByAgent(agentId)

    return NextResponse.json({ tools })
  } catch (error) {
    console.error('Error fetching tools:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar ferramentas' },
      { status: 500 }
    )
  }
}

// =============================================================================
// POST - Create tool
// =============================================================================

/**
 * @api {post} /api/ai-agents/:id/tools Cria nova ferramenta
 * @apiDescription Adiciona uma nova ferramenta (webhook) ao agente de IA
 * 
 * @apiParam {String} id ID do agente
 * 
 * @apiBody {String} name Nome da ferramenta (snake_case)
 * @apiBody {String} description Descrição do que a ferramenta faz
 * @apiBody {Object} [parametersSchema] Schema JSON dos parâmetros esperados
 * @apiBody {String} webhookUrl URL que será chamada
 * @apiBody {Number} [timeoutMs=10000] Timeout em milissegundos
 * 
 * @apiSuccess {Object} tool Ferramenta criada
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = await request.json()

    // Validar body
    const validation = CreateToolSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: validation.error.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      )
    }

    const { name, description, parametersSchema, webhookUrl, timeoutMs } = validation.data

    // Verificar se agente existe
    const agent = await aiAgentDb.getById(agentId)
    if (!agent) {
      return NextResponse.json(
        { error: 'Agente não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se já existe tool com mesmo nome neste agente
    const existingTools = await aiToolDb.getByAgent(agentId)
    if (existingTools.some(t => t.name === name)) {
      return NextResponse.json(
        { error: 'Já existe uma ferramenta com este nome neste agente' },
        { status: 409 }
      )
    }

    // Criar ferramenta
    const tool = await aiToolDb.create({
      agentId,
      name,
      description,
      parametersSchema,
      webhookUrl,
      timeoutMs,
    })

    return NextResponse.json({ tool }, { status: 201 })
  } catch (error) {
    console.error('Error creating tool:', error)
    return NextResponse.json(
      { error: 'Erro ao criar ferramenta' },
      { status: 500 }
    )
  }
}
