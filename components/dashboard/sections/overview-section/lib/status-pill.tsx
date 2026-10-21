import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PillTone = "neutral" | "primary" | "success" | "warning" | "danger";

const TONES: Record<PillTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-destructive/12 text-destructive",
};

/**
 * The badge/pill treatment shared by every Overview tab — the same shape the
 * Summary tab uses for its "All clear" / "N issues" counters.
 */
export function StatusPill({
  children,
  tone = "neutral",
  uppercase = true,
  className,
}: {
  children: ReactNode;
  tone?: PillTone;
  uppercase?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide",
        uppercase && "uppercase",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
