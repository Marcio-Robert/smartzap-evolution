import { Redis } from '@upstash/redis'

// Check if Redis is configured
export function isRedisAvailable(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

// Initialize Redis client
// We use a proxy to handle "connection" errors gracefully if env vars are missing
const redisClient = isRedisAvailable()
  ? new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
  : null

// Export a robust redis object that handles missing configuration
// This acts as a proxy to the real Redis client if available
export const redis = redisClient || {
  get: async () => null,
  set: async () => null,
  del: async () => 0,
  hget: async () => null,
  hset: async () => 0,
  hdel: async () => 0,
  hgetall: async () => null,
  incr: async () => 0,
  expire: async () => 0,
  exists: async () => 0,
  keys: async () => [],
  mget: async () => [],
  scan: async () => [0, []],
  ping: async () => { throw new Error('Redis not configured') },
  dbsize: async () => 0,
  type: async () => 'none',
  ttl: async () => -2,
  setex: async () => null,
  lpush: async () => 0,
  rpush: async () => 0,
  lrange: async () => [],
  llen: async () => 0,
  hincrby: async () => 0,
} as unknown as Redis

// =============================================================================
// CONVERSATION STATE
// =============================================================================

export interface ConversationState {
  conversationId: string
  botId: string
  currentNodeId?: string
  status: 'active' | 'paused' | 'ended'
  variables: Record<string, string>
  lastMessageAt: string
  cswStartedAt?: string
}

export async function getConversationState(conversationId: string): Promise<ConversationState | null> {
  if (!redisClient) return null
  return await redis.get(`conversation:${conversationId}`)
}

export async function setConversationState(state: ConversationState): Promise<void> {
  if (!redisClient) return
  await redis.set(`conversation:${state.conversationId}`, state)
}

export async function deleteConversationState(conversationId: string): Promise<void> {
  if (!redisClient) return
  await redis.del(`conversation:${conversationId}`)
}

// =============================================================================
// CONVERSATION VARIABLES
// =============================================================================

export async function getConversationVariables(conversationId: string): Promise<Record<string, string> | null> {
  if (!redisClient) return null
  return await redis.hgetall(`conversation:${conversationId}:vars`)
}

export async function setConversationVariables(conversationId: string, variables: Record<string, string>): Promise<void> {
  if (!redisClient) return
  if (Object.keys(variables).length === 0) return
  await redis.hset(`conversation:${conversationId}:vars`, variables)
}

export async function setConversationVariable(conversationId: string, key: string, value: string): Promise<void> {
  if (!redisClient) return
  await redis.hset(`conversation:${conversationId}:vars`, { [key]: value })
}

// =============================================================================
// RATE LIMITING
// =============================================================================

export async function checkPairRateLimit(phoneNumberId: string, recipientPhone: string): Promise<boolean> {
  if (!redisClient) return true // Allow if Redis off

  const key = `ratelimit:${phoneNumberId}:${recipientPhone}`
  const exists = await redis.exists(key)
  return exists === 0
}

export async function setPairRateLimit(phoneNumberId: string, recipientPhone: string): Promise<void> {
  if (!redisClient) return

  const key = `ratelimit:${phoneNumberId}:${recipientPhone}`
  // 5 seconds rate limit between messages to same user
  await redis.set(key, '1', { ex: 5 })
}

export async function getPairRateLimitTTL(phoneNumberId: string, recipientPhone: string): Promise<number> {
  if (!redisClient) return 0
  const key = `ratelimit:${phoneNumberId}:${recipientPhone}`
  return await redis.ttl(key)
}

// =============================================================================
// CSW (24h Customer Service Window)
// =============================================================================

export async function checkCSW(phoneNumberId: string, recipientPhone: string): Promise<boolean> {
  if (!redisClient) return false

  const key = `csw:${phoneNumberId}:${recipientPhone}`
  const exists = await redis.exists(key)
  return exists === 1
}

export async function setCSW(phoneNumberId: string, recipientPhone: string): Promise<void> {
  if (!redisClient) return

  const key = `csw:${phoneNumberId}:${recipientPhone}`
  const now = new Date().toISOString()
  // 24 hours = 86400 seconds
  await redis.set(key, now, { ex: 86400 })
}

export async function getCSWStartTime(phoneNumberId: string, recipientPhone: string): Promise<string | null> {
  if (!redisClient) return null
  const key = `csw:${phoneNumberId}:${recipientPhone}`
  return await redis.get<string>(key)
}

export async function getCSWTimeRemaining(phoneNumberId: string, recipientPhone: string): Promise<number> {
  if (!redisClient) return 0
  const key = `csw:${phoneNumberId}:${recipientPhone}`
  return await redis.ttl(key)
}

// =============================================================================
// FLOW CACHE
// =============================================================================

export async function getFlowFromCache(flowId: string): Promise<unknown | null> {
  if (!redisClient) return null
  return await redis.get(`flow:${flowId}`)
}

export async function setFlowInCache(flowId: string, flow: unknown): Promise<void> {
  if (!redisClient) return
  await redis.set(`flow:${flowId}`, flow, { ex: 3600 }) // Cache for 1 hour
}

export async function invalidateFlowCache(flowId: string): Promise<void> {
  if (!redisClient) return
  await redis.del(`flow:${flowId}`)
}