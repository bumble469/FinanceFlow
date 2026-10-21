import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  computeTicketSales,
  computeCheckIn,
  computeBookingSeries,
} from "@/lib/analytics/attendance";

function num(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: planId } = await params;
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const member = await prisma.workItemMember.findUnique({
      where: { workItemId_userId: { workItemId: planId, userId: user.sub } },
    });
    if (!member) return NextResponse.json({ success: false, error: "Not a member of this plan" }, { status: 403 });

    const [workItem, ticketTypes, bookings, attendees] = await Promise.all([
      prisma.workItem.findUnique({
        where: { id: planId },
        select: { currency: true, type: true },
      }),
      prisma.ticketType.findMany({
        where: { workItemId: planId },
        select: {
          id: true,
          name: true,
          price: true,
          capacity: true,
          isActive: true,
        },
      }),
      prisma.ticketBooking.findMany({
        where: { workItemId: planId },
        select: {
          id: true,
          ticketTypeId: true,
          quantity: true,
          totalAmount: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
      }),
      prisma.ticketAttendee.findMany({
        where: { booking: { workItemId: planId } },
        select: {
          id: true,
          name: true,
          email: true,
          checkedIn: true,
          checkedInAt: true,
          bookingId: true,
          booking: { select: { ticketTypeId: true } },
        },
      }),
    ]);

    if (!workItem) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });

    const ticketTypeLikes = ticketTypes.map((t) => ({
      id: t.id,
      name: t.name,
      price: num(t.price),
      capacity: t.capacity,
      isActive: t.isActive,
    }));

    const bookingLikes = bookings.map((b) => ({
      id: b.id,
      ticketTypeId: b.ticketTypeId,
      quantity: b.quantity,
      totalAmount: num(b.totalAmount),
      status: b.status,
      paymentStatus: b.paymentStatus,
      createdAt: b.createdAt.toISOString(),
    }));

    const attendeeLikes = attendees.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      checkedIn: a.checkedIn,
      checkedInAt: a.checkedInAt ? a.checkedInAt.toISOString() : null,
      bookingId: a.bookingId,
      ticketTypeId: a.booking?.ticketTypeId,
    }));

    const ticketSales = computeTicketSales(ticketTypeLikes, bookingLikes);
    const checkIn = computeCheckIn(attendeeLikes);
    const bookingSeries = computeBookingSeries(bookingLikes, "30d");

    const rollup = {
      ticketSales,
      checkIn,
      bookingSeries,
      attendees: attendeeLikes,
      currency: workItem.currency || "USD",
      isEvent: workItem.type === "EVENT",
    };

    return NextResponse.json({ success: true, data: rollup });
  } catch (err) {
    console.error("[GET /api/plan/[id]/analytics/attendance]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
