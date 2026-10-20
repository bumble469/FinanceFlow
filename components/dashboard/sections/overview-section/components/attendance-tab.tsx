"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "../lib/relative-time";
import { CardPrimitive } from "../lib/card-primitive";
import {
  Ticket,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TicketSalesRow {
  ticketTypeId: string;
  name: string;
  sold: number;
  capacity: number | null;
  revenue: number;
  hasCapacityLimit: boolean;
  sellThroughPct: number;
}

interface TicketSalesSummary {
  rows: TicketSalesRow[];
  totalSold: number;
  totalCapacity: number | null;
  totalRevenue: number;
  hasCapacityLimits: boolean;
  sellThroughPct: number;
}

interface CheckInSummary {
  totalAttendees: number;
  checkedIn: number;
  notCheckedIn: number;
  checkInRate: number;
}

interface BookingSeriesPoint {
  date: string;
  label: string;
  bookings: number;
  revenue: number;
}

interface AttendeeItem {
  id: string;
  name: string;
  email: string | null;
  checkedIn: boolean;
  checkedInAt: string | null;
}

interface AttendanceData {
  ticketSales?: TicketSalesSummary;
  checkIn?: CheckInSummary;
  bookingSeries?: BookingSeriesPoint[];
  attendees?: AttendeeItem[];
  currency?: string;
  isEvent?: boolean;
}

export function AttendanceTab({ data }: { data: Record<string, unknown> }) {
  const d = data as AttendanceData;
  const currency = d.currency || "USD";
  const ticketSales = d.ticketSales;
  const checkIn = d.checkIn;
  const bookingSeries = d.bookingSeries ?? [];
  const attendees = d.attendees ?? [];

  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredAttendees = useMemo(() => {
    if (statusFilter === "checked_in") return attendees.filter((a) => a.checkedIn);
    if (statusFilter === "not_checked_in") return attendees.filter((a) => !a.checkedIn);
    return attendees;
  }, [attendees, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Tickets Sold</p>
          <p className="text-2xl font-bold text-foreground mt-1">{ticketSales?.totalSold ?? 0}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {ticketSales?.totalCapacity ? `of ${ticketSales.totalCapacity} capacity` : "unlimited capacity"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Box Office Revenue</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {formatCurrency(ticketSales?.totalRevenue ?? 0, currency)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Ticket sales revenue</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Check-in Rate</p>
          <p className="text-2xl font-bold text-success mt-1">{checkIn?.checkInRate ?? 0}%</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {checkIn?.checkedIn ?? 0} checked in
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Pending Check-ins</p>
          <p className="text-2xl font-bold text-warning mt-1">{checkIn?.notCheckedIn ?? 0}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Expected arrivals</p>
        </div>
      </div>

      {/* Ticket Tier Breakdown */}
      {ticketSales && ticketSales.rows.length > 0 && (
        <CardPrimitive
          title="Ticket Tier Sales"
          subtitle={`${ticketSales.rows.length} active ticket types`}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {ticketSales.rows.map((row) => (
              <div key={row.ticketTypeId} className="rounded-lg border border-border bg-card p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Ticket className="h-4 w-4 text-primary shrink-0" />
                    <h4 className="font-semibold text-foreground text-sm truncate">{row.name}</h4>
                  </div>
                  <span className="font-semibold text-xs text-foreground shrink-0">
                    {formatCurrency(row.revenue, currency)}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Sold: {row.sold} {row.capacity ? `/ ${row.capacity}` : ""}</span>
                    {row.hasCapacityLimit && (
                      <span className="font-medium text-foreground">{row.sellThroughPct}%</span>
                    )}
                  </div>
                  {row.hasCapacityLimit && (
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, row.sellThroughPct))}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardPrimitive>
      )}

      {/* Sales Velocity Timeline Chart */}
      {bookingSeries.length > 0 && (
        <CardPrimitive
          title="Booking & Sales Velocity"
          subtitle="Daily sales revenue trend leading up to the event"
        >
          <div className="pt-2">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={bookingSeries}>
                <defs>
                  <linearGradient id="ticketSalesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatCurrency(v, currency)}
                  width={75}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v, currency), "Revenue"]}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#ticketSalesGrad)"
                  name="Revenue"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardPrimitive>
      )}

      {/* Attendee Register List */}
      {attendees.length > 0 && (
        <CardPrimitive
          title="Attendee Register"
          subtitle={`${filteredAttendees.length} attendees listed`}
          filters={
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger size="sm" className="w-[160px]">
                  <SelectValue placeholder="All Attendees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Attendees</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="not_checked_in">Not Checked In</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        >
          <div className="space-y-2">
            {filteredAttendees.slice(0, 10).map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between rounded-lg border border-border px-3.5 py-2 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase",
                      att.checkedIn ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {att.name.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{att.name}</p>
                    {att.email && <p className="text-[11px] text-muted-foreground truncate">{att.email}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {att.checkedIn ? (
                    <span className="flex items-center gap-1 text-success font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Checked In
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Awaiting
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardPrimitive>
      )}
    </div>
  );
}
