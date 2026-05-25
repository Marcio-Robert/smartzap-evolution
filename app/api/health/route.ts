import { NextResponse } from 'next/server'
import { getHealthStatus } from '@/lib/health-check'

/**
 * Health Check API — SmartZap EVO
 * Uses centralized health-check module
 */
export async function GET() {
  const result = await getHealthStatus({ checkExternal: true, checkPing: true })

  return NextResponse.json(result, {
    headers: {
      // Cache no CDN por 30s
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  })
}
