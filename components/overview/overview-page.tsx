"use client";

import { useEffect, useMemo, useState } from "react";
import { useFinancialStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  ArrowRight, Plus, Receipt, Users, ListChecks, CalendarClock, Bell,
  FolderKanban, Handshake, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import type { Plan } from "@/lib/types";
import { Loader } from "@/components/shared/loader";
import { MetricCard } from "@/components/dashboard/components/metric-card";
import { SpendIncomePanel } from "@/components/overview/components/spend-income-panel";
import { PlanMixPanel } from "@/components/overview/components/plan-mix-panel";
import { SubscriptionUsagePanel } from "@/components/overview/components/subscription-usage-panel";
import { ComingSoonPanel } from "@/components/overview/components/coming-soon-panel";
import { MiniPlanCard } from "./components/mini-plan-card";

export function OverviewPage() {
  const { currentUser, setPlans } = useFinancialStore();
  const [myPlans, setMyPlans] = useState<Plan[]>([]);
  const [collaborations, setCollaborations] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const mapWorkItemToPlan = (workItem: any): Plan => ({
    id: workItem.id,
    accountId: workItem.accountId,
    name: workItem.name,
    type: workItem.type.toLowerCase() as Plan["type"],
    status: workItem.status.toLowerCase() as Plan["status"],
    budget: Number(workItem.budget ?? 0),
    spent: 0,
    currency: workItem.currency ?? "USD",
    description: workItem.description ?? undefined,
    createdAt: new Date(workItem.createdAt),
    teamMembers: [],
    project: workItem.project ?? null,
    event: workItem.event ?? null,
    expenses: workItem.expenses ?? [],
    income: workItem.income ?? [],
    mode: workItem.type === "EVENT" ? "event" : "project",
    simulation: { costMultiplier: 1, additionalMembers: 0, revenueAdjustment: 0, isSimulating: false },
  });

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data } = await authClient.request("/api/plan", { method: "GET" });
        const fetchedMyPlans = data.data.myPlans.map(mapWorkItemToPlan);
        const fetchedCollaborations = data.data.collaborations.map(mapWorkItemToPlan);
        setMyPlans(fetchedMyPlans);
        setCollaborations(fetchedCollaborations);
        setPlans(fetchedMyPlans);
      } catch (error) {
        console.error("Failed to fetch plans", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlans();
  }, [setPlans]);

  const allActivePlans = useMemo(() => [...myPlans, ...collaborations], [myPlans, collaborations]);

  const myTotalBudget = allActivePlans.reduce((sum, p) => sum + p.budget, 0);
  const myTotalSpent = allActivePlans.reduce(
    (sum, p) => sum + (p.expenses?.reduce((esum, e) => esum + e.amount, 0) || 0),
    0
  );
  const remaining = myTotalBudget - myTotalSpent;

  const riskPlans = allActivePlans.filter((p) => {
    const spent = p.expenses?.reduce((s, e) => s + e.amount, 0) || 0;
    const pct = p.budget > 0 ? (spent / p.budget) * 100 : 0;
    return pct > 75;
  });

  const currency = allActivePlans[0]?.currency || "₹";

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader label="Loading dashboard..." /></div>;
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome back, {currentUser?.name || currentUser?.email?.split("@")[0] || "User"}
          </h1>
          <p className="text-muted-foreground">Here's what's happening across your plans today.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" size="sm" className="gap-2 rounded-full">
            <Receipt className="h-4 w-4" /> Log Expense
          </Button>
          <Button variant="secondary" size="sm" className="gap-2 rounded-full">
            <Users className="h-4 w-4" /> Invite Team
          </Button>
        </div>
      </div>

      {/* Row 1: wide left block (2x2 stats + trend chart) / My Tasks / Upcoming Deadlines */}
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              title="Owned Plans"
              value={myPlans.length.toString()}
              icon={<FolderKanban className="h-4 w-4" />}
              variant="emerald"
              status="healthy"
            />
            <MetricCard
              title="Collaborations"
              value={collaborations.length.toString()}
              icon={<Handshake className="h-4 w-4" />}
              variant="cyan"
              status="healthy"
            />
            <MetricCard
              title="Total Budget Managed"
              value={`${currency} ${(myTotalBudget / 1000).toFixed(1)}k`}
              icon={<Receipt className="h-4 w-4" />}
              variant="violet"
              status="healthy"
            />
            <MetricCard
              title="Plans at Risk"
              value={riskPlans.length.toString()}
              icon={<AlertTriangle className="h-4 w-4" />}
              variant={riskPlans.length > 0 ? "amber" : "cyan"}
              status={riskPlans.length > 0 ? "warning" : "healthy"}
            />
          </div>
          <SpendIncomePanel plans={allActivePlans} />
        </div>

        <ComingSoonPanel
          title="My Tasks"
          subtitle="Across all plans"
          icon={ListChecks}
          note="Tasks assigned to you across every plan will appear here once cross-plan task aggregation is built."
        />

        <ComingSoonPanel
          title="Upcoming Deadlines"
          subtitle="Milestones & events"
          icon={CalendarClock}
          note="Milestones and event dates across all your plans will appear here once cross-plan aggregation is built."
        />
      </div>

      {/* Row 2: plan mix / recent activity / subscription usage */}
      <div className="grid gap-6 lg:grid-cols-3">
        <PlanMixPanel plans={allActivePlans} />

        <ComingSoonPanel
          title="Recent Activity"
          subtitle="Notifications feed"
          icon={Bell}
          note="Your notifications are currently tracked per-plan. A combined feed here needs a cross-plan notifications endpoint."
        />

        <SubscriptionUsagePanel planCount={myPlans.length} />
      </div>

      {/* Row 3: My Plans list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">My Plans</h2>
          <Link href="/plans">
            <Button variant="ghost" size="sm" className="gap-2 hover:text-primary">
              View All <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {allActivePlans.map((plan) => (
            <MiniPlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    </div>
  );
}
