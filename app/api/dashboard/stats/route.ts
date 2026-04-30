import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Fetch stats from Supabase
    const { data, error } = await supabase
      .from('campaigns')
      .select('sent, delivered, read, failed, status')

    if (error) throw error

    // Calculate aggregates
    let totalSent = 0
    let totalDelivered = 0
    let totalRead = 0
    let totalFailed = 0
    let activeCampaigns = 0

      ; (data || []).forEach(row => {
        totalSent += row.sent || 0
        totalDelivered += row.delivered || 0
        totalRead += row.read || 0
        totalFailed += row.failed || 0
        if (row.status === 'Enviando' || row.status === 'Agendado') {
          activeCampaigns++
        }
      })

    // Calculate delivery rate
    const deliveryRate = totalSent > 0
      ? Math.round((totalDelivered / totalSent) * 100)
      : 0

    return NextResponse.json(
      {
        totalSent,
        totalDelivered,
        totalRead,
        totalFailed,
        activeCampaigns,
        deliveryRate,
      },
      {
        headers: {
          // Cache no CDN por 15s, serve stale enquanto revalida em background
          'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
