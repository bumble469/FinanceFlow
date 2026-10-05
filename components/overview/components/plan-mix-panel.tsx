"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { Plan } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = { project: "#6366f1", event: "#f59e0b", plan: "#0ea5e9" };
const STATUS_COLORS: Record<string, string> = { healthy: "#22c55e", warning: "#f59e0b", risk: "#ef4444", completed: "#94a3b8" };

function statusOf(plan: Plan): keyof typeof STATUS_COLORS {
  if (plan.status === "completed") return "completed";
  const spent = plan.expenses?.reduce((s, e) => s + e.amount, 0) || 0;
  const pct = plan.budget > 0 ? (spent / plan.budget) * 100 : 0;
  if (pct > 90) return "risk";
  if (pct > 75) return "warning";
  return "healthy";
}

export function PlanMixPanel({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground mb-3">Plan mix</h3>
        <p className="text-sm text-muted-foreground text-center py-10">No plans yet</p>
      </div>
    );
  }

  const byType = Object.entries(
    plans.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value, hex: TYPE_COLORS[name] ?? "#94a3b8" }));

  const byStatus = Object.entries(
    plans.reduce((acc, p) => {
      const s = statusOf(p);
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value, hex: STATUS_COLORS[name as keyof typeof STATUS_COLORS] }));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-semibold text-foreground mb-4">Plan mix</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col items-center">
          <ResponsiveContainer width="100%" height={110}>
            <PieChart>
              <Pie data={byType} dataKey="value" nameKey="name" innerRadius={30} outerRadius={48} paddingAngle={2} stroke="none">
                {byType.map((d, i) => <Cell key={i} fill={d.hex} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-muted-foreground mt-1">By type</p>
          <div className="flex flex-wrap justify-center gap-2 mt-1.5">
            {byType.map((d) => (
              <span key={d.name} className="flex items-center gap-1 text-[10px] text-muted-foreground capitalize">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.hex }} />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <ResponsiveContainer width="100%" height={110}>
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={30} outerRadius={48} paddingAngle={2} stroke="none">
                {byStatus.map((d, i) => <Cell key={i} fill={d.hex} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-muted-foreground mt-1">By status</p>
          <div className="flex flex-wrap justify-center gap-2 mt-1.5">
            {byStatus.map((d) => (
              <span key={d.name} className="flex items-center gap-1 text-[10px] text-muted-foreground capitalize">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.hex }} />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
