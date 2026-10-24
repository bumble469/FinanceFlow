import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv() // UPSTASH_REDIS_REST_URL / _TOKEN, added by the integration

export const authLimiter = new Ratelimit({
  redis, prefix: 'rl:auth', limiter: Ratelimit.slidingWindow(10, '1 m'),
})
export const apiLimiter = new Ratelimit({
  redis, prefix: 'rl:api', limiter: Ratelimit.slidingWindow(120, '1 m'),
})

export const failedLoginLimiter = new Ratelimit({
  redis, prefix: 'rl:login-fail', limiter: Ratelimit.slidingWindow(5, '15 m'),
})
export const backupCodeLimiter = new Ratelimit({
  redis, prefix: 'rl:backup-fail', limiter: Ratelimit.slidingWindow(5, '15 m'),
})

export async function isBlocked(l: Ratelimit, key: string) {
  try { return (await l.getRemaining(key)).remaining <= 0 } catch { return false }
}
export async function recordFailure(l: Ratelimit, key: string) {
  try { await l.limit(key) } catch {}
}