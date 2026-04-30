import { getDashboardStatsServer } from '@/lib/data/dashboard'
import { DashboardView } from '@/components/features/dashboard/DashboardView'
import { DashboardClientWrapper } from './DashboardClientWrapper'

// Server Component
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const initialData = await getDashboardStatsServer()

  return (
    <DashboardClientWrapper initialData={initialData} />
  )
}
