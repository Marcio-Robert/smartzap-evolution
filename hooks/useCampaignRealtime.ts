'use client'

/**
 * useCampaignRealtime Hook
 * 
 * Smart Realtime strategy for campaign updates:
 * 
 * 1. DEBOUNCE based on campaign size:
 *    - < 1,000 recipients → 2s debounce
 *    - 1,000-10,000 → 5s debounce
 *    - > 10,000 → 10s debounce
 * 
 * 2. TIMEOUT: 5 minutes after COMPLETED, then disconnect
 * 
 * 3. POLLING: 60s backup while connected (in useCampaignDetails)
 * 
 * 4. After disconnect: Show "Atualizar" button
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CampaignStatus } from '@/types'
import { createRealtimeChannel, subscribeToTable, activateChannel, removeChannel } from '@/lib/supabase-realtime'
import type { RealtimePayload } from '@/types'

// Constants
const POST_COMPLETION_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

interface UseCampaignRealtimeOptions {
  campaignId: string | undefined
  status: CampaignStatus | undefined
  recipients?: number
  completedAt?: string
}

// Calculate debounce time based on campaign size
function getDebounceTime(recipients: number): number {
  if (recipients < 1000) return 2000    // 2s for small campaigns
  if (recipients <= 10000) return 5000  // 5s for medium campaigns
  return 10000                          // 10s for large campaigns
}

export function useCampaignRealtime({
  campaignId,
  status,
  recipients = 0,
  completedAt,
}: UseCampaignRealtimeOptions) {
  const queryClient = useQueryClient()
  const channelRef = useRef<ReturnType<typeof createRealtimeChannel> | null>(null)
  const mountedRef = useRef(true)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingRefetchRef = useRef(false)

  const [isActuallyConnected, setIsActuallyConnected] = useState(false)
  const [hasTimedOut, setHasTimedOut] = useState(false)

  // Debounce time based on campaign size
  const debounceTime = useMemo(() => getDebounceTime(recipients), [recipients])

  // Check if within post-completion window (5 minutes)
  const isWithinPostCompletionWindow = useMemo(() => {
    if (!completedAt) return true // No completion time = still active
    const completedTime = new Date(completedAt).getTime()
    const elapsed = Date.now() - completedTime
    return elapsed < POST_COMPLETION_TIMEOUT_MS
  }, [completedAt])

  // Large campaigns (>= 10k) use polling only (saves Supabase Realtime events)
  const isLargeCampaign = recipients >= 10000

  // Should we connect to Realtime?
  const shouldConnect = useMemo(() => {
    if (!campaignId) return false
    if (hasTimedOut) return false // User-initiated or auto timeout

    // LARGE CAMPAIGNS: No Realtime socket (uses polling only)
    // This saves Supabase Free tier events (2M/month limit)
    if (isLargeCampaign) {
      console.log('[CampaignRealtime] Large campaign detected, using polling only')
      return false
    }

    // Connect during loading (small campaigns only)
    if (!status) return true

    // Active statuses - connect for small/medium campaigns
    if ([CampaignStatus.SENDING, CampaignStatus.SCHEDULED].includes(status)) {
      return true
    }

    // Completed - connect only within 5 min window
    if (status === CampaignStatus.COMPLETED) {
      return isWithinPostCompletionWindow
    }

    // Other statuses (DRAFT, FAILED, PAUSED) - don't connect
    return false
  }, [campaignId, status, hasTimedOut, isWithinPostCompletionWindow, isLargeCampaign])

  // Debounced refetch function
  const debouncedRefetch = useCallback(() => {
    // Mark that we have a pending refetch
    pendingRefetchRef.current = true

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      if (!mountedRef.current || !pendingRefetchRef.current) return

      console.log(`[CampaignRealtime] Debounced refetch (${debounceTime}ms window)`)

      queryClient.refetchQueries({ queryKey: ['campaign', campaignId] })
      queryClient.refetchQueries({ queryKey: ['campaignMessages', campaignId] })

      pendingRefetchRef.current = false
    }, debounceTime)
  }, [queryClient, campaignId, debounceTime])

  // Handle campaign updates
  const handleCampaignUpdate = useCallback((payload: RealtimePayload) => {
    if (!mountedRef.current) return
    console.log('[CampaignRealtime] Campaign update received')
    debouncedRefetch()
  }, [debouncedRefetch])

  // Handle campaign_contacts updates
  const handleContactUpdate = useCallback((payload: RealtimePayload) => {
    if (!mountedRef.current) return
    console.log('[CampaignRealtime] Contact update received')
    debouncedRefetch()
  }, [debouncedRefetch])

  // Set up timeout for post-completion window
  useEffect(() => {
    if (status !== CampaignStatus.COMPLETED || !completedAt || hasTimedOut) {
      return
    }

    const completedTime = new Date(completedAt).getTime()
    const elapsed = Date.now() - completedTime
    const remaining = POST_COMPLETION_TIMEOUT_MS - elapsed

    if (remaining <= 0) {
      // Already past the window
      console.log('[CampaignRealtime] Post-completion window already expired')
      setHasTimedOut(true)
      return
    }

    console.log(`[CampaignRealtime] Will disconnect in ${Math.round(remaining / 1000)}s`)

    const timer = setTimeout(() => {
      console.log('[CampaignRealtime] Post-completion window expired, disconnecting')
      setHasTimedOut(true)
    }, remaining)

    return () => clearTimeout(timer)
  }, [status, completedAt, hasTimedOut])

  // Connect/disconnect Realtime
  useEffect(() => {
    // Disconnect if shouldn't connect
    if (!shouldConnect) {
      if (channelRef.current) {
        console.log('[CampaignRealtime] Disconnecting...')
        removeChannel(channelRef.current)
        channelRef.current = null
        setIsActuallyConnected(false)
      }
      return
    }

    mountedRef.current = true

    const channelName = `campaign-${campaignId}-${Date.now()}`
    const channel = createRealtimeChannel(channelName)

    if (!channel) {
      console.warn('[CampaignRealtime] Supabase not configured, skipping realtime')
      return
    }

    channelRef.current = channel

    // Subscribe to campaign table updates
    subscribeToTable(channel, 'campaigns', 'UPDATE', handleCampaignUpdate, `id=eq.${campaignId}`)

    // Subscribe to campaign_contacts for message progress
    subscribeToTable(channel, 'campaign_contacts', '*', handleContactUpdate, `campaign_id=eq.${campaignId}`)

    // Activate channel
    activateChannel(channel)
      .then(() => {
        console.log(`[CampaignRealtime] Connected (debounce: ${debounceTime}ms)`)
        setIsActuallyConnected(true)
      })
      .catch((err) => {
        console.error('[CampaignRealtime] Failed to connect:', err)
        setIsActuallyConnected(false)
      })

    return () => {
      mountedRef.current = false
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (channelRef.current) {
        console.log(`[CampaignRealtime] Cleanup: Disconnecting`)
        removeChannel(channelRef.current)
        channelRef.current = null
        setIsActuallyConnected(false)
      }
    }
  }, [shouldConnect, campaignId, debounceTime, handleCampaignUpdate, handleContactUpdate])

  // Show refresh button when not connected
  const showRefreshButton = !shouldConnect || hasTimedOut

  return {
    isConnected: isActuallyConnected,
    shouldShowRefreshButton: showRefreshButton,
  }
}
