import { AlertTriangle, Clock, CalendarClock, CheckCircle2 } from "lucide-react";
import type { Task } from "@/lib/types";
import { DEADLINE_COLORS } from "../lib/chart-palette";
import { useMountedTransition } from "../hooks/use-count-up";
import { MetricCard } from "@/components/dashboard/components/metric-card";

const BUCKET_ICONS = { overdue: AlertTriangle, today: Clock, week: CalendarClock, completed: CheckCircle2 };

const BUCKET_LABELS = {
  overdue: "Overdue",
  today: "Due today",
  week: "Due this week",
  completed: "Completed (7d)",
} as const;

export function TaskDueBuckets({ tasks }: { tasks: Task[] }) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400000);
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 86400000);

  const withDue = tasks.filter((t) => t.dueDate && t.status !== "DONE" && t.status !== "COMPLETED");
  const overdue = withDue.filter((t) => new Date(t.dueDate!) < startOfToday).length;
  const dueToday = withDue.filter((t) => new Date(t.dueDate!) >= startOfToday && new Date(t.dueDate!) < endOfToday).length;
  const dueThisWeek = withDue.filter((t) => new Date(t.dueDate!) >= endOfToday && new Date(t.dueDate!) < endOfWeek).length;
  const recentlyCompleted = tasks.filter(
    (t) => (t.status === "DONE" || t.status === "COMPLETED") && t.completedAt && (now.getTime() - new Date(t.completedAt).getTime()) < 7 * 86400000
  ).length;

  const buckets = [
    { key: "overdue" as const, count: overdue, variant: "amber" as const },
    { key: "today" as const, count: dueToday, variant: "cyan" as const },
    { key: "week" as const, count: dueThisWeek, variant: "violet" as const },
    { key: "completed" as const, count: recentlyCompleted, variant: "emerald" as const },
  ];

  const activeTotal = overdue + dueToday + dueThisWeek || 1;
  const mounted = useMountedTransition();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {buckets.map((b) => {
          const Icon = BUCKET_ICONS[b.key];
          return (
            <MetricCard
              key={b.key}
              title={BUCKET_LABELS[b.key]}
              value={b.count.toString()}
              subtitle={
                b.key === "overdue"
                  ? "past their deadline"
                  : b.key === "today"
                    ? "due today"
                    : b.key === "week"
                      ? "next 7 days"
                      : "last 7 days"
              }
              status={b.key === "overdue" && b.count > 0 ? "warning" : "healthy"}
              icon={<Icon className="h-4 w-4" />}
              variant={b.variant}
            />
          );
        })}
      </div>

      {(overdue + dueToday + dueThisWeek) > 0 && (
        <div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            {overdue > 0 && (
              <div
                className="transition-[width] duration-700 ease-out"
                style={{ width: mounted ? `${(overdue / activeTotal) * 100}%` : "0%", background: DEADLINE_COLORS.overdue }}
              />
            )}
            {dueToday > 0 && (
              <div
                className="transition-[width] duration-700 ease-out delay-75"
                style={{ width: mounted ? `${(dueToday / activeTotal) * 100}%` : "0%", background: DEADLINE_COLORS.today }}
              />
            )}
            {dueThisWeek > 0 && (
              <div
                className="transition-[width] duration-700 ease-out delay-150"
                style={{ width: mounted ? `${(dueThisWeek / activeTotal) * 100}%` : "0%", background: DEADLINE_COLORS.week }}
              />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {overdue + dueToday + dueThisWeek} open task{overdue + dueToday + dueThisWeek !== 1 ? "s" : ""} with upcoming or missed deadlines
          </p>
        </div>
      )}
    </div>
  );
}
