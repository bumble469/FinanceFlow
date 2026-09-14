"use client";

import { useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { Plan } from "@/lib/types";
import { cn } from "@/lib/utils";

type RangeKey = "week" | "month" | "quarter";

function bucketLabel(date: Date, range: RangeKey): string {
  if (range === "week") return date.toLocaleDateString("en-IN", { weekday: "short" });
  if (range === "month") return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return date.toLocaleDateString("en-IN", { month: "short" });
}

function rangeStart(range: RangeKey): Date {
  const now = new Date();
  if (range === "week") return new Date(now.getTime() - 7 * 86400000);
  if (range === "month") return new Date(now.getTime() - 30 * 86400000);
  return new Date(now.getTime() - 90 * 86400000);
}

export function SpendIncomePanel({ plans }: { plans: Plan[] }) {
  const [range, setRange] = useState<RangeKey>("month");

  const { data, totalIncome, totalExpense, pctChange } = useMemo(() => {
    const start = rangeStart(range);
    const map = new Map<string, { label: string; income: number; expense: number; sortKey: number }>();

    let periodIncome = 0;
    let periodExpense = 0;

    plans.forEach((plan) => {
      (plan.expenses ?? []).forEach((e: any) => {
        const d = new Date(e.occurredAt ?? e.createdAt);
        if (d < start) return;
        const key = bucketLabel(d, range);
        const row = map.get(key) ?? { label: key, income: 0, expense: 0, sortKey: d.getTime() };
        row.expense += e.paidAmount ?? e.amount ?? 0;
        map.set(key, row);
        periodExpense += e.paidAmount ?? e.amount ?? 0;
      });
      (plan.income ?? []).forEach((i: any) => {
        const d = new Date(i.receivedAt ?? i.createdAt);
        if (d < start) return;
        const key = bucketLabel(d, range);
        const row = map.get(key) ?? { label: key, income: 0, expense: 0, sortKey: d.getTime() };
        row.income += i.receivedAmount ?? 0;
        map.set(key, row);
        periodIncome += i.receivedAmount ?? 0;
      });
    });

    const sorted = Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
    const net = periodIncome - periodExpense;
    const pct = periodExpense > 0 ? (net / periodExpense) * 100 : periodIncome > 0 ? 100 : 0;

    return { data: sorted, totalIncome: periodIncome, totalExpense: periodExpense, pctChange: pct };
  }, [plans, range]);

  const hasData = data.length >= 2;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Spend & Income</h3>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(["week", "month", "quarter"] as RangeKey[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors",
                range === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          Not enough activity in this range across your plans yet.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-4">
            <span className={cn("flex items-center gap-1 text-sm font-semibold", pctChange >= 0 ? "text-success" : "text-destructive")}>
              {pctChange >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {Math.abs(pctChange).toFixed(0)}%
            </span>
            <span className="text-sm text-muted-foreground">net vs. expenses this {range}</span>
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="ovIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ovExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} fill="url(#ovIncomeGrad)" name="Income" />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#ovExpenseGrad)" name="Expense" />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
