import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const PAYMENTS_TEST_MODE = process.env.PAYMENTS_TEST_MODE === "true";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const account = await prisma.account.findUnique({ where: { userId: user.sub } });
    if (!account) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const subscription = await prisma.subscription.findUnique({
      where: { accountId: account.id },
      include: { plan: true, price: true },
    });

    if (!subscription) return NextResponse.json({ success: true, data: null });

    return NextResponse.json({
      success: true,
      data: { ...subscription, amount: Number(subscription.amount), price: { ...subscription.price, amount: Number(subscription.price.amount) } },
    });
  } catch (err) {
    console.error("[GET /subscription]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — select a plan. The free STARTER tier activates immediately (no payment).
// Paid tiers create a PENDING subscription (payment collection is a later phase),
// unless PAYMENTS_TEST_MODE is on, in which case they activate immediately too.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const account = await prisma.account.findUnique({ where: { userId: user.sub } });
    if (!account) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const body = await req.json();
    const { priceId } = body;
    if (!priceId) return NextResponse.json({ error: "priceId is required" }, { status: 400 });

    const price = await prisma.planPrice.findUnique({ where: { id: priceId }, include: { plan: true } });
    if (!price || !price.isActive) return NextResponse.json({ error: "Invalid or inactive price" }, { status: 400 });

    const now = new Date();
    const periodEnd = new Date(now);
    if (price.billingInterval === "MONTHLY") periodEnd.setMonth(periodEnd.getMonth() + 1);
    else if (price.billingInterval === "QUARTERLY") periodEnd.setMonth(periodEnd.getMonth() + 3);
    else if (price.billingInterval === "HALF_YEARLY") periodEnd.setMonth(periodEnd.getMonth() + 6);
    else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    const isFree = price.plan.code === "STARTER";
    const activateNow = isFree || PAYMENTS_TEST_MODE;
    const status = activateNow ? "ACTIVE" : "PENDING";

    const subscription = await prisma.subscription.upsert({
      where: { accountId: account.id },
      update: {
        planId: price.planId,
        priceId: price.id,
        status,
        billingInterval: price.billingInterval,
        currency: price.currency,
        amount: price.amount,
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        endedAt: null,
      },
      create: {
        accountId: account.id,
        planId: price.planId,
        priceId: price.id,
        status,
        billingInterval: price.billingInterval,
        currency: price.currency,
        amount: price.amount,
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      include: { plan: true, price: true },
    });

    return NextResponse.json({
      success: true,
      data: { ...subscription, amount: Number(subscription.amount), price: { ...subscription.price, amount: Number(subscription.price.amount) } },
    });
  } catch (err) {
    console.error("[POST /subscription]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}