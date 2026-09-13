"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan, AccountSubscription, BillingInterval } from "@/lib/types";
import { Loader } from "@/components/shared/loader";

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
};

const INTERVAL_LABELS: Record<BillingInterval, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-yearly",
  YEARLY: "Yearly",
};

const INTERVAL_SUFFIX: Record<BillingInterval, string> = {
  MONTHLY: "/mo",
  QUARTERLY: "/qtr",
  HALF_YEARLY: "/6mo",
  YEARLY: "/yr",
};

export function SubscriptionPlansPage({ onSelected }: { onSelected?: () => void }) {
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [current, setCurrent] = useState<AccountSubscription | null>(null);
  const [interval, setInterval] = useState<BillingInterval>("MONTHLY");
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      authClient.request("/api/subscription-plans"),
      authClient.request("/api/subscription"),
    ])
      .then(([plansRes, subRes]) => {
        setPlans(plansRes.data.data ?? []);
        setCurrent(subRes.data.data ?? null);
      })
      .catch((err) => console.error("Failed to load subscription data:", err))
      .finally(() => setLoading(false));
  }, []);

  const selectPlan = async (priceId: string) => {
    setSelectingId(priceId);
    try {
      const res = await authClient.request("/api/subscription", { method: "POST", data: { priceId } });
      setCurrent(res.data.data);
      if (onSelected) onSelected();
      else router.push("/plans");
    } catch (err) {
      console.error("Failed to select plan:", err);
    } finally {
      setSelectingId(null);
    }
  };

  const skipToFree = async () => {
    const starter = plans.find((p) => p.code === "STARTER");
    const freePrice = starter?.prices.find((pr) => pr.amount === 0);
    if (freePrice) await selectPlan(freePrice.id);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center">
    <Loader label="Loading plan..." />
  </div>;

  const availableIntervals = (["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"] as BillingInterval[]).filter(
    (i) => plans.some((p) => p.prices.some((pr) => pr.billingInterval === i))
  );

  return (
    <div className="max-w-6xl mx-auto py-12 px-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Choose your plan</h1>
        <p className="text-muted-foreground">Start free, upgrade anytime as your team grows</p>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-border p-1 flex-wrap justify-center">
          {availableIntervals.map((i) => (
            <button
              key={i}
              onClick={() => setInterval(i)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                interval === i ? "bg-foreground text-background" : "text-muted-foreground"
              )}
            >
              {INTERVAL_LABELS[i]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const price = plan.prices.find((p) => p.billingInterval === interval) ?? plan.prices[0];
          const isCurrent = current?.plan.code === plan.code;
          const isFree = price?.amount === 0;
          const symbol = price ? CURRENCY_SYMBOLS[price.currency] ?? price.currency : "";

          return (
            <div
              key={plan.id}
              className={cn(
                "rounded-2xl border p-6 flex flex-col gap-4",
                isCurrent ? "border-primary shadow-md" : "border-border"
              )}
            >
              <div>
                <p className="font-semibold text-lg text-foreground">{plan.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
              </div>

              <div>
                <span className="text-3xl font-bold text-foreground">
                  {isFree ? "Free" : `${symbol}${price?.amount.toLocaleString("en-IN")}`}
                </span>
                {!isFree && price && (
                  <span className="text-sm text-muted-foreground">{INTERVAL_SUFFIX[price.billingInterval]}</span>
                )}
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>{plan.maxProjects ?? "Unlimited"} Projects</p>
                <p>{plan.maxEvents ?? "Unlimited"} Events</p>
                <p>{plan.maxTotalWorkItems ?? "Unlimited"} total work items</p>
                <p>{plan.maxMembersPerWorkItem ?? "Unlimited"} members per item</p>
                <p>{plan.maxTasksPerWorkItem ?? "Unlimited"} tasks per item</p>
                <p>{plan.maxDepartments ?? "Unlimited"} departments</p>
              </div>

              <Button
                className="w-full cursor-pointer mt-auto"
                variant={isCurrent ? "outline" : "default"}
                disabled={isCurrent || !price || selectingId === price.id}
                onClick={() => price && selectPlan(price.id)}
              >
                {isCurrent ? "Current plan" : selectingId === price?.id ? "Selecting..." : isFree ? "Start free" : "Select"}
              </Button>
            </div>
          );
        })}
      </div>

      {!current && (
        <div className="text-center">
          <button onClick={skipToFree} className="text-sm text-muted-foreground hover:text-foreground underline cursor-pointer">
            Skip for now — start on Starter (free)
          </button>
        </div>
      )}
    </div>
  );
}