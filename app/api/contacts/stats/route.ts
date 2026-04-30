import { NextResponse } from 'next/server'
import { contactDb } from '@/lib/supabase-db'

/**
 * GET /api/contacts/stats
 * Get contact statistics
 */
export async function GET() {
  try {
    const stats = await contactDb.getStats()
    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    })
  } catch (error) {
    console.error('Failed to fetch contact stats:', error)
    return NextResponse.json(
      { error: 'Falha ao buscar estatísticas', details: (error as Error).message },
      { status: 500 }
    )
  }
}
