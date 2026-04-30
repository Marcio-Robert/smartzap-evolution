/**
 * Supabase Realtime Utilities
 * 
 * Provides utilities for subscribing to Postgres changes via Supabase Realtime.
 * Follows constitution: API-first, Type Safety, Simplicity.
 */

import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { getSupabaseBrowser } from './supabase'
import type { RealtimeTable, RealtimeEventType, RealtimePayload, ChannelStatus } from '@/types'

// ============================================================================
// CHANNEL MANAGER
// ============================================================================

/**
 * Creates a Realtime channel for subscribing to Postgres changes
 * 
 * @param channelName - Unique name for this channel
 * @returns RealtimeChannel instance
 */
export function createRealtimeChannel(channelName: string): RealtimeChannel | null {
    const supabase = getSupabaseBrowser()
    if (!supabase) return null
    return supabase.channel(channelName)
}

/**
 * Subscribes to Postgres changes on a table
 * 
 * @param channel - The channel to add subscription to
 * @param table - Table name to listen to
 * @param event - Event type (INSERT, UPDATE, DELETE, *)
 * @param callback - Handler for received events
 * @param filter - Optional PostgREST filter (e.g., 'id=eq.123')
 * @returns The channel with subscription added
 */
export function subscribeToTable<T extends Record<string, unknown> = Record<string, unknown>>(
    channel: RealtimeChannel,
    table: RealtimeTable,
    event: RealtimeEventType,
    callback: (payload: RealtimePayload<T>) => void,
    filter?: string
): RealtimeChannel {
    // Use type assertion for config since Supabase types are strict
    const config = {
        event,
        schema: 'public' as const,
        table,
        ...(filter && { filter }),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return channel.on('postgres_changes' as any, config as any, (payload: any) => {
        callback(payload as RealtimePayload<T>)
    })
}

/**
 * Activates channel subscription
 * 
 * @param channel - The channel to activate
 * @param onStatusChange - Optional callback for status changes
 * @returns Promise that resolves when subscribed
 */
export async function activateChannel(
    channel: RealtimeChannel,
    onStatusChange?: (status: ChannelStatus) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        channel.subscribe((status) => {
            onStatusChange?.(status as ChannelStatus)

            if (status === 'SUBSCRIBED') {
                resolve()
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                reject(new Error(`Channel subscription failed: ${status}`))
            }
        })
    })
}

/**
 * Removes a channel and all its subscriptions
 * 
 * @param channel - The channel to remove
 */
export function removeChannel(channel: RealtimeChannel): void {
    const supabase = getSupabaseBrowser()
    if (!supabase) return
    supabase.removeChannel(channel)
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Creates a subscription to a single table with automatic cleanup
 * Convenience function for simple use cases
 * 
 * @param table - Table name
 * @param event - Event type
 * @param callback - Handler function
 * @param filter - Optional filter
 * @returns Cleanup function to remove subscription
 */
export function createTableSubscription<T extends Record<string, unknown> = Record<string, unknown>>(
    table: RealtimeTable,
    event: RealtimeEventType,
    callback: (payload: RealtimePayload<T>) => void,
    filter?: string
): () => void {
    const channelName = `${table}-${Date.now()}`
    const channel = createRealtimeChannel(channelName)

    // Return no-op cleanup if Supabase not configured
    if (!channel) {
        console.warn('[Realtime] Supabase not configured, skipping subscription')
        return () => { }
    }

    subscribeToTable<T>(channel, table, event, callback, filter)

    // Activate without waiting
    activateChannel(channel).catch((err) => {
        console.error(`[Realtime] Failed to subscribe to ${table}:`, err)
    })

    // Return cleanup function
    return () => removeChannel(channel)
}

