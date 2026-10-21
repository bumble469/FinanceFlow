"use client";

import { useState, useMemo } from "react";
import { Flag, ListChecks, CheckCircle2, CircleDashed, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardPrimitive } from "../lib/card-primitive";
import { TaskDueBuckets } from "./task-due-buckets";
import { MetricCard } from "@/components/dashboard/components/metric-card";
import { EmptyState } from "../lib/empty-state";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CustomPieTooltip } from "./custom-pie-tooltip";
import type { Task } from "@/lib/types";
import { TASK_STATUS_COLORS } from "../lib/chart-palette";

interface TaskStatusSlice {
  bucket: string;
  label: string;
  count: number;
}

interface PlanningData {
  tasks?: (Task & { phaseId?: string | null })[];
  milestones?: {
    id: string;
    title: string;
    dueDate: string | null;
    status: string;
    totalTasks: number;
    doneTasks: number;
    percent: number;
    isOverdue: boolean;
    departmentId: string | null;
  }[];
  departments?: { id: string; name: string }[];
  /** server-computed status counts for the unfiltered task set */
  taskStatusSlices?: TaskStatusSlice[];
  completionPct?: number;
  openTasks?: number;
  blockedTasks?: number;
  totalTasks?: number;
}

export function PlanningTab({ data }: { data: Record<string, unknown> }) {
  const d = data as PlanningData;
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  const tasks = d.tasks ?? [];
  const milestones = d.milestones ?? [];
  const departments = d.departments ?? [];

  const filteredTasks = useMemo(() => {
    if (departmentFilter === "all") return tasks;
    return tasks.filter((t) => t.departmentId === departmentFilter);
  }, [tasks, departmentFilter]);

  const filteredMilestones = useMemo(() => {
    if (departmentFilter === "all") return milestones;
    return milestones.filter((m) => !m.departmentId || m.departmentId === departmentFilter);
  }, [milestones, departmentFilter]);

  // Task Status counts for chart
  const taskStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of filteredTasks) {
      counts[t.status] = (counts[t.status] ?? 0) + 1;
    }
    return counts;
  }, [filteredTasks]);

  const pieData = useMemo(() => {
    // Prefer the server's slices (DONE and COMPLETED already merged there).
    // Fall back to counting client-side when a department filter is active,
    // since the server rollup is for the unfiltered set.
    if (departmentFilter === "all" && d.taskStatusSlices?.length) {
      return d.taskStatusSlices
        .map((s) => ({
          name: s.label,
          value: s.count,
          hex: TASK_STATUS_COLORS[s.bucket]?.color ?? "var(--chart-1)",
        }))
        .filter((s) => s.value > 0);
    }

    return Object.entries(TASK_STATUS_COLORS)
      .map(([status, cfg]) => {
        const value =
          status === "DONE"
            ? (taskStatusCounts["DONE"] ?? 0) + (taskStatusCounts["COMPLETED"] ?? 0)
            : (taskStatusCounts[status] ?? 0);
        return { name: cfg.label, value, hex: cfg.color };
      })
      .filter((s) => s.value > 0);
  }, [taskStatusCounts, d.taskStatusSlices, departmentFilter]);

  const totalFilteredTasks = filteredTasks.length;

  // Rollup counts for the KPI row. The server sends these for the unfiltered
  // set, so they are only accurate while no department filter is applied.
  const openTasks = d.openTasks ?? 0;
  const blockedTasks = d.blockedTasks ?? 0;
  const completionPct = d.completionPct ?? 0;
  const isUnfiltered = departmentFilter === "all";

  const doneCount = useMemo(
    () => filteredTasks.filter((t) => t.status === "DONE" || t.status === "COMPLETED").length,
    [filteredTasks]
  );

  // The server's open/blocked rollups cover the whole plan, so recompute them
  // client-side whenever a department filter narrows the view.
  const filteredOpenCount = useMemo(
    () => filteredTasks.filter((t) => t.status !== "DONE" && t.status !== "COMPLETED").length,
    [filteredTasks]
  );

  const filteredBlockedCount = useMemo(
    () => filteredTasks.filter((t) => t.status === "BLOCKED").length,
    [filteredTasks]
  );

  const openTaskCount = isUnfiltered ? openTasks : filteredOpenCount;
  const blockedTaskCount = isUnfiltered ? blockedTasks : filteredBlockedCount;

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Tasks"
          value={totalFilteredTasks.toString()}
          subtitle={isUnfiltered ? `${d.totalTasks ?? totalFilteredTasks} in plan` : "filtered view"}
          status="healthy"
          icon={<ListChecks className="h-4 w-4" />}
          variant="violet"
        />
        <MetricCard
          title="Completion Rate"
          value={`${isUnfiltered ? completionPct : totalFilteredTasks > 0 ? Math.round((doneCount / totalFilteredTasks) * 100) : 0}%`}
          subtitle={`${doneCount} tasks done`}
          status="healthy"
          progressPercent={isUnfiltered ? completionPct : totalFilteredTasks > 0 ? Math.round((doneCount / totalFilteredTasks) * 100) : 0}
          progressLabel="complete"
          icon={<CheckCircle2 className="h-4 w-4" />}
          variant="emerald"
        />
        <MetricCard
          title="Open Tasks"
          value={openTaskCount.toString()}
          subtitle={isUnfiltered ? "awaiting action" : "in this department"}
          status="healthy"
          icon={<CircleDashed className="h-4 w-4" />}
          variant="cyan"
        />
        <MetricCard
          title="Blocked Tasks"
          value={blockedTaskCount.toString()}
          subtitle={blockedTaskCount > 0 ? "needs attention" : "nothing blocked"}
          status={blockedTaskCount > 0 ? "warning" : "healthy"}
          icon={<Ban className="h-4 w-4" />}
          variant="amber"
        />
      </div>

      {/* Top Filter Bar */}
      {departments.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Filter planning overview by department</p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Department:</span>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger size="sm" className="w-[180px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Task Status & Milestones Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CardPrimitive
          title="Task Status Breakdown"
          subtitle={`${totalFilteredTasks} tasks total`}
        >
          {totalFilteredTasks === 0 ? (
            <EmptyState
              icon={<ListChecks className="size-5" />}
              title="No tasks found"
              description="Nothing matches this department filter yet."
            />
          ) : (
            <div>
              <div className="relative">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.hex} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-lg font-bold text-foreground font-mono tabular-nums">{totalFilteredTasks}</p>
                  <p className="text-[10px] text-muted-foreground">tasks</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3 justify-center">
                {pieData.map((d) => (
                  <span key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.hex }} />
                    {d.name} ({d.value})
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardPrimitive>

        <div className="lg:col-span-2">
          <CardPrimitive
            title="Milestone Progress"
            subtitle={`${filteredMilestones.length} milestones tracked`}
          >
            {filteredMilestones.length === 0 ? (
              <EmptyState
                icon={<Flag className="size-5" />}
                title="No milestones yet"
                description="Milestones added to this plan will show their task progress here."
              />
            ) : (
              <div className="space-y-3">
                {filteredMilestones.slice(0, 6).map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-col gap-1.5 rounded-lg border border-border px-3.5 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Flag
                          className={cn(
                            "h-4 w-4 shrink-0",
                            m.status === "ACHIEVED"
                              ? "text-success"
                              : m.isOverdue
                              ? "text-destructive"
                              : "text-primary"
                          )}
                        />
                        <span className="text-sm font-medium text-foreground truncate">{m.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-xs">
                        {m.dueDate && (
                          <span
                            className={cn(
                              "font-medium",
                              m.isOverdue ? "text-destructive" : "text-muted-foreground"
                            )}
                          >
                            {m.isOverdue
                              ? "Overdue"
                              : new Date(m.dueDate).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                })}
                          </span>
                        )}
                        <span className="font-semibold text-foreground">{m.percent}%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            m.status === "ACHIEVED"
                              ? "bg-success"
                              : m.isOverdue
                              ? "bg-destructive"
                              : "bg-primary"
                          )}
                          style={{ width: `${Math.min(100, Math.max(0, m.percent))}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {m.doneTasks}/{m.totalTasks} tasks
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardPrimitive>
        </div>
      </div>

      {/* Deadlines At A Glance */}
      <CardPrimitive
        title="Deadlines at a Glance"
        subtitle="Open tasks grouped by urgency"
      >
        <TaskDueBuckets tasks={filteredTasks as Task[]} />
      </CardPrimitive>
    </div>
  );
}
