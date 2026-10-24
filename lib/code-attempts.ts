import { prisma } from '@/lib/prisma'

export const MAX_CODE_ATTEMPTS = 5

export async function reserveTwoFactorAttempt(id: string) {
  const r = await prisma.twoFactorChallenge.updateMany({
    where: { id, usedAt: null, attempts: { lt: MAX_CODE_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  })
  return r.count === 1
}
export async function reserveEmailAttempt(id: string) {
  const r = await prisma.emailVerificationCode.updateMany({
    where: { id, usedAt: null, attempts: { lt: MAX_CODE_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  })
  return r.count === 1
}
export async function reservePasswordAttempt(id: string) {
  const r = await prisma.passwordChangeCode.updateMany({
    where: { id, usedAt: null, attempts: { lt: MAX_CODE_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  })
  return r.count === 1
}