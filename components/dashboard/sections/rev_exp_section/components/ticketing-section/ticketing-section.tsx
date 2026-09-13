"use client";
import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useFinancialStore } from "@/lib/store";
import { useSnackbar } from "@/lib/useSnackbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/currency";
import { Ticket, Plus, Pencil, Trash2, CheckCircle2, Circle, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { TicketTypeDialog } from "./components/ticket-type-dialog";
import { NewBookingDialog } from "./components/new-booking-dialog";
import { UpiQrManager } from "./components/upi-qr-manager";
import { TicketViewDialog } from "./components/ticket-view-dialog";
import type { PlanPermissions } from "@/lib/permissions";
import type { TicketType, TicketBooking } from "@/lib/types";
import { fetchTicketingAndStalls } from "@/lib/fetch-ticketing-stalls";

function fmt(value: number, currency: string) {
  const symbol = getCurrencySymbol(currency);
  return `${symbol} ${value.toLocaleString("en-IN")}`;
}

function BookingRow({
  booking, currency, canManage, onCheckIn, onCancel, onViewTicket,
}: {
  booking: TicketBooking;
  currency: string;
  canManage: boolean;
  onCheckIn: (bookingId: string, attendeeId: string, checkedIn: boolean) => void;
  onCancel: (bookingId: string) => void;
  onViewTicket: (booking: TicketBooking) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const checkedInCount = booking.attendees.filter((a) => a.checkedIn).length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{booking.bookedByName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {booking.bookedByEmail || booking.bookedByPhone} · {booking.bookingCode}
              {booking.paymentMethod && ` · ${booking.paymentMethod === "CASH" ? "Cash" : "UPI"}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            booking.status === "CANCELLED" ? "bg-muted text-muted-foreground" : "bg-green-500/10 text-green-600 dark:text-green-400"
          )}>
            {booking.status === "CANCELLED" ? "Cancelled" : `${checkedInCount}/${booking.quantity} checked in`}
          </span>
          <button
            title="View / print ticket"
            className="text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onViewTicket(booking); }}
          >
            <FileText className="h-4 w-4" />
          </button>
          <span className="text-sm font-mono font-medium">{fmt(booking.totalAmount, currency)}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border p-4 space-y-2">
          {booking.attendees.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-sm">{a.name}</span>
              {canManage && booking.status !== "CANCELLED" ? (
                <button
                  className="flex items-center gap-1.5 text-xs cursor-pointer"
                  onClick={() => onCheckIn(booking.id, a.id, !a.checkedIn)}
                >
                  {a.checkedIn ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  {a.checkedIn ? "Checked in" : "Check in"}
                </button>
              ) : (
                a.checkedIn && <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              )}
            </div>
          ))}
          {canManage && booking.status !== "CANCELLED" && (
            <Button
              size="sm" variant="ghost"
              className="text-destructive hover:text-destructive cursor-pointer mt-1"
              onClick={() => onCancel(booking.id)}
            >
              Cancel booking
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function TicketingSection({
  planId,
  permissions,
  embedded = false,
  maxHeight = null,
}: {
  planId: string;
  permissions: PlanPermissions;
  embedded?: boolean;
  maxHeight?: number | null;
}) {
  const { currency, currentPlanMeta, ticketTypes, ticketBookings: bookings } = useFinancialStore();
  const { show } = useSnackbar();

  const [tab, setTab] = useState<"types" | "bookings">("bookings");
  const loading = false;

  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<TicketType | null>(null);
  const [deleteTypeId, setDeleteTypeId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);

  const [upiQrUrl, setUpiQrUrl] = useState<string | null>(currentPlanMeta?.upiQrUrl ?? null);
  const [viewingBooking, setViewingBooking] = useState<TicketBooking | null>(null);

  const fetchAll = async () => {
    if (!planId) return;
    try {
      await fetchTicketingAndStalls(planId, { hasTicketing: true });
    } catch (err) {
      console.error("Fetch ticketing data failed:", err);
      show("Failed to fetch ticketing data", "error");
    }
  };

  const saveTicketType = async (data: { name: string; price: number; capacity?: number | null; description?: string }) => {
    if (editingType) {
      await authClient.request(`/api/plan/${planId}/ticket-types/${editingType.id}`, { method: "PATCH", data });
      show("Ticket type updated", "success");
    } else {
      await authClient.request(`/api/plan/${planId}/ticket-types`, { method: "POST", data });
      show("Ticket type created", "success");
    }
    fetchAll();
  };

  const deleteTicketType = async (id: string) => {
    try {
      await authClient.request(`/api/plan/${planId}/ticket-types/${id}`, { method: "DELETE" });
      await fetchAll();
      show("Ticket type deleted", "success");
    } catch (err: any) {
      show(err?.response?.data?.error || "Failed to delete ticket type", "error");
    }
  };

  const handleCheckIn = async (bookingId: string, attendeeId: string, checkedIn: boolean) => {
    try {
      await authClient.request(`/api/plan/${planId}/ticket-bookings/${bookingId}/attendees/${attendeeId}`, {
        method: "PATCH",
        data: { checkedIn },
      });
      fetchAll();
    } catch (err) {
      console.error("Check-in failed:", err);
      show("Check-in failed", "error");
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await authClient.request(`/api/plan/${planId}/ticket-bookings/${bookingId}`, {
        method: "PATCH",
        data: { status: "CANCELLED" },
      });
      show("Booking cancelled", "success");
      fetchAll();
    } catch (err) {
      console.error("Cancel booking failed:", err);
      show("Failed to cancel booking", "error");
    }
  };

  const totalSold = bookings.filter((b) => b.status === "CONFIRMED").reduce((s, b) => s + b.quantity, 0);
  const totalRevenue = bookings.filter((b) => b.status === "CONFIRMED").reduce((s, b) => s + b.totalAmount, 0);
  const totalCheckedIn = bookings.reduce((s, b) => s + b.attendees.filter((a) => a.checkedIn).length, 0);

  const scrollStyle = maxHeight ? { maxHeight, overflowY: "auto" as const, paddingRight: 4 } : undefined;

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Ticketing</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Ticket types, bookings, and attendee check-in</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Tickets sold</p>
          <p className="text-xl font-bold text-foreground mt-1">{totalSold}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Revenue</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">{fmt(totalRevenue, currency)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Checked in</p>
          <p className="text-xl font-bold text-foreground mt-1">{totalCheckedIn}</p>
        </div>
      </div>

      <UpiQrManager
        planId={planId}
        upiQrUrl={upiQrUrl}
        canManage={!!permissions.canManageTicketingQr}
        onChanged={setUpiQrUrl}
      />

      <div className="flex gap-1 border-b border-border">
        {(["bookings", "types"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "bookings" ? "Bookings" : "Ticket Types"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-14 text-center text-sm text-muted-foreground">Loading...</div>
      ) : tab === "types" ? (
        <div className="space-y-3">
          {permissions.canManageTicketing && (
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5 cursor-pointer" onClick={() => { setEditingType(null); setTypeDialogOpen(true); }}>
                <Plus className="h-3.5 w-3.5" />
                Add ticket type
              </Button>
            </div>
          )}

          <div style={scrollStyle} className="space-y-3">
            {ticketTypes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center gap-3">
                <Ticket className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">No ticket types yet</p>
              </div>
            ) : (
              ticketTypes.map((t) => (
                <div key={t.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{t.name}{!t.isActive && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fmt(t.price, currency)} · {t._count?.bookings ?? 0} bookings
                      {t.capacity !== null && ` · capacity ${t.capacity}`}
                    </p>
                  </div>
                  {permissions.canManageTicketing && (
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer" onClick={() => { setEditingType(t); setTypeDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive cursor-pointer" onClick={() => { setDeleteTypeId(t.id); setConfirmOpen(true); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5 cursor-pointer" onClick={() => setBookingDialogOpen(true)} disabled={ticketTypes.length === 0}>
              <Plus className="h-3.5 w-3.5" />
              New booking
            </Button>
          </div>

          <div style={scrollStyle} className="space-y-3">
            {bookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center gap-3">
                <Ticket className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">No bookings yet</p>
              </div>
            ) : (
              bookings.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  currency={currency}
                  canManage={!!permissions.canCheckInAttendee}
                  onCheckIn={handleCheckIn}
                  onCancel={handleCancelBooking}
                  onViewTicket={setViewingBooking}
                />
              ))
            )}
          </div>
        </div>
      )}

      <TicketTypeDialog
        open={typeDialogOpen}
        onOpenChange={(v) => { setTypeDialogOpen(v); if (!v) setEditingType(null); }}
        editing={editingType}
        onSave={saveTicketType}
      />

      <NewBookingDialog
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
        planId={planId}
        ticketTypes={ticketTypes}
        upiQrUrl={upiQrUrl}
        onBooked={(booking) => {
          fetchAll();
          setViewingBooking(booking);
        }}
      />

      <TicketViewDialog
        open={!!viewingBooking}
        onOpenChange={(v) => { if (!v) setViewingBooking(null); }}
        booking={viewingBooking}
        eventName={currentPlanMeta?.name ?? ""}
      />

      <ConfirmDeleteDialog
        open={confirmOpen}
        type="ticket type"
        setOpen={setConfirmOpen}
        onConfirm={() => { if (deleteTypeId) { deleteTicketType(deleteTypeId); setDeleteTypeId(null); } }}
      />
    </div>
  );
}