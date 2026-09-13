"use client";

import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useFinancialStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { formatCurrency } from "../lib/overview-utils";

export function HardwareImpactWidget({ planId }: { planId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { currency } = useFinancialStore();

  useEffect(() => {
    if (!planId) return;
    authClient.request(`/api/plan/${planId}/hardware`)
      .then((res) => setItems(res.data.data ?? []))
      .catch((err) => console.error("Failed to fetch hardware:", err))
      .finally(() => setLoading(false));
  }, [planId]);

  const pendingCount = items.filter((h) => h.requestStatus === "PENDING").length;
  const monthlyRentCost = items
    .filter((h) => h.requestStatus === "APPROVED" && h.source === "RENTED" && h.monthlyRentAmount)
    .reduce((s, h) => s + h.monthlyRentAmount, 0);
  const outstandingDeposits = items
    .filter((h) => h.requestStatus === "APPROVED" && h.depositAmount && !h.depositReturned)
    .reduce((s, h) => s + h.depositAmount, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 font-semibold text-foreground mb-3">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        Hardware
      </h3>
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border px-3 py-2.5">
            <p className={cn("text-xl font-bold", pendingCount > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-foreground")}>{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending requests</p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2.5">
            <p className="text-xl font-bold font-mono text-foreground">{formatCurrency(monthlyRentCost, currency)}</p>
            <p className="text-xs text-muted-foreground">Monthly rental cost</p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2.5">
            <p className="text-xl font-bold font-mono text-foreground">{formatCurrency(outstandingDeposits, currency)}</p>
            <p className="text-xs text-muted-foreground">Outstanding deposits</p>
          </div>
        </div>
      )}
    </div>
  );
}