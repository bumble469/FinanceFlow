import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/plan/[id]/email-preference
// Returns whether the current user is receiving email updates for this specific plan.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const record = await prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        emailNotificationsEnabled: true,
        emailNotificationScope: true,
        emailNotificationPlans: { where: { workItemId: planId }, select: { workItemId: true } },
      },
    });

    if (!record) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const receiving =
      record.emailNotificationsEnabled &&
      (record.emailNotificationScope === "ALL" || record.emailNotificationPlans.length > 0);

    return NextResponse.json({ receiving });
  } catch (err) {
    console.error("[GET /api/plan/:id/email-preference]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/plan/[id]/email-preference
// Body: { receiving: boolean }
// Turning this on/off only ever affects this one plan's row — never touches
// the user's preferences for any other plan (unlike the account-wide route,
// which replaces the entire list when scope=SPECIFIC).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { receiving } = body as { receiving: boolean };

    if (typeof receiving !== "boolean") {
      return NextResponse.json({ error: "receiving must be a boolean" }, { status: 400 });
    }

    // Interacting with a per-plan toggle moves the user into SPECIFIC mode,
    // governed from then on by their individual per-plan choices.
    await prisma.user.update({
      where: { id: user.sub },
      data: {
        emailNotificationsEnabled: true,
        emailNotificationScope: "SPECIFIC",
      },
    });

    if (receiving) {
      await prisma.userEmailNotificationPlan.upsert({
        where: { userId_workItemId: { userId: user.sub, workItemId: planId } },
        update: {},
        create: { userId: user.sub, workItemId: planId },
      });
    } else {
      await prisma.userEmailNotificationPlan.deleteMany({
        where: { userId: user.sub, workItemId: planId },
      });
    }

    return NextResponse.json({ success: true, receiving });
  } catch (err) {
    console.error("[PATCH /api/plan/:id/email-preference]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
