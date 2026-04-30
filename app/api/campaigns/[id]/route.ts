import { NextResponse } from 'next/server'
import { campaignDb } from '@/lib/supabase-db'

// Force dynamic rendering (no caching)
export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET /api/campaigns/[id]
 * Get a single campaign
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const campaign = await campaignDb.getById(id)

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      )
    }

    // No cache for campaign data (needs real-time updates)
    return NextResponse.json(campaign, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
  } catch (error) {
    console.error('Failed to fetch campaign:', error)
    return NextResponse.json(
      { error: 'Falha ao buscar campanha', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/campaigns/[id]
 * Update a campaign
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const campaign = await campaignDb.updateStatus(id, body)

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(campaign)
  } catch (error) {
    console.error('Failed to update campaign:', error)
    return NextResponse.json(
      { error: 'Falha ao atualizar campanha', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/campaigns/[id]
 * Delete a campaign
 */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params
    await campaignDb.delete(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete campaign:', error)
    return NextResponse.json(
      { error: 'Falha ao deletar campanha', details: (error as Error).message },
      { status: 500 }
    )
  }
}
