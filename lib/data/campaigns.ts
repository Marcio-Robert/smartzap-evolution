import { supabase } from '@/lib/supabase'
import { Campaign } from '@/types'

export async function getCampaignsServer(): Promise<Campaign[]> {
    const { data, error } = await supabase.from('campaigns')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching campaigns:', error)
        return []
    }

    // Map to Campaign type (simulating API response transformation if needed)
    return (data || []).map(row => ({
        ...row,
        createdAt: row.created_at, // simple camelCase mapping if needed
        // Add other fields mapping if strict type required
    })) as Campaign[]
}
