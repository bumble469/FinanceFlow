"use client";

import { MetricCard } from "@/components/dashboard/components/metric-card";
import { HealthGauge } from "./health-gauge";
import { InsightsFeed } from "./insights-feed";
import { RiskPanel } from "./risk-panel";
import { PendingApprovalsWidget } from "./pending-approvals-widget";
import { formatCurrency } from "../lib/relative-time";
import { CardPrimitive } from "../lib/card-primitive";
import {
  Wallet,
  ArrowDownCircle,
  PiggyBank,
  TrendingUp,
  Clock,
  Ban,
  Receipt,
  CalendarClock,
} from "lucide-react";
import type { FinanceTotals } from "@/lib/analytics/finance";
import type { HealthScore } from "@/lib/analytics/health-score";
import type { Insight } from "@/lib/analytics/insights";
import type { RiskCount } from "@/lib/analytics/risk";

interface SummaryData {
  totals?: FinanceTotals;
  healthScore?: HealthScore;
  insights?: Insight[];
  riskCounts?: RiskCount[];
  pendingExpenseApprovals?: number;
  pendingExtensions?: number;
  currency?: string;
  financeEnabled?: boolean;
  isProject?: boolean;
}

export function SummaryTab({ data }: { data: Record<string, unknown> }) {
  const d = data as SummaryData;
  const currency = d.currency || "USD";
  const totals = d.totals;
  const financeEnabled = d.financeEnabled !== false;

  const totalBudget = totals?.totalBudget ?? 0;
  const totalAllocated = totals?.totalAllocated ?? 0;
  const remainingBudget = totals?.remainingBudget ?? 0;
  const totalIncomeReceived = totals?.totalIncomeReceived ?? 0;
  const totalIncomeExpected = totals?.totalIncomeExpected ?? 0;

  const allocationPct = totalBudget > 0 ? (totalAllocated / totalBudget) * 100 : 0;
  const remainingPct = totalBudget > 0 ? (remainingBudget / totalBudget) * 100 : 0;

  const allocStatus = allocationPct > 90 ? "warning" : "healthy";
  const remStatus = remainingBudget < 0 ? "risk" : totalBudget > 0 && remainingPct < 15 ? "warning" : "healthy";

  const riskPanelItems = (d.riskCounts ?? []).map((rc) => {
    let icon = Clock;
    if (rc.dimension === "budget") icon = ArrowDownCircle;
    else if (rc.dimension === "tasks") icon = Ban;
    else if (rc.dimension === "scope") icon = CalendarClock;
    else if (rc.dimension === "attendance") icon = Receipt;
    return {
      label: rc.label,
      sublabel: rc.sublabel,
      count: rc.count,
      icon,
    };
  });

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      {financeEnabled && totals && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Budget"
            value={formatCurrency(totalBudget, currency)}
            status="healthy"
            icon={<Wallet className="h-4 w-4" />}
            variant="violet"
          />
          <MetricCard
            title="Allocated Budget"
            value={formatCurrency(totalAllocated, currency)}
            status={allocStatus}
            progressPercent={allocationPct}
            progressLabel="allocated"
            icon={<ArrowDownCircle className="h-4 w-4" />}
            variant="cyan"
          />
          <MetricCard
            title="Remaining Budget"
            value={formatCurrency(remainingBudget, currency)}
            status={remStatus}
            trend={remStatus === "healthy" ? "up" : "down"}
            progressPercent={remainingPct}
            progressLabel="remaining"
            icon={<PiggyBank className="h-4 w-4" />}
            variant="emerald"
          />
          <MetricCard
            title="Income Received"
            value={formatCurrency(totalIncomeReceived, currency)}
            subtitle={totalIncomeExpected > totalIncomeReceived ? `Expected: ${formatCurrency(totalIncomeExpected, currency)}` : undefined}
            status="healthy"
            trend="up"
            icon={<TrendingUp className="h-4 w-4" />}
            variant="amber"
          />
        </div>
      )}

      {/* Health Score + AI Insights */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CardPrimitive title="Plan Health" subtitle="Composite health gauge">
          <div className="flex flex-col items-center justify-center py-2">
            <HealthGauge score={d.healthScore?.score ?? 0} />
            {d.healthScore && (
              <div className="mt-4 flex w-full justify-around border-t border-border pt-3 text-xs text-muted-foreground">
                <div className="text-center">
                  <p className="font-semibold text-foreground">{d.healthScore.schedule}%</p>
                  <p>Schedule</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">{d.healthScore.execution}%</p>
                  <p>Execution</p>
                </div>
                {financeEnabled && (
                  <div className="text-center">
                    <p className="font-semibold text-foreground">{d.healthScore.budget}%</p>
                    <p>Budget</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardPrimitive>

        <div className="lg:col-span-2">
          <CardPrimitive
            title="AI Insights"
            subtitle={`${d.insights?.length ?? 0} active signals`}
          >
            <InsightsFeed insights={d.insights ?? []} />
          </CardPrimitive>
        </div>
      </div>

      {/* Risks & Flags + Pending Approvals */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RiskPanel items={riskPanelItems} />
        <PendingApprovalsWidget
          expenseCount={d.pendingExpenseApprovals ?? 0}
          extensionCount={d.pendingExtensions ?? 0}
          showExpenses={financeEnabled}
        />
      </div>
    </div>
  );
}
