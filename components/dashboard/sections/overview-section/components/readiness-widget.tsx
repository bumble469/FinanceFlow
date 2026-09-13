import { CheckCircle2, PlayCircle, Ban, ListTodo, CalendarCheck2 } from "lucide-react";
import type { Task } from "@/lib/types";
import { useCountUp } from "../hooks/use-count-up";

export function ReadinessWidget({ tasks, daysLeft }: { tasks: Task[]; daysLeft: number | null }) {
  const total = tasks.length;
  const counts = {
    DONE: tasks.filter((t) => t.status === "DONE" || t.status === "COMPLETED").length,
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    BLOCKED: tasks.filter((t) => t.status === "BLOCKED").length,
    TODO: tasks.filter((t) => t.status === "TODO" || t.status === "SUBMITTED" || t.status === "CHANGES_REQUESTED").length,
  };
  const readinessPct = total > 0 ? Math.round((counts.DONE / total) * 100) : 0;
  const animatedPct = useCountUp(readinessPct, 900);
  const ringColor = readinessPct === 100 ? "#22c55e" : readinessPct >= 60 ? "#0ea5e9" : readinessPct >= 30 ? "#f59e0b" : "#ef4444";

  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (animatedPct / 100) * circumference;

  const breakdown = [
    { label: "Done", count: counts.DONE, hex: "#22c55e", icon: CheckCircle2 },
    { label: "In progress", count: counts.IN_PROGRESS, hex: "#0ea5e9", icon: PlayCircle },
    { label: "Blocked", count: counts.BLOCKED, hex: "#ef4444", icon: Ban },
    { label: "To do", count: counts.TODO, hex: "#9ca3af", icon: ListTodo },
  ];

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-[120px] w-[120px] shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth={stroke} />
          {animatedPct > 0 && (
            <circle
              cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={ringColor} strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              style={{ filter: `drop-shadow(0 0 5px ${ringColor}55)` }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-foreground">{Math.round(animatedPct)}%</span>
          <span className="text-[10px] text-muted-foreground">ready</span>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        {breakdown.map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-3.5 w-3.5" style={{ color: b.hex }} />
                {b.label}
              </span>
              <span className="font-semibold text-foreground">{b.count}</span>
            </div>
          );
        })}
        {daysLeft !== null && daysLeft >= 0 && (
          <p className="pt-1.5 mt-1.5 border-t border-border text-[11px] text-muted-foreground flex items-center gap-1.5">
            <CalendarCheck2 className="h-3 w-3" />
            {counts.DONE}/{total} tasks done, {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
          </p>
        )}
      </div>
    </div>
  );
}
