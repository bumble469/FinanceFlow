import type { Insight } from "./insights-engine";

const TONE_CONFIG = {
  positive: { accent: "#34d399", bg: "rgba(52,211,153,0.06)", border: "rgba(52,211,153,0.25)", icon: "✦", label: "Positive" },
  warning: { accent: "#fbbf24", bg: "rgba(251,191,36,0.06)", border: "rgba(251,191,36,0.25)", icon: "⚠", label: "Warning" },
  negative: { accent: "#f87171", bg: "rgba(248,113,113,0.06)", border: "rgba(248,113,113,0.25)", icon: "✕", label: "Risk" },
  neutral: { accent: "#94a3b8", bg: "rgba(148,163,184,0.06)", border: "rgba(148,163,184,0.18)", icon: "→", label: "Info" },
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
      {insights.map((ins, i) => {
        const cfg = TONE_CONFIG[ins.tone];
        return (
          <div
            key={i}
            className="relative flex items-start gap-3 rounded-lg px-3 py-2.5 overflow-hidden"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderLeft: `3px solid ${cfg.accent}` }}
          >
            <span
              className="flex-shrink-0 flex items-center justify-center rounded-md text-[11px] font-bold mt-0.5"
              style={{ width: 22, height: 22, background: `${cfg.accent}22`, color: cfg.accent }}
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