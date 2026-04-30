import { getCampaignsServer } from '@/lib/data/campaigns'
import { CampaignsClientWrapper } from './CampaignsClientWrapper'

// Server Component
export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const initialData = await getCampaignsServer()

  return (
    <CampaignsClientWrapper initialData={initialData} />
  )
}
