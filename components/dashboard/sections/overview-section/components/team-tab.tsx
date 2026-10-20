"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "../lib/relative-time";
import { CardPrimitive } from "../lib/card-primitive";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

interface TeamMemberItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  monthlyCost: number;
  departments: string[];
  taskCount: number;
  doneTasks: number;
  openTasks: number;
  blockedTasks: number;
}

interface WorkloadRow {
  id: string;
  label: string;
  taskCount: number;
}

interface TeamData {
  members?: TeamMemberItem[];
  workloadRows?: WorkloadRow[];
  totalMembers?: number;
  currency?: string;
}

export function TeamTab({ data }: { data: Record<string, unknown> }) {
  const d = data as TeamData;
  const currency = d.currency || "USD";
  const members = d.members ?? [];
  const workloadRows = d.workloadRows ?? [];

  const [roleFilter, setRoleFilter] = useState<string>("all");

  const roles = useMemo(() => {
    const set = new Set<string>();
    for (const m of members) {
      if (m.role) set.add(m.role);
    }
    return Array.from(set);
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (roleFilter === "all") return members;
    return members.filter((m) => m.role === roleFilter);
  }, [members, roleFilter]);

  const totalAssignedTasks = useMemo(() => {
    return members.reduce((s, m) => s + m.taskCount, 0);
  }, [members]);

  const totalMonthlyPayroll = useMemo(() => {
    return members.reduce((s, m) => s + m.monthlyCost, 0);
  }, [members]);

  return (
    <div className="space-y-4">
      {/* Top Filter and Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span><strong>{members.length}</strong> team members</span>
          <span><strong>{totalAssignedTasks}</strong> tasks assigned</span>
          {totalMonthlyPayroll > 0 && (
            <span><strong>{formatCurrency(totalMonthlyPayroll, currency)}</strong> monthly payroll</span>
          )}
        </div>

        {roles.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Role:</span>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger size="sm" className="w-[150px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Workload Distribution Chart */}
      {workloadRows.length > 0 && (
        <CardPrimitive
          title="Team Workload Distribution"
          subtitle="Assigned open and completed tasks per team member"
        >
          <div className="pt-2">
            <ResponsiveContainer width="100%" height={Math.max(180, workloadRows.length * 36)}>
              <BarChart data={workloadRows} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v: number) => [`${v} tasks`, "Workload"]}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="taskCount" fill="var(--chart-1)" radius={[0, 4, 4, 0]} name="Tasks" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardPrimitive>
      )}

      {/* Member Cards Grid */}
      <CardPrimitive
        title="Team Directory"
        subtitle={`${filteredMembers.length} members shown`}
      >
        {filteredMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No members match the selected role.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredMembers.map((m) => (
              <div key={m.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-xs text-foreground uppercase">
                      {m.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider bg-primary/10 text-primary shrink-0">
                    {m.role.replace("_", " ")}
                  </span>
                </div>

                {m.departments.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {m.departments.map((dept) => (
                      <span key={dept} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {dept}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 border-t border-border pt-2.5 text-center text-xs">
                  <div>
                    <p className="font-bold text-foreground">{m.taskCount}</p>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="font-bold text-success">{m.doneTasks}</p>
                    <p className="text-[10px] text-muted-foreground">Done</p>
                  </div>
                  <div>
                    <p className={cn("font-bold", m.blockedTasks > 0 ? "text-destructive" : "text-foreground")}>
                      {m.blockedTasks}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Blocked</p>
                  </div>
                </div>

                {m.monthlyCost > 0 && (
                  <div className="border-t border-border pt-2 flex justify-between text-xs text-muted-foreground">
                    <span>Monthly rate:</span>
                    <span className="font-medium text-foreground">{formatCurrency(m.monthlyCost, currency)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardPrimitive>
    </div>
  );
}
