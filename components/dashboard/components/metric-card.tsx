"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { FinancialStatus } from "@/lib/types";

// Local count-up animation — mirrors the shared overview-section hook,
// duplicated here since this component lives outside that folder.
function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else setValue(target);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}

// ─── Per-card colour tokens (inline styles — avoids Tailwind purge on dynamic classes) ──

type CardVariant = "violet" | "cyan" | "amber" | "emerald";

interface VariantTokens {
  accent: string;   // the primary hex accent
  accentBg: string; // 12% alpha version for icon bg + border tint
  accentMid: string;// 25% alpha for left border
}

const VARIANTS: Record<CardVariant, VariantTokens> = {
  violet: { accent: "#a78bfa", accentBg: "rgba(139,92,246,0.12)", accentMid: "rgba(139,92,246,0.55)" },
  cyan: { accent: "#22d3ee", accentBg: "rgba(34,211,238,0.10)", accentMid: "rgba(34,211,238,0.55)" },
  amber: { accent: "#fbbf24", accentBg: "rgba(251,191,36,0.10)", accentMid: "rgba(251,191,36,0.55)" },
  emerald: { accent: "#34d399", accentBg: "rgba(52,211,153,0.10)", accentMid: "rgba(52,211,153,0.55)" },
};

// ─── Circular progress ────────────────────────────────────────────────────────

function CircularProgress({ percent, accent }: { percent: number; accent: string }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percent));
  const animated = useCountUp(clamped, 800);
  const dash = (animated / 100) * circ;
  const gap = circ - dash;

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48 }}>
      <svg width="48" height="48" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="3.5" className="text-border" />
        <circle
          cx="24" cy="24" r={r}
          fill="none"
          stroke={accent}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
        />
      </svg>
      <span className="absolute text-[10px] font-semibold font-mono tabular-nums" style={{ color: accent }}>
        {Math.round(animated)}%
      </span>
    </div>
  );
}

// ─── MetricCard ──────────────────────────────────────────────────────────────

export interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  status: FinancialStatus;
  trend?: "up" | "down";
  icon?: React.ReactNode;
  isSimulated?: boolean;
  progressPercent?: number;
  progressLabel?: string;
  variant?: CardVariant;
}

export function MetricCard({
  title,
  value,
  subtitle,
  status,
  trend,
  icon,
  isSimulated,
  progressPercent,
  progressLabel,
  variant = "violet",
}: MetricCardProps) {
  const { accent, accentBg, accentMid } = VARIANTS[variant];
  const showProgress = progressPercent !== undefined;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-card flex flex-col gap-3 p-4",
        "border border-border",
        "transition-all duration-200 hover:shadow-lg hover:-translate-y-px",
        isSimulated && "ring-2 ring-primary/30"
      )}
      style={{
        borderLeft: `3px solid ${accentMid}`,
      }}
    >
      {/* top glow strip */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px]"
        style={{ background: `linear-gradient(to right, ${accent}55, transparent)` }}
      />

      {/* subtle inner bg tint at top-left to give depth */}
      <div
        className="pointer-events-none absolute left-0 top-0 h-24 w-24 rounded-full blur-2xl"
        style={{ background: accentBg, transform: "translate(-30%, -30%)" }}
      />

      {/* ── Top row: icon + title ── */}
      <div className="relative flex items-center gap-2.5">
        {icon && (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: accentBg, color: accent }}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground leading-tight truncate uppercase tracking-wide">
            {title}
          </p>
          {isSimulated && (
            <span className="text-[9px] font-semibold text-primary/70 tracking-widest uppercase">
              simulated
            </span>
          )}
        </div>
      </div>

      {/* ── Bottom row: value + trend left, ring right ── */}
      <div className="relative flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-lg font-semibold text-foreground font-mono tabular-nums leading-none">
              {value}
            </span>
            {trend && (
              <span
                className="inline-flex items-center gap-0.5 text-[11px] font-semibold"
                style={{ color: trend === "up" ? "#34d399" : "#f87171" }}
              >
                {trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              </span>
            )}
          </div>

          {subtitle && (
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-none">{subtitle}</p>
          )}
          {progressLabel && showProgress && (
            <p className="mt-1 text-[11px] leading-none" style={{ color: accent }}>
              {progressLabel}
            </p>
          )}
        </div>

        {showProgress && (
          <CircularProgress percent={progressPercent!} accent={accent} />
        )}
      </div>
    </div>
  );
}
