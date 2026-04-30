import { NextResponse } from 'next/server'
import { redis, isRedisAvailable } from '@/lib/redis'
import { getWhatsAppCredentials, getCredentialsSource } from '@/lib/whatsapp-credentials'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

/**
 * GET /api/system
 * 
 * Consolidated endpoint that returns:
 * - Health status of all services
 * - Usage metrics for Vercel, Redis, Turso, WhatsApp
 * - Vercel deployment info
 * 
 * This replaces 3 separate API calls with 1, reducing function invocations.
 */

// === TYPES ===

interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  services: {
    database: { status: 'ok' | 'error' | 'not_configured'; latency?: number; message?: string }
    redis: { status: 'ok' | 'error' | 'not_configured'; latency?: number; message?: string }
    qstash: { status: 'ok' | 'error' | 'not_configured'; message?: string }
    whatsapp: { status: 'ok' | 'error' | 'not_configured'; source?: string; phoneNumber?: string; message?: string }
  }
}

interface UsageData {
  vercel: {
    plan: 'hobby' | 'pro' | 'enterprise' | 'unknown'
    functionInvocations: number
    functionLimit: number
    functionPercentage: number
    edgeRequests: number
    edgeLimit: number
    edgePercentage: number
    buildMinutes: number
    buildLimit: number
    buildPercentage: number
    percentage: number
    status: 'ok' | 'warning' | 'critical'
  }
  redis: {
    commandsToday: number
    limit: number
    percentage: number
    status: 'ok' | 'warning' | 'critical'
  }
  database: {
    plan: 'free' | 'pro' | 'team' | 'enterprise' | 'unknown'
    storageMB: number
    limitMB: number
    bandwidthMB: number
    bandwidthLimitMB: number
    percentage: number
    rowsRead: number
    rowsWritten: number
    status: 'ok' | 'warning' | 'critical'
  }
  whatsapp: {
    messagesSent: number
    tier: string
    tierLimit: number
    percentage: number
    quality: string
    status: 'ok' | 'warning' | 'critical'
  }
  qstash: {
    messagesMonth: number
    messagesLimit: number
    percentage: number
    cost: number
    status: 'ok' | 'warning' | 'critical'
  }
}

interface VercelInfo {
  dashboardUrl: string | null
  storesUrl: string | null
  env: string
}

interface SystemResponse {
  health: HealthStatus
  usage: UsageData
  vercel: VercelInfo
  timestamp: string
  debug?: Record<string, string>
}

// === HELPERS ===

function getStatus(percentage: number): 'ok' | 'warning' | 'critical' {
  if (percentage >= 90) return 'critical'
  if (percentage >= 70) return 'warning'
  return 'ok'
}

function buildVercelDashboardUrl(): string | null {
  const vercelUrl = process.env.VERCEL_URL
  if (!vercelUrl) return null

  const cleanUrl = vercelUrl.replace('.vercel.app', '')
  const scopeMatch = cleanUrl.match(/-([a-z0-9]+-projects)$/) || cleanUrl.match(/-([a-z0-9-]+)$/)
  if (!scopeMatch) return null

  const scope = scopeMatch[1]
  const beforeScope = cleanUrl.replace(`-${scope}`, '')
  const lastHyphen = beforeScope.lastIndexOf('-')
  if (lastHyphen === -1) return null

  const possibleHash = beforeScope.substring(lastHyphen + 1)
  const projectName = beforeScope.substring(0, lastHyphen)

  if (!/^[a-z0-9]{7,12}$/.test(possibleHash)) return null

  return `https://vercel.com/${scope}/${projectName}`
}

// === MAIN HANDLER ===

export async function GET() {
  const startTime = Date.now()

  // Initialize response structure
  const response: SystemResponse = {
    health: {
      overall: 'healthy',
      services: {
        database: { status: 'not_configured' },
        redis: { status: 'not_configured' },
        qstash: { status: 'not_configured' },
        whatsapp: { status: 'not_configured' },
      },
    },
    usage: {
      vercel: {
        plan: 'unknown',
        functionInvocations: 0,
        functionLimit: 100000, // Hobby default
        functionPercentage: 0,
        edgeRequests: 0,
        edgeLimit: 1000000, // Hobby default
        edgePercentage: 0,
        buildMinutes: 0,
        buildLimit: 6000, // 100h = 6000min
        buildPercentage: 0,
        percentage: 0,
        status: 'ok',
      },
      redis: { commandsToday: 0, limit: 10000, percentage: 0, status: 'ok' },
      database: { plan: 'unknown', storageMB: 0, limitMB: 500, bandwidthMB: 0, bandwidthLimitMB: 5000, percentage: 0, rowsRead: 0, rowsWritten: 0, status: 'ok' },
      whatsapp: { messagesSent: 0, tier: 'STANDARD', tierLimit: 100000, percentage: 0, quality: 'GREEN', status: 'ok' },
      qstash: { messagesMonth: 0, messagesLimit: 500, percentage: 0, cost: 0, status: 'ok' },
    },
    vercel: {
      dashboardUrl: buildVercelDashboardUrl(),
      storesUrl: null,
      env: process.env.VERCEL_ENV || 'development',
    },
    timestamp: new Date().toISOString(),
  }

  // Build stores URL
  if (response.vercel.dashboardUrl) {
    response.vercel.storesUrl = `${response.vercel.dashboardUrl}/stores`
  }

  // === PARALLEL CHECKS ===
  // Run all checks in parallel for speed

  await Promise.all([
    // 1. DATABASE (Supabase)
    (async () => {
      // Check if configured (using public URL/Key for now as proxy for complete setup)
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        try {
          const start = Date.now()

          // Create admin client to bypass RLS for health/usage checks
          const { createClient } = await import('@supabase/supabase-js')
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL

          if (!serviceKey || !url) throw new Error('Missing Supabase Service Key')

          const supabaseAdmin = createClient(url, serviceKey, {
            auth: { persistSession: false }
          })

          // Health check: simple query
          const { error } = await supabaseAdmin.from('campaigns').select('id').limit(1)

          if (error && !error.message.includes('No rows')) throw error

          response.health.services.database = { status: 'ok', latency: Date.now() - start }

          // Try to get actual database size via RPC (requires a Supabase function)
          // If not available, estimate from row counts
          let actualSizeMB = 0

          try {
            // Try to call a database function that returns size
            const { data: sizeData } = await supabaseAdmin.rpc('get_db_size')
            if (sizeData) {
              actualSizeMB = Math.round((sizeData / (1024 * 1024)) * 100) / 100
            } else {
              throw new Error('RPC not found')
            }
          } catch {
            // RPC not available, estimate from row counts using Admin Client
            const [
              { count: campaignsCount },
              { count: contactsCount },
              { count: campaignContactsCount }
            ] = await Promise.all([
              supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true }),
              supabaseAdmin.from('contacts').select('*', { count: 'exact', head: true }),
              supabaseAdmin.from('campaign_contacts').select('*', { count: 'exact', head: true })
            ])

            const totalRows = (campaignsCount || 0) + (contactsCount || 0) + (campaignContactsCount || 0)
            // Estimate: ~1KB per row average
            actualSizeMB = Math.round((totalRows * 1024) / (1024 * 1024) * 100) / 100
          }

          response.usage.database.storageMB = actualSizeMB

          // Detect plan via Supabase Management API if token available
          const supabaseToken = process.env.SUPABASE_ACCESS_TOKEN
          const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
          const projectRef = projectUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

          if (supabaseToken && projectRef) {
            try {
              // Get project info to find organization_id
              const projectsRes = await fetch('https://api.supabase.com/v1/projects', {
                headers: { 'Authorization': `Bearer ${supabaseToken}` },
              })

              if (projectsRes.ok) {
                const projects = await projectsRes.json()
                const project = projects.find((p: any) => p.ref === projectRef)

                if (project?.organization_id) {
                  // Get organization to find plan
                  const orgRes = await fetch(`https://api.supabase.com/v1/organizations/${project.organization_id}`, {
                    headers: { 'Authorization': `Bearer ${supabaseToken}` },
                  })

                  if (orgRes.ok) {
                    const org = await orgRes.json()
                    const orgPlan = org.plan?.toLowerCase() || 'free'

                    // Set plan and limits based on organization plan
                    if (orgPlan === 'enterprise') {
                      response.usage.database.plan = 'enterprise'
                      response.usage.database.limitMB = 1000000 // Essentially unlimited
                    } else if (orgPlan === 'team') {
                      response.usage.database.plan = 'team'
                      response.usage.database.limitMB = 8000 // 8GB
                    } else if (orgPlan === 'pro') {
                      response.usage.database.plan = 'pro'
                      response.usage.database.limitMB = 8000 // 8GB
                    } else {
                      response.usage.database.plan = 'free'
                      response.usage.database.limitMB = 500 // 500MB
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Failed to get Supabase plan:', e)
              // Fallback to free plan with default limits
              response.usage.database.plan = 'unknown'
              response.usage.database.limitMB = 500
            }
          } else {
            // No token available - use size-based detection as fallback
            if (actualSizeMB > 400) {
              response.usage.database.plan = 'pro'
              response.usage.database.limitMB = 8000
              response.usage.database.bandwidthLimitMB = 250000 // 250GB
            } else {
              response.usage.database.plan = 'free'
              response.usage.database.limitMB = 500
              response.usage.database.bandwidthLimitMB = 5000 // 5GB
            }
          }

          // Set bandwidth limit based on detected plan
          if (response.usage.database.plan === 'pro' || response.usage.database.plan === 'team') {
            response.usage.database.bandwidthLimitMB = 250000 // 250GB
          } else if (response.usage.database.plan === 'enterprise') {
            response.usage.database.bandwidthLimitMB = 1000000 // 1TB+
          } else {
            response.usage.database.bandwidthLimitMB = 5000 // 5GB Free
          }

          // Fetch bandwidth from Prometheus metrics if service role key available
          const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
          if (serviceRoleKey) {
            try {
              const metricsUrl = `${projectUrl}/customer/v1/privileged/metrics`
              const auth = Buffer.from(`service_role:${serviceRoleKey}`).toString('base64')

              const metricsRes = await fetch(metricsUrl, {
                headers: { 'Authorization': `Basic ${auth}` },
              })

              if (metricsRes.ok) {
                const metricsText = await metricsRes.text()
                // Parse node_network_transmit_bytes_total (egress)
                const transmitMatch = metricsText.match(/node_network_transmit_bytes_total\{[^}]*device="ens5"[^}]*\}\s+([\d.e+]+)/)
                if (transmitMatch) {
                  const transmitBytes = parseFloat(transmitMatch[1])
                  response.usage.database.bandwidthMB = Math.round((transmitBytes / (1024 * 1024)) * 100) / 100
                }
              }
            } catch (e) {
              console.error('Failed to get Prometheus metrics:', e)
            }
          }

          response.usage.database.percentage = Math.round((response.usage.database.storageMB / response.usage.database.limitMB) * 100 * 10) / 10
          response.usage.database.status = getStatus(response.usage.database.percentage)

          // Get WhatsApp messages sent
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

          const { data: campaigns } = await supabase
            .from('campaigns')
            .select('sent')
            .gte('created_at', thirtyDaysAgo.toISOString())

          const totalSent = campaigns?.reduce((sum: number, c: any) => sum + (c.sent || 0), 0) || 0

          response.usage.whatsapp.messagesSent = totalSent
        } catch (error) {
          response.health.services.database = { status: 'error', message: (error as Error).message }
          response.health.overall = 'unhealthy'
        }
      } else {
        response.health.services.database = { status: 'not_configured', message: 'Supabase credentials not set' }
        response.health.overall = 'unhealthy'
      }
    })(),

    // 2. REDIS (Use Upstash Developer API for accurate stats)
    (async () => {
      if (isRedisAvailable() && redis) {
        try {
          // Try to get from cache first
          const cacheKey = 'system:health:redis'
          const cached = await redis.get(cacheKey) as any

          if (cached) {
            response.health.services.redis = cached.health
            response.usage.redis = cached.usage
            return
          }

          const start = Date.now()
          await redis.ping()
          const latency = Date.now() - start

          const newHealth = { status: 'ok' as const, latency }

          // Try Upstash Developer API for accurate stats
          const upstashApiKey = process.env.UPSTASH_API_KEY
          const upstashEmail = process.env.UPSTASH_EMAIL
          let upstashDatabaseId = process.env.UPSTASH_DATABASE_ID
          const upstashConsoleUrl = process.env.UPSTASH_CONSOLE_URL

          // Extract database ID from console URL if not provided directly
          if (!upstashDatabaseId && upstashConsoleUrl) {
            const match = upstashConsoleUrl.match(/\/redis\/([a-f0-9-]{36})/i)
            if (match) upstashDatabaseId = match[1]
          }

          let newUsage = {
            commandsToday: 0,
            limit: 10000, // Free tier default
            percentage: 0,
            status: 'ok' as 'ok' | 'warning' | 'critical'
          }

          if (upstashApiKey && upstashEmail && upstashDatabaseId) {
            try {
              const statsResponse = await fetch(
                `https://api.upstash.com/v2/redis/stats/${upstashDatabaseId}`,
                {
                  headers: {
                    'Authorization': `Basic ${Buffer.from(`${upstashEmail}:${upstashApiKey}`).toString('base64')}`,
                  },
                }
              )

              if (statsResponse.ok) {
                const stats = await statsResponse.json()
                // Use daily_read_requests + daily_write_requests for today's commands
                const todayCommands = (stats.daily_read_requests || 0) + (stats.daily_write_requests || 0)
                newUsage.commandsToday = todayCommands

                // Check if Pay-as-you-go (unlimited) or has a limit
                const requestLimit = stats.db_request_limit
                if (!requestLimit || requestLimit > 1000000000) {
                  // Pay-as-you-go = unlimited
                  newUsage.limit = 0
                  newUsage.percentage = 0
                  newUsage.status = 'ok'
                } else {
                  newUsage.limit = requestLimit
                  newUsage.percentage = Math.round((newUsage.commandsToday / newUsage.limit) * 100 * 10) / 10
                  newUsage.status = getStatus(newUsage.percentage)
                }
              }
            } catch (e) {
              console.error('Failed to get Upstash stats via API:', e)
              // Fallback: assume unlimited if API fails but ping works
              newUsage.limit = 0
              newUsage.percentage = 0
            }
          } else {
            // No API credentials - just confirm connectivity, assume unlimited
            newUsage.limit = 0
            newUsage.percentage = 0
          }

          response.health.services.redis = { ...newHealth, status: 'ok' }
          response.usage.redis = newUsage as any

          // Cache for 5 minutes
          await redis.setex(cacheKey, 300, { health: newHealth, usage: newUsage })
        } catch (error) {
          response.health.services.redis = { status: 'error', message: (error as Error).message }
          response.health.overall = 'degraded'
        }
      } else {
        response.health.services.redis = { status: 'not_configured', message: 'Redis not configured' }
        response.health.overall = 'degraded'
      }
    })(),

    // 3. QSTASH (with usage stats)
    (async () => {
      if (process.env.QSTASH_TOKEN) {
        response.health.services.qstash = { status: 'ok', message: 'Token configured' }

        // Fetch QStash usage stats if management API credentials available
        const upstashEmail = process.env.UPSTASH_EMAIL
        const upstashApiKey = process.env.UPSTASH_API_KEY

        if (upstashEmail && upstashApiKey) {
          try {
            const auth = Buffer.from(`${upstashEmail}:${upstashApiKey}`).toString('base64')
            const statsRes = await fetch('https://api.upstash.com/v2/qstash/stats', {
              headers: { 'Authorization': `Basic ${auth}` },
            })

            if (statsRes.ok) {
              const stats = await statsRes.json()

              // Sum up daily requests for the current month
              const monthlyMessages = stats.daily_requests?.reduce((sum: number, day: any) => sum + (day.y || 0), 0) || 0
              const monthlyBilling = stats.total_monthly_billing || 0

              // Detect if on paid plan (Pro/Pay-as-you-go has no limit)
              const isPayAsYouGo = monthlyBilling > 0 || monthlyMessages > 500

              response.usage.qstash = {
                messagesMonth: monthlyMessages,
                messagesLimit: isPayAsYouGo ? 0 : 500, // 0 = unlimited for pay-as-you-go
                percentage: isPayAsYouGo ? 0 : Math.round((monthlyMessages / 500) * 100 * 10) / 10,
                cost: monthlyBilling,
                status: isPayAsYouGo ? 'ok' : getStatus(Math.round((monthlyMessages / 500) * 100)) as 'ok' | 'warning' | 'critical'
              }
            }
          } catch (e) {
            console.error('Failed to get QStash stats:', e)
          }
        }
      } else {
        response.health.services.qstash = { status: 'not_configured', message: 'QSTASH_TOKEN not set' }
        response.health.overall = 'degraded'
      }
    })(),

    // 4. WHATSAPP (Check cache first)
    (async () => {
      // Try cache first
      if (redis) {
        try {
          const cached = await redis.get('system:health:whatsapp') as any
          if (cached) {
            response.health.services.whatsapp = cached.health
            response.usage.whatsapp = cached.usage
            if (response.debug) response.debug.whatsapp = 'HIT'
            return
          }
        } catch (e) { /* ignore cache errors */ }
      }

      try {
        const source = await getCredentialsSource()
        const credentials = await getWhatsAppCredentials()

        if (credentials) {
          const testUrl = `https://graph.facebook.com/v24.0/${credentials.phoneNumberId}?fields=display_phone_number,whatsapp_business_manager_messaging_limit,quality_score`
          const res = await fetch(testUrl, {
            headers: { 'Authorization': `Bearer ${credentials.accessToken}` },
          })

          if (res.ok) {
            const data = await res.json()
            response.health.services.whatsapp = {
              status: 'ok',
              source,
              phoneNumber: data.display_phone_number,
            }

            // Get tier
            const rawTier = data.whatsapp_business_manager_messaging_limit
            if (typeof rawTier === 'string') {
              response.usage.whatsapp.tier = rawTier
            } else if (rawTier && typeof rawTier === 'object') {
              response.usage.whatsapp.tier = rawTier.current_limit || rawTier.tier || 'TIER_250'
            }

            // Get quality
            response.usage.whatsapp.quality = data.quality_score?.score?.toUpperCase() || 'GREEN'

            // Map tier to limit
            const tierLimits: Record<string, number> = {
              'TIER_250': 250, 'TIER_1K': 1000, 'TIER_2K': 2000,
              'TIER_10K': 10000, 'TIER_100K': 100000, 'TIER_UNLIMITED': 1000000, 'STANDARD': 100000,
            }
            response.usage.whatsapp.tierLimit = tierLimits[response.usage.whatsapp.tier] || 250
          } else {
            const error = await res.json()
            response.health.services.whatsapp = { status: 'error', source, message: error.error?.message || 'Token invalid' }
            response.health.overall = 'degraded'
          }
        } else {
          response.health.services.whatsapp = { status: 'not_configured', source: 'none', message: 'Not configured' }
        }

        // Calculate WhatsApp usage percentage
        response.usage.whatsapp.percentage = Math.round((response.usage.whatsapp.messagesSent / response.usage.whatsapp.tierLimit) * 100 * 10) / 10
        response.usage.whatsapp.status = getStatus(response.usage.whatsapp.percentage)

        // Save to cache if healthy (5 minutes)
        if (redis && response.health.services.whatsapp.status === 'ok') {
          await redis.setex('system:health:whatsapp', 300, {
            health: response.health.services.whatsapp,
            usage: response.usage.whatsapp
          })
        }

      } catch (error) {
        response.health.services.whatsapp = { status: 'error', message: (error as Error).message }
        response.health.overall = 'degraded'
      }
    })(),

    // 5. VERCEL USAGE (optional with cache)
    (async () => {
      if (process.env.VERCEL_API_TOKEN) {
        // Try cache first
        if (redis) {
          try {
            const cached = await redis.get('system:health:vercel') as any
            if (cached) {
              response.usage.vercel = cached
              return
            }
          } catch (e) { /* ignore */ }
        }

        try {
          const teamId = process.env.VERCEL_TEAM_ID || ''
          const now = new Date()
          const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
          const to = now.toISOString()

          // Fetch user info to get defaultTeamId, then fetch team for plan
          const userRes = await fetch('https://api.vercel.com/v2/user', {
            headers: { 'Authorization': `Bearer ${process.env.VERCEL_API_TOKEN}` },
          })

          if (userRes.ok) {
            const userData = await userRes.json()
            const defaultTeamId = userData.user?.defaultTeamId

            // Fetch team info if we have a team ID
            if (defaultTeamId) {
              try {
                const teamRes = await fetch(`https://api.vercel.com/v2/teams/${defaultTeamId}`, {
                  headers: { 'Authorization': `Bearer ${process.env.VERCEL_API_TOKEN}` },
                })

                if (teamRes.ok) {
                  const teamData = await teamRes.json()
                  const billingPlan = teamData.billing?.plan

                  // Detect plan from billing.plan field
                  if (billingPlan === 'enterprise' || billingPlan === 'ent') {
                    response.usage.vercel.plan = 'enterprise'
                    response.usage.vercel.functionLimit = 1000000000 // Unlimited
                    response.usage.vercel.edgeLimit = 1000000000
                    response.usage.vercel.buildLimit = 24000 // 400h
                  } else if (billingPlan === 'pro') {
                    response.usage.vercel.plan = 'pro'
                    response.usage.vercel.functionLimit = 1000000 // 1M
                    response.usage.vercel.edgeLimit = 10000000 // 10M
                    response.usage.vercel.buildLimit = 24000 // 400h
                  } else {
                    response.usage.vercel.plan = 'hobby'
                    response.usage.vercel.functionLimit = 100000 // 100K
                    response.usage.vercel.edgeLimit = 1000000 // 1M
                    response.usage.vercel.buildLimit = 6000 // 100h
                  }
                }
              } catch (e) {
                console.error('Failed to fetch team info:', e)
              }
            }
          }

          const baseUrl = `https://api.vercel.com/v2/usage?teamId=${teamId}&from=${from}&to=${to}`

          const [requestsRes, buildsRes] = await Promise.all([
            fetch(`${baseUrl}&type=requests`, {
              headers: { 'Authorization': `Bearer ${process.env.VERCEL_API_TOKEN}` },
            }),
            fetch(`${baseUrl}&type=builds`, {
              headers: { 'Authorization': `Bearer ${process.env.VERCEL_API_TOKEN}` },
            }),
          ])

          if (requestsRes.ok) {
            const data = await requestsRes.json()
            if (data.data && Array.isArray(data.data)) {
              for (const day of data.data) {
                response.usage.vercel.functionInvocations += (day.function_invocation_successful_count || 0) +
                  (day.function_invocation_error_count || 0) + (day.function_invocation_throttle_count || 0) +
                  (day.function_invocation_timeout_count || 0)
                response.usage.vercel.edgeRequests += (day.request_hit_count || 0) + (day.request_miss_count || 0)
              }
            }
          }

          if (buildsRes.ok) {
            const data = await buildsRes.json()
            if (data.data && Array.isArray(data.data)) {
              for (const day of data.data) {
                response.usage.vercel.buildMinutes += (day.build_build_seconds || 0)
              }
            }
            response.usage.vercel.buildMinutes = Math.round(response.usage.vercel.buildMinutes / 60)
          }

          // Calculate percentages
          response.usage.vercel.functionPercentage = Math.round((response.usage.vercel.functionInvocations / response.usage.vercel.functionLimit) * 100 * 10) / 10
          response.usage.vercel.edgePercentage = Math.round((response.usage.vercel.edgeRequests / response.usage.vercel.edgeLimit) * 100 * 10) / 10
          response.usage.vercel.buildPercentage = Math.round((response.usage.vercel.buildMinutes / response.usage.vercel.buildLimit) * 100 * 10) / 10
          response.usage.vercel.percentage = Math.max(
            response.usage.vercel.functionPercentage,
            response.usage.vercel.edgePercentage,
            response.usage.vercel.buildPercentage
          )
          response.usage.vercel.status = getStatus(response.usage.vercel.percentage)

          // Cache for 5 minutes (Success case)
          if (redis) {
            await redis.setex('system:health:vercel', 300, response.usage.vercel)
          }
        } catch (error) {
          console.error('Failed to get Vercel usage:', error)
          // Cache error state/default to prevent retries
          if (redis) {
            await redis.setex('system:health:vercel', 60, response.usage.vercel) // Cache default/error for 1 min
          }
        }
      }
    })(),
  ])

  // Recalculate overall health
  const statuses = Object.values(response.health.services).map(s => s.status)
  if (statuses.every(s => s === 'ok')) {
    response.health.overall = 'healthy'
  } else if (statuses.some(s => s === 'error') || statuses.filter(s => s === 'not_configured').length > 1) {
    response.health.overall = 'unhealthy'
  } else {
    response.health.overall = 'degraded'
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      'X-Response-Time': `${Date.now() - startTime}ms`,
    },
  })
}
