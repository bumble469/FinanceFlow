"use client";

import { useEffect, useMemo, useState } from "react";
import { useFinancialStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import {
  ArrowRight, Plus, Receipt, Users, Clock, TrendingUp, TrendingDown,
  Wallet, PiggyBank, AlertTriangle, CircleCheck, ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import type { Plan } from "@/lib/types";
import { Loader } from "@/components/shared/loader";

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
    expenses: [],
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
  const spentPct = myTotalBudget > 0 ? (myTotalSpent / myTotalBudget) * 100 : 0;

  const riskPlans = allActivePlans.filter((p) => {
    const spent = p.expenses?.reduce((s, e) => s + e.amount, 0) || 0;
    const pct = p.budget > 0 ? (spent / p.budget) * 100 : 0;
    return pct > 75;
  });

  const onTrackCount = allActivePlans.length - riskPlans.length;

  // Last 6 "months" spend trend from plan creation dates as a stand-in
  // until a real /api/analytics/spend-trend endpoint exists.
  const spendTrend = useMemo(() => {
    const buckets = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return { label: d.toLocaleString("default", { month: "short" }), value: 0 };
    });
    allActivePlans.forEach((p) => {
      const spent = p.expenses?.reduce((s, e) => s + e.amount, 0) || 0;
      const monthLabel = new Date(p.createdAt).toLocaleString("default", { month: "short" });
      const bucket = buckets.find((b) => b.label === monthLabel);
      if (bucket) bucket.value += spent;
    });
    return buckets;
  }, [allActivePlans]);

  const maxTrend = Math.max(...spendTrend.map((b) => b.value), 1);

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

      {/* Stat cards row (like Tariff/Options/Subscription cards) */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4 text-primary" /> Budget Managed
          </div>
          <p className="text-2xl font-bold text-foreground">
            {allActivePlans[0]?.currency || "₹"} {myTotalBudget.toLocaleString()}
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5"><CircleCheck className="h-3 w-3 text-success" /> {myPlans.length} owned plans</li>
            <li className="flex items-center gap-1.5"><CircleCheck className="h-3 w-3 text-success" /> {collaborations.length} shared plans</li>
          </ul>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PiggyBank className="h-4 w-4 text-chart-2" /> Spent vs Remaining
          </div>
          <p className="text-2xl font-bold text-foreground">
            {spentPct.toFixed(0)}% used
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-chart-2" style={{ width: `${Math.min(spentPct, 100)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {allActivePlans[0]?.currency || "₹"} {remaining.toLocaleString()} remaining
          </p>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-warning" /> Action Required
          </div>
          <p className="text-2xl font-bold text-foreground">{riskPlans.length} plans</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5"><TrendingUp className="h-3 w-3 text-danger" /> Near or over 75% budget</li>
            <li className="flex items-center gap-1.5"><TrendingDown className="h-3 w-3 text-success" /> {onTrackCount} on track</li>
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart panel (Network Speed equivalent) */}
        <Card className="lg:col-span-2 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Spend Trend</h2>
            <Badge variant="outline" className="text-xs">Last 6 months</Badge>
          </div>
          <div className="flex items-end gap-3 h-40">
            {spendTrend.map((b) => (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-primary/20 to-primary"
                    style={{ height: `${Math.max((b.value / maxTrend) * 100, 4)}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">{b.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Highlight card (Online consultation equivalent) */}
        <Card className="p-6 space-y-4 bg-primary/5 border-primary/10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Budget Health</h3>
            <Badge className={riskPlans.length > 0 ? "bg-warning/15 text-warning border-warning/20" : "bg-success/15 text-success border-success/20"}>
              {riskPlans.length > 0 ? "Needs attention" : "Healthy"}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-border">
              <AvatarFallback className="bg-primary/20 text-primary text-sm">
                {(currentUser?.name || currentUser?.email || "U")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{currentUser?.name || "You"}</p>
              <p className="text-xs text-muted-foreground">Managing {allActivePlans.length} active plans</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {riskPlans.length > 0
              ? `${riskPlans.length} plan(s) have crossed 75% of their budget. Review expenses before approving new spend.`
              : "All plans are within healthy budget range."}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Plans list (Current Partnerships equivalent) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">My Plans</h2>
            <Link href="/plans">
              <Button variant="ghost" size="sm" className="gap-2 hover:text-primary">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {allActivePlans.length === 0 ? (
            <Card className="flex flex-col items-center justify-center border-dashed bg-card/50 p-12 text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-4 text-primary">
                <Plus className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">No active plans</h3>
              <p className="mb-4 max-w-sm text-sm text-muted-foreground">
                You aren't a part of any plans right now. Create a new plan or ask your team to invite you.
              </p>
              <Link href="/plans"><Button>Create First Plan</Button></Link>
            </Card>
          ) : (
            <div className="space-y-3">
              {allActivePlans.map((plan) => {
                const planSpent = plan?.expenses.reduce((sum, e) => sum + e.amount, 0);
                const planSpentPercent = plan.budget > 0 ? (planSpent / plan.budget) * 100 : 0;
                const planIsWarning = planSpentPercent > 75;
                const planIsRisk = planSpentPercent > 90;

                const getStatusColor = () => {
                  if (plan.status === "completed") return "bg-muted text-muted-foreground border-transparent";
                  if (planIsRisk) return "bg-danger/10 text-danger border-danger/20";
                  if (planIsWarning) return "bg-warning/10 text-warning border-warning/20";
                  return "bg-success/10 text-success border-success/20";
                };
                const getStatusLabel = () => {
                  if (plan.status === "completed") return "Completed";
                  if (planIsRisk) return "At Risk";
                  if (planIsWarning) return "Warning";
                  return "On Track";
                };

                return (
                  <Link key={plan.id} href={`/plans/${plan.id}`}>
                    <Card className="group flex items-center justify-between gap-4 p-4 hover:border-primary/30 hover:-translate-y-0.5 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                          {plan.name[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate group-hover:text-primary">{plan.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {plan.type} · {plan.currency} {planSpent.toLocaleString()} / {plan.budget.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`shrink-0 ${getStatusColor()}`}>{getStatusLabel()}</Badge>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right rail — Active Tasks (replaces Messages) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" /> Active Tasks
            </h3>
            <Badge variant="outline" className="text-xs">Coming soon</Badge>
          </div>
          <Card className="p-5 space-y-3 border-dashed">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tasks assigned to you across all plans will show up here once cross-plan task
              aggregation is wired up.
            </p>
            <Link href="/plans">
              <Button variant="outline" size="sm" className="w-full gap-2">
                <Clock className="h-3.5 w-3.5" /> View plan workspaces
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}