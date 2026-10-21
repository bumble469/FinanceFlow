import type { AttendanceLike, ExpenseLike, IncomeLike } from "./types";
import { num } from "./finance";

/**
 * Event attendance & commerce rollups.
 *
 * NOTE: `Event.expectedCrowd`, `eventData.expectedRevenue` and
 * `eventData.ticketPrice` are never populated by the API today, so these
 * functions deliberately report ACTUALS ONLY — no target-vs-actual
 * projection is faked.
 */

export interface TicketTypeLike {
  id: string;
  name: string;
  price: number;
  capacity: number | null;
  isActive?: boolean;
}

export interface BookingLike {
  id: string;
  ticketTypeId: string;
  quantity: number;
  totalAmount: number;
  status: string;
  paymentStatus?: string;
  createdAt: string;
  attendees?: AttendanceLike[];
}

export interface StallLike {
  id: string;
  name: string;
  description?: string | null;
}

// ─── Ticket sales ───────────────────────────────────────────────────────────

export interface TicketSalesRow {
  ticketTypeId: string;
  name: string;
  sold: number;
  capacity: number | null;
  revenue: number;
  hasCapacityLimit: boolean;
  sellThroughPct: number;
}

export interface TicketSalesSummary {
  rows: TicketSalesRow[];
  totalSold: number;
  totalCapacity: number | null;
  totalRevenue: number;
  hasCapacityLimits: boolean;
  sellThroughPct: number;
}

export function computeTicketSales(
  ticketTypes: TicketTypeLike[],
  bookings: BookingLike[]
): TicketSalesSummary {
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED");

  const soldByType = new Map<string, number>();
  const revenueByType = new Map<string, number>();
  for (const b of confirmed) {
    soldByType.set(b.ticketTypeId, (soldByType.get(b.ticketTypeId) ?? 0) + b.quantity);
    revenueByType.set(b.ticketTypeId, (revenueByType.get(b.ticketTypeId) ?? 0) + num(b.totalAmount));
  }

  const rows: TicketSalesRow[] = ticketTypes.map((t) => {
    const sold = soldByType.get(t.id) ?? 0;
    const revenue = revenueByType.get(t.id) ?? 0;
    const hasCapacityLimit = t.capacity !== null && t.capacity !== undefined;
    return {
      ticketTypeId: t.id,
      name: t.name,
      sold,
      capacity: t.capacity ?? null,
      revenue,
      hasCapacityLimit,
      sellThroughPct: hasCapacityLimit && (t.capacity ?? 0) > 0
        ? Math.round((sold / (t.capacity ?? 1)) * 100)
        : 0,
    };
  });

  const totalSold = confirmed.reduce((s, b) => s + b.quantity, 0);
  const totalCapacity = ticketTypes.some((t) => t.capacity !== null && t.capacity !== undefined)
    ? ticketTypes.reduce((s, t) => s + (t.capacity ?? 0), 0)
    : null;
  const totalRevenue = confirmed.reduce((s, b) => s + num(b.totalAmount), 0);
  const hasCapacityLimits = totalCapacity !== null;

  return {
    rows,
    totalSold,
    totalCapacity,
    totalRevenue,
    hasCapacityLimits,
    sellThroughPct: hasCapacityLimits && (totalCapacity ?? 0) > 0
      ? Math.round((totalSold / (totalCapacity ?? 1)) * 100)
      : 0,
  };
}

// ─── Check-in ───────────────────────────────────────────────────────────────

export interface CheckInSummary {
  totalAttendees: number;
  checkedIn: number;
  notCheckedIn: number;
  checkInRate: number;
}

export function computeCheckIn(attendees: AttendanceLike[]): CheckInSummary {
  const totalAttendees = attendees.length;
  const checkedIn = attendees.filter((a) => a.checkedIn).length;
  return {
    totalAttendees,
    checkedIn,
    notCheckedIn: totalAttendees - checkedIn,
    checkInRate: totalAttendees > 0 ? Math.round((checkedIn / totalAttendees) * 100) : 0,
  };
}

// ─── Revenue sources ────────────────────────────────────────────────────────

export interface RevenueSource {
  key: "tickets" | "stalls" | "sponsorship" | "other";
  label: string;
  value: number;
}

const SPONSORSHIP_TYPES = new Set(["SPONSORSHIP", "DONATION", "GRANT"]);

/**
 * Splits received income into four buckets. "Other" is always last and is
 * rendered in a neutral colour.
 */
export function computeRevenueSources(params: {
  ticketRevenue: number;
  income: IncomeLike[];
}): RevenueSource[] {
  const { ticketRevenue, income } = params;

  const stallIncome = income
    .filter((i) => i.stallId)
    .reduce((s, i) => s + num(i.receivedAmount), 0);

  const sponsorship = income
    .filter((i) => !i.stallId && i.type && SPONSORSHIP_TYPES.has(i.type))
    .reduce((s, i) => s + num(i.receivedAmount), 0);

  // Ticket revenue is NOT represented in the income ledger (ticket bookings
  // live in their own closed ledger), so it must not be subtracted from
  // received income when computing "Other" — subtracting it would double-count
  // ticket revenue that never appears in the Income table at all.
  const totalReceived = income.reduce((s, i) => s + num(i.receivedAmount), 0);
  const other = Math.max(0, Math.max(0, totalReceived - stallIncome - sponsorship));

  const sources: RevenueSource[] = [
    { key: "tickets", label: "Ticket sales", value: ticketRevenue },
    { key: "stalls", label: "Stall income", value: stallIncome },
    { key: "sponsorship", label: "Sponsorship", value: sponsorship },
    { key: "other", label: "Other", value: other },
  ];
  return sources.filter((r) => r.value > 0);
}

// ─── Booking timeline ───────────────────────────────────────────────────────

export interface BookingSeriesPoint {
  /** ISO date, e.g. "2026-03-04" */
  date: string;
  label: string;
  bookings: number;
  revenue: number;
}

export type BookingRange = "7d" | "30d" | "90d" | "all";

export const BOOKING_RANGES: { key: BookingRange; label: string; days: number | null }[] = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "all", label: "All", days: null },
];

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Daily booking counts + revenue.
 *
 * Uses real ISO date keys (not "Mar 26" labels) so the chart can sort
 * chronologically — the old client-side version produced NaN sorts.
 */
export function computeBookingSeries(
  bookings: BookingLike[],
  range: BookingRange = "30d",
  now: Date = new Date()
): BookingSeriesPoint[] {
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED");
  const rangeDef = BOOKING_RANGES.find((r) => r.key === range);
  const days = rangeDef?.days ?? null;

  const cutoff = days ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)) : null;

  const buckets = new Map<string, BookingSeriesPoint>();

  for (const b of confirmed) {
    const created = new Date(b.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    if (cutoff && created.getTime() < cutoff.getTime()) continue;

    const key = isoDate(created);
    const existing = buckets.get(key);
    if (existing) {
      existing.bookings += 1;
      existing.revenue += num(b.totalAmount);
    } else {
      buckets.set(key, {
        date: key,
        label: created.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        bookings: 1,
        revenue: num(b.totalAmount),
      });
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Stall performance ──────────────────────────────────────────────────────

export interface StallPerformanceRow {
  id: string;
  name: string;
  income: number;
  expense: number;
  net: number;
}

export function computeStallPerformance(
  stalls: StallLike[],
  income: IncomeLike[],
  expenses: ExpenseLike[]
): StallPerformanceRow[] {
  return stalls.map((s) => {
    const stallIncome = income
      .filter((i) => i.stallId === s.id)
      .reduce((sum, i) => sum + num(i.receivedAmount), 0);
    const stallExpense = expenses
      .filter((e) => e.stallId === s.id)
      .reduce((sum, e) => sum + num(e.paidAmount), 0);

    return {
      id: s.id,
      name: s.name,
      income: stallIncome,
      expense: stallExpense,
      net: stallIncome - stallExpense,
    };
  });
}
