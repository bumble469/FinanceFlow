"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useFinancialStore } from "@/lib/store";
import { authClient } from "@/lib/auth-client";
import { CARD_REGISTRY } from "@/lib/card-registry";
import { useAnalyticsStore } from "@/lib/analytics-store";
import { OVERVIEW_TABS, visibleTabs } from "./lib/tab-config";
import { TabBar } from "./components/tab-bar";
import { CardPrimitive } from "./lib/card-primitive";
import type { PlanType } from "@/lib/types";
import { SummaryTab } from "./components/summary-tab";
import { PlanningTab } from "./components/planning-tab";
import { WorkspaceTab } from "./components/workspace-tab";
import { TeamTab } from "./components/team-tab";
import { RevenueTab } from "./components/revenue-tab";
import { HardwareTab } from "./components/hardware-tab";
import { ReportsTab } from "./components/reports-tab";
import { AttendanceTab } from "./components/attendance-tab";

/**
 * In-flight analytics requests, keyed by `${planId}:${tabId}`.
 *
 * Module-level (not store state) on purpose: it must survive the
 * double-mount that React StrictMode performs in development, so the second
 * mount can recognise the first mount's request instead of silently bailing
 * out and leaving the tab on its loading spinner.
 */
const INFLIGHT = new Map<string, Promise<void>>();

export function OverviewSection() {
  const { currentPlanMeta } = useFinancialStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const planType: PlanType | null =
    currentPlanMeta?.type === "project" ? "project" :
    currentPlanMeta?.type === "event" ? "event" : null;

  const financeEnabled = currentPlanMeta?.financeEnabled !== false;

  // Tabs this plan can actually show — plan type + finance flag.
  const tabs = useMemo(
    () => (planType ? visibleTabs(planType, financeEnabled) : []),
    [planType, financeEnabled]
  );
  const firstTabId = tabs[0]?.id ?? OVERVIEW_TABS[0].id;

  // derive active tab from URL; fall back to the first visible tab.
  // A tab this plan doesn't support (e.g. Attendance on a Project, Revenue
  // with finance off) also falls back, so a stale ?tab= can't render a view
  // the plan isn't allowed to see.
  const rawActive = searchParams.get("tab");
  const activeTab = useMemo(() => {
    const match = tabs.find((t) => t.id === rawActive);
    return match ? match.id : firstTabId;
  }, [rawActive, tabs, firstTabId]);

  const planId = currentPlanMeta?.id ?? null;
  const activeTabId = activeTab;

  // Reactive subscription — the slice changes identity when a fetch lands, so
  // this re-renders the shell. Reading via getState() would NOT re-render.
  const slice = useAnalyticsStore((s) =>
    planId ? s.byPlan[planId]?.[activeTabId] : undefined
  );

  const setTab = useAnalyticsStore((s) => s.set);
  const setError = useAnalyticsStore((s) => s.setError);
  const clearTab = useAnalyticsStore((s) => s.clear);

  // Lazy fetch: a tab's data is fetched the first time that tab is opened.
  useEffect(() => {
    if (!planId || !planType) return;

    const entry = CARD_REGISTRY.find((c) => c.tabId === activeTabId);
    if (!entry?.endpoint) return;

    const key = `${planId}:${activeTabId}`;

    // Already resolved (cached) or previously failed — don't refetch.
    const existing = useAnalyticsStore.getState().byPlan[planId]?.[activeTabId];
    if (existing && existing.status !== "pending") return;

    // A request for this tab is already in flight — don't start a second one.
    //
    // This matters because StrictMode (on by default in the App Router) mounts
    // effects twice: mount 1 starts the request, its cleanup runs, and mount 2
    // runs the effect again. Without this registry, mount 2 would see the
    // "pending" slice written by mount 1 and bail out — leaving the tab
    // spinning forever, because mount 1's response was cancelled and mount 2
    // never issued a request of its own.
    if (INFLIGHT.has(key)) return;

    clearTab(planId, activeTabId);

    const endpoint = entry.endpoint.replace("[id]", planId);

    // NOTE: the response always writes to the store, even if this effect
    // instance has since been cleaned up. The store IS the cache — it is meant
    // to outlive the component that populated it (switching tabs and back
    // should hit the cache, not refetch). Tying the write to the effect
    // lifecycle is what strands the tab on the spinner under StrictMode.
    const request = authClient
      .request(endpoint, { method: "GET" })
      .then((res) => {
        if (res.data?.success) {
          setTab(planId, activeTabId, res.data.data);
        } else {
          throw new Error(res.data?.error || "Unknown fetch failure");
        }
      })
      .catch((err: unknown) => {
        console.error(`[Overview] Failed to fetch ${activeTabId}:`, err);
        setError(planId, activeTabId, err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        INFLIGHT.delete(key);
        // Safety net: never leave a tab stuck on "pending" once its request
        // has settled. If the slice is still pending here, something above
        // bailed without writing a terminal state.
        const slice = useAnalyticsStore.getState().byPlan[planId]?.[activeTabId];
        if (slice?.status === "pending") {
          setError(planId, activeTabId, new Error("Request settled without a result"));
        }
      });

    INFLIGHT.set(key, request);
  }, [planId, activeTabId, planType, clearTab, setTab, setError]);

  // Keep the URL in sync with the tab actually being shown.
  useEffect(() => {
    if (!rawActive || rawActive === activeTabId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", activeTabId);
    router.replace(`${pathname}?${params.toString()}`);
  }, [rawActive, activeTabId, router, pathname, searchParams]);

  if (!planType || !planId) {
    return <CardPrimitive title="Summary" />;
  }

  const status = slice?.status ?? "pending";
  const data = slice?.data ?? null;
  const isError = status === "error";
  const isLoading = status === "pending";
  // A tab that resolved successfully but carries no payload is an empty state,
  // not an error. Error state only when the request itself failed.
  const isEmpty = status === "success" && !data;

  return (
    <div className="space-y-4">
      <TabBar activeTab={activeTab} tabs={tabs} />

      <CardPrimitive
        title={tabs.find((t) => t.id === activeTabId)?.label ?? activeTabId}
        loading={isLoading}
        empty={isEmpty}
        error={isError}
      >
        {isError ? (
          <div className="py-6 text-center text-sm text-destructive">
            Failed to load this view. Please try again.
          </div>
        ) : null}
        {data ? <TabContent data={data} tabId={activeTabId} /> : null}
      </CardPrimitive>
    </div>
  );
}

// Dispatches each tab's content into a separate render branch.
// Each branch is responsible for its own filters, tables, and charts.
function TabContent({ data, tabId }: { data: unknown; tabId: string }) {
  const d = (data ?? {}) as Record<string, unknown>;
  switch (tabId) {
    case "summary": return <SummaryTab data={d} />;
    case "planning": return <PlanningTab data={d} />;
    case "workspace": return <WorkspaceTab data={d} />;
    case "team":     return <TeamTab     data={d} />;
    case "revenue":  return <RevenueTab  data={d} />;
    case "hardware": return <HardwareTab data={d} />;
    case "reports":  return <ReportsTab data={d} />;
    case "attendance": return <AttendanceTab data={d} />;
    default: return null;
  }
}
