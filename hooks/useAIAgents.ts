'use client'

/**
 * useAIAgents Hook
 * 
 * Hook para gerenciamento de agentes de IA e suas ferramentas
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as aiAgentService from '@/services/aiAgentService'
import type { AIAgent, AITool } from '@/types'

// =============================================================================
// QUERY KEYS
// =============================================================================

export const aiAgentKeys = {
  all: ['ai-agents'] as const,
  list: () => [...aiAgentKeys.all, 'list'] as const,
  detail: (id: string) => [...aiAgentKeys.all, 'detail', id] as const,
  tools: (agentId: string) => [...aiAgentKeys.all, 'tools', agentId] as const,
}

// =============================================================================
// AGENTS QUERIES
// =============================================================================

/**
 * Hook para listar todos os agentes
 */
export function useAgents() {
  return useQuery({
    queryKey: aiAgentKeys.list(),
    queryFn: aiAgentService.getAgents,
    staleTime: 30000, // 30 segundos
  })
}

/**
 * Hook para buscar um agente específico
 */
export function useAgent(id: string | undefined) {
  return useQuery({
    queryKey: aiAgentKeys.detail(id || ''),
    queryFn: () => aiAgentService.getAgent(id!),
    enabled: Boolean(id),
    staleTime: 30000,
  })
}

/**
 * Hook para buscar agente com suas ferramentas
 */
export function useAgentWithTools(id: string | undefined) {
  return useQuery({
    queryKey: [...aiAgentKeys.detail(id || ''), 'with-tools'],
    queryFn: () => aiAgentService.getAgentWithTools(id!),
    enabled: Boolean(id),
    staleTime: 30000,
  })
}

// =============================================================================
// AGENTS MUTATIONS
// =============================================================================

/**
 * Hook para criar um agente
 */
export function useCreateAgent() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: Parameters<typeof aiAgentService.createAgent>[0]) =>
      aiAgentService.createAgent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.list() })
    },
  })
}

/**
 * Hook para atualizar um agente
 */
export function useUpdateAgent() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Parameters<typeof aiAgentService.updateAgent>[1]) =>
      aiAgentService.updateAgent(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.list() })
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.detail(variables.id) })
    },
  })
}

/**
 * Hook para deletar um agente
 */
export function useDeleteAgent() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: aiAgentService.deleteAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.list() })
    },
  })
}

// =============================================================================
// TOOLS QUERIES & MUTATIONS
// =============================================================================

/**
 * Hook para listar ferramentas de um agente
 */
export function useAgentTools(agentId: string | undefined) {
  return useQuery({
    queryKey: aiAgentKeys.tools(agentId || ''),
    queryFn: () => aiAgentService.getTools(agentId!),
    enabled: Boolean(agentId),
    staleTime: 30000,
  })
}

/**
 * Hook para criar uma ferramenta
 */
export function useCreateTool() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ agentId, ...data }: { agentId: string } & Parameters<typeof aiAgentService.createTool>[1]) =>
      aiAgentService.createTool(agentId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.tools(variables.agentId) })
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.detail(variables.agentId) })
    },
  })
}

/**
 * Hook para deletar uma ferramenta
 */
export function useDeleteTool() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ agentId, toolId }: { agentId: string; toolId: string }) =>
      aiAgentService.deleteTool(agentId, toolId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.tools(variables.agentId) })
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.detail(variables.agentId) })
    },
  })
}

// =============================================================================
// CONTROLLER HOOK
// =============================================================================

/**
 * Hook controlador para gerenciamento completo de agentes
 */
export function useAIAgentsController() {
  const { data: agents = [], isLoading, error, refetch } = useAgents()
  const createAgent = useCreateAgent()
  const updateAgent = useUpdateAgent()
  const deleteAgent = useDeleteAgent()
  const createTool = useCreateTool()
  const deleteTool = useDeleteTool()
  
  return {
    // Data
    agents,
    isLoading,
    error,
    
    // Actions
    refetch,
    
    // Agent mutations
    createAgent: createAgent.mutateAsync,
    updateAgent: updateAgent.mutateAsync,
    deleteAgent: deleteAgent.mutateAsync,
    isCreating: createAgent.isPending,
    isUpdating: updateAgent.isPending,
    isDeleting: deleteAgent.isPending,
    
    // Tool mutations
    createTool: createTool.mutateAsync,
    deleteTool: deleteTool.mutateAsync,
    isCreatingTool: createTool.isPending,
    isDeletingTool: deleteTool.isPending,
  }
}
