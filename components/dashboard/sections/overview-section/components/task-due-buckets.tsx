import { AlertTriangle, Clock, CalendarClock, CheckCircle2 } from "lucide-react";
import type { Task } from "@/lib/types";
import { DEADLINE_BUCKET_CONFIG } from "../lib/overview-utils";
import { useCountUp, useMountedTransition } from "../hooks/use-count-up";

const BUCKET_ICONS = { overdue: AlertTriangle, today: Clock, week: CalendarClock, completed: CheckCircle2 };

function AnimatedCount({ value }: { value: number }) {
  const animated = useCountUp(value, 700);
  return <>{Math.round(animated)}</>;
}

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
    { key: "overdue" as const, count: overdue },
    { key: "today" as const, count: dueToday },
    { key: "week" as const, count: dueThisWeek },
    { key: "completed" as const, count: recentlyCompleted },
  ];

  const activeTotal = overdue + dueToday + dueThisWeek || 1;
  const mounted = useMountedTransition();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {buckets.map((b) => {
          const cfg = DEADLINE_BUCKET_CONFIG[b.key];
          const Icon = BUCKET_ICONS[b.key];
          return (
            <div key={b.key} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: cfg.bg, color: cfg.hex }}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground leading-none">
                  <AnimatedCount value={b.count} />
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{cfg.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {(overdue + dueToday + dueThisWeek) > 0 && (
        <div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            {overdue > 0 && (
              <div
                className="transition-[width] duration-700 ease-out"
                style={{ width: mounted ? `${(overdue / activeTotal) * 100}%` : "0%", background: DEADLINE_BUCKET_CONFIG.overdue.hex }}
              />
            )}
            {dueToday > 0 && (
              <div
                className="transition-[width] duration-700 ease-out delay-75"
                style={{ width: mounted ? `${(dueToday / activeTotal) * 100}%` : "0%", background: DEADLINE_BUCKET_CONFIG.today.hex }}
              />
            )}
            {dueThisWeek > 0 && (
              <div
                className="transition-[width] duration-700 ease-out delay-150"
                style={{ width: mounted ? `${(dueThisWeek / activeTotal) * 100}%` : "0%", background: DEADLINE_BUCKET_CONFIG.week.hex }}
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
