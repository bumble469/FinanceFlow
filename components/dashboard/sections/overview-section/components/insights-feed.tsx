import type { Insight } from "@/lib/analytics/insights";

const TONE_CONFIG = {
  positive: { accent: "var(--success)", bg: "color-mix(in oklab, var(--success) 8%, transparent)", border: "color-mix(in oklab, var(--success) 30%, transparent)", icon: "✦", label: "Positive" },
  warning: { accent: "var(--warning)", bg: "color-mix(in oklab, var(--warning) 8%, transparent)", border: "color-mix(in oklab, var(--warning) 30%, transparent)", icon: "⚠", label: "Warning" },
  negative: { accent: "var(--destructive)", bg: "color-mix(in oklab, var(--destructive) 8%, transparent)", border: "color-mix(in oklab, var(--destructive) 30%, transparent)", icon: "✕", label: "Risk" },
  neutral: { accent: "var(--muted-foreground)", bg: "color-mix(in oklab, var(--muted-foreground) 8%, transparent)", border: "color-mix(in oklab, var(--muted-foreground) 22%, transparent)", icon: "→", label: "Info" },
} as const;

export function InsightsFeed({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <span className="text-2xl">✦</span>
        <p className="text-sm text-muted-foreground text-center">Everything looks steady — no notable signals.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {insights.map((ins) => {
        const cfg = TONE_CONFIG[ins.tone];
        return (
          <div
            key={ins.id}
            className="relative flex items-start gap-3 rounded-lg px-3 py-2.5 overflow-hidden"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderLeft: `3px solid ${cfg.accent}` }}
          >
            <span
              className="flex-shrink-0 flex items-center justify-center rounded-md text-[11px] font-bold mt-0.5"
              style={{ width: 22, height: 22, background: `color-mix(in oklab, ${cfg.accent} 16%, transparent)`, color: cfg.accent }}
            >
              {cfg.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: cfg.accent }}>{cfg.label}</p>
              <p className="text-sm text-foreground leading-snug">{ins.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}