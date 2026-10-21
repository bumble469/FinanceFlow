import { prisma } from '@/lib/prisma'

const IP_HOURLY_LIMIT = 20
const IP_WINDOW_MS = 60 * 60 * 1000

export async function checkIpRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  const cutoff = new Date(Date.now() - IP_WINDOW_MS)

  const count = await prisma.emailRateLimit.count({
    where: {
      ipAddress: ip,
      createdAt: { gte: cutoff },
    },
  })

  if (count >= IP_HOURLY_LIMIT) {
    return { allowed: false, remaining: 0 }
  }

  // Record this attempt
  await prisma.emailRateLimit.create({
    data: { ipAddress: ip },
  })

  return { allowed: true, remaining: IP_HOURLY_LIMIT - count - 1 }
}