'use client'

/**
 * useExecutionRealtime Hook
 * 
 * Subscribes to workflow execution updates for live progress tracking.
 * Part of US3: Live Workflow Execution (T016)
 */

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createRealtimeChannel, subscribeToTable, activateChannel, removeChannel } from '@/lib/supabase-realtime'
import type { RealtimePayload } from '@/types'

interface UseExecutionRealtimeOptions {
    /**
     * Execution ID to track (optional - if not provided, tracks all)
     */
    executionId?: string

    /**
     * Callback when execution status changes
     */
    onStatusChange?: (status: string, payload: RealtimePayload) => void

    /**
     * Callback when a node completes
     */
    onNodeComplete?: (nodeId: string, payload: RealtimePayload) => void
}

/**
 * Track workflow execution progress in real-time
 * 
 * @example
 * ```tsx
 * useExecutionRealtime({
 *   executionId: 'exec-123',
 *   onStatusChange: (status) => setCurrentStatus(status),
 *   onNodeComplete: (nodeId) => highlightNode(nodeId),
 * })
 * ```
 */
export function useExecutionRealtime({
    executionId,
    onStatusChange,
    onNodeComplete,
}: UseExecutionRealtimeOptions = {}) {
    const queryClient = useQueryClient()
    const channelRef = useRef<ReturnType<typeof createRealtimeChannel> | null>(null)
    const mountedRef = useRef(true)

    const handleExecutionUpdate = useCallback((payload: RealtimePayload) => {
        if (!mountedRef.current) return

        const newData = payload.new as Record<string, unknown> | null
        if (!newData) return

        // Filter by execution ID if specified
        if (executionId && newData.id !== executionId) return

        // Notify status change
        if (onStatusChange && newData.status) {
            onStatusChange(newData.status as string, payload)
        }

        // Notify node completion (check for current_node_id change)
        if (onNodeComplete && newData.current_node_id) {
            onNodeComplete(newData.current_node_id as string, payload)
        }

        // Invalidate React Query cache
        queryClient.invalidateQueries({ queryKey: ['executions'] })
        if (executionId) {
            queryClient.invalidateQueries({ queryKey: ['execution', executionId] })
        }
    }, [executionId, onStatusChange, onNodeComplete, queryClient])

    useEffect(() => {
        mountedRef.current = true

        const channelName = `exec-realtime-${executionId || 'all'}-${Date.now()}`
        const channel = createRealtimeChannel(channelName)

        // Skip if Supabase not configured
        if (!channel) {
            console.warn('[useExecutionRealtime] Supabase not configured, skipping realtime')
            return
        }

        channelRef.current = channel

        // Subscribe to executions table
        const filter = executionId ? `id=eq.${executionId}` : undefined
        subscribeToTable(channel, 'flow_executions', 'UPDATE', handleExecutionUpdate, filter)

        // Activate
        activateChannel(channel).catch((err) => {
            console.error('[useExecutionRealtime] Failed to subscribe:', err)
        })

        return () => {
            mountedRef.current = false
            if (channelRef.current) {
                removeChannel(channelRef.current)
                channelRef.current = null
            }
        }
    }, [executionId, handleExecutionUpdate])
}
