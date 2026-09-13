import { authClient } from "@/lib/auth-client";
import { useFinancialStore } from "@/lib/store";

export async function fetchTicketingAndStalls(
  planId: string,
  opts: { hasTicketing?: boolean; hasStalls?: boolean }
) {
  const { setTicketTypes, setTicketBookings, setStalls } = useFinancialStore.getState();
  const calls: Promise<void>[] = [];

  if (opts.hasTicketing) {
    calls.push(
      authClient.request(`/api/plan/${planId}/ticket-types`).then((r) => setTicketTypes(r.data.data ?? [])),
      authClient.request(`/api/plan/${planId}/ticket-bookings`).then((r) => setTicketBookings(r.data.data ?? []))
    );
  }
  if (opts.hasStalls) {
    calls.push(
      authClient.request(`/api/plan/${planId}/stalls`).then((r) => setStalls(r.data.data ?? []))
    );
  }

  await Promise.allSettled(calls);
}