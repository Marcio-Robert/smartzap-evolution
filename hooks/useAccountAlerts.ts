import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AccountAlert } from '@/app/api/account/alerts/route'

interface AlertsResponse {
  alerts: AccountAlert[]
  error?: string
}

async function fetchAlerts(): Promise<AlertsResponse> {
  const response = await fetch('/api/account/alerts')
  if (!response.ok) {
    throw new Error('Falha ao carregar alertas')
  }
  return response.json()
}

async function dismissAlert(alertId: string): Promise<void> {
  const response = await fetch(`/api/account/alerts?id=${alertId}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    throw new Error('Falha ao dispensar alerta')
  }
}

async function dismissAllAlerts(): Promise<void> {
  const response = await fetch('/api/account/alerts?all=true', {
    method: 'DELETE'
  })
  if (!response.ok) {
    throw new Error('Falha ao dispensar alertas')
  }
}

export function useAccountAlerts() {
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['account-alerts'],
    queryFn: fetchAlerts,
    refetchInterval: 60000, // Poll every 60 seconds (optimized)
    staleTime: 30000, // Keep data fresh for 30s
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    refetchOnWindowFocus: false, // Don't refetch on focus to reduce load
  })

  const dismissMutation = useMutation({
    mutationFn: dismissAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-alerts'] })
    }
  })

  const dismissAllMutation = useMutation({
    mutationFn: dismissAllAlerts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-alerts'] })
    }
  })

  const alerts = data?.alerts || []

  // Group alerts by type for UI organization
  const paymentAlerts = alerts.filter(a => a.type === 'payment')
  const authAlerts = alerts.filter(a => a.type === 'auth')
  const templateAlerts = alerts.filter(a => a.type === 'template')
  const systemAlerts = alerts.filter(a => a.type === 'system')
  const rateLimitAlerts = alerts.filter(a => a.type === 'rate_limit')

  // Get most critical alert for banner display
  const criticalAlert = paymentAlerts[0] || authAlerts[0] || null

  return {
    // All alerts
    alerts,

    // Grouped alerts
    paymentAlerts,
    authAlerts,
    templateAlerts,
    systemAlerts,
    rateLimitAlerts,

    // Most critical for banner
    criticalAlert,
    hasCriticalAlert: !!criticalAlert,

    // State
    isLoading,
    error,

    // Actions
    dismiss: (id: string) => dismissMutation.mutate(id),
    dismissAll: () => dismissAllMutation.mutate(),
    refetch,

    // Mutation states
    isDismissing: dismissMutation.isPending,
  }
}
