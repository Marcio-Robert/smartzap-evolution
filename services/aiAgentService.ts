/**
 * AI Agent Service
 * 
 * Client-side service for AI Agents and Tools API
 */

import type { AIAgent, AITool } from '@/types'

const BASE_URL = '/api/ai-agents'

// =============================================================================
// AI AGENTS
// =============================================================================

/**
 * Lista todos os agentes de IA
 */
export async function getAgents(): Promise<AIAgent[]> {
  const response = await fetch(BASE_URL)
  
  if (!response.ok) {
    throw new Error('Erro ao buscar agentes')
  }
  
  const data = await response.json()
  return data.agents
}

/**
 * Busca um agente por ID
 */
export async function getAgent(id: string): Promise<AIAgent> {
  const response = await fetch(`${BASE_URL}/${id}`)
  
  if (!response.ok) {
    throw new Error('Agente não encontrado')
  }
  
  const data = await response.json()
  return data.agent
}

/**
 * Cria um novo agente
 */
export async function createAgent(data: {
  name: string
  systemPrompt: string
  model?: AIAgent['model']
  maxTokens?: number
  temperature?: number
}): Promise<AIAgent> {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro ao criar agente')
  }
  
  const result = await response.json()
  return result.agent
}

/**
 * Atualiza um agente
 */
export async function updateAgent(
  id: string,
  data: Partial<Omit<AIAgent, 'id' | 'createdAt' | 'tools'>>
): Promise<AIAgent> {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro ao atualizar agente')
  }
  
  const result = await response.json()
  return result.agent
}

/**
 * Remove um agente
 */
export async function deleteAgent(id: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE',
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro ao remover agente')
  }
}

// =============================================================================
// TOOLS
// =============================================================================

/**
 * Lista ferramentas de um agente
 */
export async function getTools(agentId: string): Promise<AITool[]> {
  const response = await fetch(`${BASE_URL}/${agentId}/tools`)
  
  if (!response.ok) {
    throw new Error('Erro ao buscar ferramentas')
  }
  
  const data = await response.json()
  return data.tools
}

/**
 * Cria uma nova ferramenta
 */
export async function createTool(
  agentId: string,
  data: {
    name: string
    description: string
    parametersSchema?: Record<string, unknown>
    webhookUrl: string
    timeoutMs?: number
  }
): Promise<AITool> {
  const response = await fetch(`${BASE_URL}/${agentId}/tools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro ao criar ferramenta')
  }
  
  const result = await response.json()
  return result.tool
}

/**
 * Remove uma ferramenta
 */
export async function deleteTool(agentId: string, toolId: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/${agentId}/tools/${toolId}`, {
    method: 'DELETE',
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro ao remover ferramenta')
  }
}

// =============================================================================
// COMBINED
// =============================================================================

/**
 * Busca agente com suas ferramentas
 */
export async function getAgentWithTools(id: string): Promise<AIAgent & { tools: AITool[] }> {
  const [agent, tools] = await Promise.all([
    getAgent(id),
    getTools(id),
  ])
  
  return { ...agent, tools }
}
