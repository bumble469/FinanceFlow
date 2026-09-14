"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

interface SubscriptionData {
  plan: { name: string; maxTotalWorkItems: number | null };
  status: string;
}

export function SubscriptionUsagePanel({ planCount }: { planCount: number }) {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authClient.request("/api/subscription")
      .then((res) => setSubscription(res.data?.data ?? null))
      .catch((err) => console.error("Failed to fetch subscription:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 font-semibold text-foreground mb-4">
        <CreditCard className="h-4 w-4 text-muted-foreground" />
        Plan usage
      </h3>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>
      ) : !subscription ? (
        <p className="text-sm text-muted-foreground text-center py-10">No active subscription</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{subscription.plan.name} tier</span>
            <span className="font-medium text-foreground">
              {planCount}{subscription.plan.maxTotalWorkItems != null ? ` / ${subscription.plan.maxTotalWorkItems}` : ""} plans
            </span>
          </div>
          {subscription.plan.maxTotalWorkItems != null && (
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  planCount / subscription.plan.maxTotalWorkItems > 0.9 ? "bg-destructive" : "bg-primary"
                )}
                style={{ width: `${Math.min(100, (planCount / subscription.plan.maxTotalWorkItems) * 100)}%` }}
              />
            </div>
          )}
          {subscription.plan.maxTotalWorkItems == null && (
            <p className="text-xs text-muted-foreground">Unlimited plans on this tier</p>
          )}
        </div>
      )}
    </div>
  );
}
