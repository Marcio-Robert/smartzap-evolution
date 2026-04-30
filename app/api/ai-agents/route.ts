/**
 * API Route: AI Agents
 * 
 * GET /api/ai-agents - Listar todos os agentes de IA
 * POST /api/ai-agents - Criar novo agente de IA
 */

import { NextRequest, NextResponse } from 'next/server'
import { aiAgentDb } from '@/lib/supabase-db'

/**
 * GET /api/ai-agents
 * 
 * Retorna lista de todos os agentes de IA
 */
export async function GET() {
  try {
    const agents = await aiAgentDb.getAll()

    return NextResponse.json({
      agents,
      count: agents.length,
    })
  } catch (error) {
    console.error('Erro ao listar AI agents:', error)
    return NextResponse.json(
      { error: 'Erro interno ao listar agentes' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ai-agents
 * 
 * Cria novo agente de IA
 * 
 * Body:
 * - name: string (obrigatório)
 * - systemPrompt: string (obrigatório)
 * - model?: 'gemini-1.5-flash' | 'gemini-1.5-pro' | 'gemini-2.0-flash' | 'gemini-2.0-pro'
 * - maxTokens?: number
 * - temperature?: number
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validação
    const { name, systemPrompt, model, maxTokens, temperature } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'Nome do agente é obrigatório' },
        { status: 400 }
      )
    }

    if (!systemPrompt || typeof systemPrompt !== 'string' || systemPrompt.trim() === '') {
      return NextResponse.json(
        { error: 'Prompt do sistema é obrigatório' },
        { status: 400 }
      )
    }

    // Validar modelo se fornecido
    const validModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.0-pro']
    if (model && !validModels.includes(model)) {
      return NextResponse.json(
        { error: `Modelo inválido. Use: ${validModels.join(', ')}` },
        { status: 400 }
      )
    }

    // Validar maxTokens
    if (maxTokens !== undefined && (typeof maxTokens !== 'number' || maxTokens < 50 || maxTokens > 8192)) {
      return NextResponse.json(
        { error: 'maxTokens deve ser um número entre 50 e 8192' },
        { status: 400 }
      )
    }

    // Validar temperature
    if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
      return NextResponse.json(
        { error: 'temperature deve ser um número entre 0 e 2' },
        { status: 400 }
      )
    }

    // Criar agente
    const agent = await aiAgentDb.create({
      name: name.trim(),
      systemPrompt: systemPrompt.trim(),
      model,
      maxTokens,
      temperature,
    })

    return NextResponse.json(agent, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar AI agent:', error)
    return NextResponse.json(
      { error: 'Erro interno ao criar agente' },
      { status: 500 }
    )
  }
}
