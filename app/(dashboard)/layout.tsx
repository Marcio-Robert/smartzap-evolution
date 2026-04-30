import { getUserAuthStatus } from '@/lib/user-auth'
import { getHealthStatus } from '@/lib/health-check'
import { DashboardShell } from './DashboardShell'

// This is a Server Component
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fetch everything in parallel on the server
  // NO loading spinners, instant initial HTML
  const [authStatus, healthStatus] = await Promise.all([
    getUserAuthStatus(),
    getHealthStatus({ checkExternal: false, checkPing: false }), // Fast check for critical path
  ])

  return (
    <DashboardShell
      initialAuthStatus={authStatus}
      initialHealthStatus={healthStatus}
    >
      {children}
    </DashboardShell>
  )
}
