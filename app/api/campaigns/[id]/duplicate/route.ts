import { NextResponse } from 'next/server'
import { campaignDb } from '@/lib/supabase-db'

// Force dynamic - no caching
export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * POST /api/campaigns/[id]/duplicate
 * Duplicate a campaign
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const campaign = await campaignDb.duplicate(id)

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha original não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(campaign, { status: 201 })
  } catch (error) {
    console.error('Failed to duplicate campaign:', error)
    return NextResponse.json(
      { error: 'Falha ao duplicar campanha', details: (error as Error).message },
      { status: 500 }
    )
  }
}
