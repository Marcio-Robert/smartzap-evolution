/**
 * Rate Limiter - Token Bucket Algorithm
 *
 * Controls message sending rate to comply with WhatsApp API limits
 * Ported from NossoFlow with improvements
 */

export interface RateLimiter {
  acquire(): Promise<void>;
  reset(): void;
  getTokensAvailable(): number;
  stop(): void;
  updateRate(messagesPerSecond: number): void;
}

export const DEFAULT_RATE_LIMIT = 80; // messages per second
export const MAX_RATE_LIMIT = 1000;
export const MIN_RATE_LIMIT = 1;

export class TokenBucketRateLimiter implements RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private lastRefill: number;
  private refillInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Creates a new rate limiter
   * @param messagesPerSecond - Maximum messages per second (default: 80)
   */
  constructor(messagesPerSecond: number = DEFAULT_RATE_LIMIT) {
    // Validate rate limit
    if (messagesPerSecond < MIN_RATE_LIMIT || messagesPerSecond > MAX_RATE_LIMIT) {
      throw new Error(`Rate limit must be between ${MIN_RATE_LIMIT} and ${MAX_RATE_LIMIT}`);
    }

    this.maxTokens = messagesPerSecond;
    this.tokens = messagesPerSecond;
    this.refillRate = messagesPerSecond;
    this.lastRefill = Date.now();

    // Start refill interval (refill every second)
    this.startRefill();
  }

  /**
   * Starts the token refill interval
   */
  private startRefill(): void {
    this.refillInterval = setInterval(() => {
      const now = Date.now();
      const timePassed = (now - this.lastRefill) / 1000; // seconds
      const tokensToAdd = timePassed * this.refillRate;

      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }, 1000);
  }

  /**
   * Acquires a token (waits if none available)
   * @returns Promise that resolves when token is acquired
   */
  async acquire(): Promise<void> {
    // Wait until we have at least 1 token
    while (this.tokens < 1) {
      await this.sleep(50); // Check every 50ms
    }

    this.tokens -= 1;
  }

  /**
   * Resets the limiter (fills bucket to max)
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Gets the number of available tokens
   * @returns Number of tokens currently available
   */
  getTokensAvailable(): number {
    return Math.floor(this.tokens);
  }

  /**
   * Stops the refill interval
   * Call this when done using the limiter to prevent memory leaks
   */
  stop(): void {
    if (this.refillInterval) {
      clearInterval(this.refillInterval);
      this.refillInterval = null;
    }
  }

  /**
   * Updates the rate limit
   * @param messagesPerSecond - New rate limit
   */
  updateRate(messagesPerSecond: number): void {
    if (messagesPerSecond < MIN_RATE_LIMIT || messagesPerSecond > MAX_RATE_LIMIT) {
      throw new Error(`Rate limit must be between ${MIN_RATE_LIMIT} and ${MAX_RATE_LIMIT}`);
    }

    // Stop current interval
    this.stop();

    // Update values
    this.maxTokens = messagesPerSecond;
    this.refillRate = messagesPerSecond;
    this.tokens = Math.min(this.tokens, this.maxTokens);

    // Restart refill
    this.startRefill();
  }

  /**
   * Helper to sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Creates a new rate limiter instance
 * @param messagesPerSecond - Messages per second limit
 * @returns New rate limiter instance
 */
export function createRateLimiter(messagesPerSecond: number = DEFAULT_RATE_LIMIT): RateLimiter {
  return new TokenBucketRateLimiter(messagesPerSecond);
}
