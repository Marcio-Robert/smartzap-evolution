'use client'

/**
 * useRealtimeNotifications Hook
 * 
 * Subscribes to global events and shows toast notifications.
 * Part of US5: Real-time Notifications (T021)
 */

import { useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { createRealtimeChannel, subscribeToTable, activateChannel, removeChannel } from '@/lib/supabase-realtime'
import type { RealtimePayload, RealtimeTable } from '@/types'

interface NotificationConfig {
    table: RealtimeTable
    getMessage: (payload: RealtimePayload) => string | null
    type?: 'success' | 'info' | 'warning' | 'error'
}

const DEFAULT_NOTIFICATIONS: NotificationConfig[] = [
    {
        table: 'campaigns',
        getMessage: (payload) => {
            const data = payload.new as Record<string, unknown> | null
            if (!data) return null

            if (payload.eventType === 'UPDATE') {
                if (data.status === 'Concluído') {
                    return `Campanha "${data.name}" concluída!`
                }
                if (data.status === 'Falhou') {
                    return `Campanha "${data.name}" falhou`
                }
            }
            return null
        },
        type: 'success',
    },
    {
        table: 'contacts',
        getMessage: (payload) => {
            if (payload.eventType === 'INSERT') {
                const data = payload.new as Record<string, unknown> | null
                if (data?.name) {
                    return `Novo contato: ${data.name}`
                }
            }
            return null
        },
        type: 'info',
    },
]

interface UseRealtimeNotificationsOptions {
    /**
     * Enable/disable notifications (default: true)
     */
    enabled?: boolean

    /**
     * Custom notification configurations (default: campaigns + contacts)
     */
    notifications?: NotificationConfig[]
}

/**
 * Shows toast notifications for real-time events
 * 
 * @example
 * ```tsx
 * // In layout or root component
 * useRealtimeNotifications({ enabled: true })
 * ```
 */
export function useRealtimeNotifications({
    enabled = true,
    notifications = DEFAULT_NOTIFICATIONS,
}: UseRealtimeNotificationsOptions = {}) {
    const channelRef = useRef<ReturnType<typeof createRealtimeChannel> | null>(null)
    const mountedRef = useRef(true)

    const handleEvent = useCallback((config: NotificationConfig, payload: RealtimePayload) => {
        if (!mountedRef.current) return

        const message = config.getMessage(payload)
        if (!message) return

        // Show toast based on type
        switch (config.type) {
            case 'success':
                toast.success(message)
                break
            case 'warning':
                toast.warning(message)
                break
            case 'error':
                toast.error(message)
                break
            case 'info':
            default:
                toast.info(message)
        }
    }, [])

    useEffect(() => {
        if (!enabled) return

        mountedRef.current = true

        const channelName = `notifications-${Date.now()}`
        const channel = createRealtimeChannel(channelName)

        // Skip if Supabase not configured
        if (!channel) {
            console.warn('[useRealtimeNotifications] Supabase not configured, skipping')
            return
        }

        channelRef.current = channel

        // Subscribe to each configured table
        notifications.forEach((config) => {
            subscribeToTable(channel, config.table, '*', (payload) => {
                handleEvent(config, payload)
            })
        })

        // Activate
        activateChannel(channel).catch((err) => {
            console.error('[useRealtimeNotifications] Failed to subscribe:', err)
        })

        return () => {
            mountedRef.current = false
            if (channelRef.current) {
                removeChannel(channelRef.current)
                channelRef.current = null
            }
        }
    }, [enabled, notifications, handleEvent])
}
