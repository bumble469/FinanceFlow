import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function assertFinanceEnabled(planId: string) {
  const w = await prisma.workItem.findUnique({
    where: { id: planId },
    select: { financeEnabled: true },
  });
  if (!w?.financeEnabled) {
    return NextResponse.json(
      { success: false, error: "Finance is disabled for this plan" },
      { status: 403 }
    );
  }
  return null;
}