'use client'

import { useRouter } from 'next/navigation'
import { useCampaignsController } from '@/hooks/useCampaigns'
import { CampaignListView } from '@/components/features/campaigns/CampaignListView'
import { Campaign } from '@/types'

export function CampaignsClientWrapper({ initialData }: { initialData: Campaign[] }) {
    const router = useRouter()
    const {
        campaigns,
        isLoading,
        filter,
        searchTerm,
        setFilter,
        setSearchTerm,
        onDelete,
        onDuplicate,
        onRefresh,
        deletingId,
        duplicatingId,
    } = useCampaignsController(initialData)

    const handleRowClick = (id: string) => {
        router.push(`/campaigns/${id}`)
    }

    return (
        <CampaignListView
            campaigns={campaigns}
            isLoading={isLoading}
            filter={filter}
            searchTerm={searchTerm}
            onFilterChange={setFilter}
            onSearchChange={setSearchTerm}
            onRefresh={onRefresh}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onRowClick={handleRowClick}
            deletingId={deletingId}
            duplicatingId={duplicatingId}
        />
    )
}
