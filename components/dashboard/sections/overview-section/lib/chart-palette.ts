/**
 * Chart colour palette for the Overview tabs.
 *
 * Colours are CSS custom properties (`var(--chart-N)`) rather than hex
 * literals, so every chart re-steps for dark mode automatically and stays
 * consistent with the rest of the app. Recharts accepts `var(--x)` in
 * `fill`/`stroke` — it passes the value straight through to SVG.
 *
 * The categorical order is FIXED: hue slot N always means the same thing
 * across every chart, and it is never cycled past slot 8. A 9th series folds
 * into "Other" rather than reusing a hue.
 */
export const CHART_SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const;

/** The eight slot colours, as rgba strings for tooltip/legend swatches. */
export const CHART_SERIES_RGBA = [
  "rgba(48, 161, 105, 0.16)",
  "rgba(37, 130, 199, 0.16)",
  "rgba(214, 158, 46, 0.16)",
  "rgba(203, 84, 60, 0.16)",
  "rgba(163, 79, 176, 0.16)",
  "rgba(45, 156, 170, 0.16)",
  "rgba(196, 116, 51, 0.16)",
  "rgba(150, 76, 168, 0.16)",
] as const;

/**
 * Picks the colour for series `index`. Past the eighth slot the series folds
 * into the last slot rather than generating a new hue.
 */
export function seriesColor(index: number): string {
  return CHART_SERIES[Math.min(index, CHART_SERIES.length - 1)];
}

/**
 * Task status colours. These are STATUS colours, not categorical series
 * colours — each state has a fixed meaning, so they deliberately do NOT come
 * from the categorical palette.
 */
export const TASK_STATUS_COLORS: Record<string, { label: string; color: string }> = {
  TODO: { label: "To do", color: "var(--chart-2)" },
  IN_PROGRESS: { label: "In progress", color: "var(--chart-1)" },
  SUBMITTED: { label: "Submitted", color: "var(--chart-6)" },
  CHANGES_REQUESTED: { label: "Changes requested", color: "var(--chart-3)" },
  BLOCKED: { label: "Blocked", color: "var(--destructive)" },
  DONE: { label: "Done", color: "var(--success)" },
};

/** Deadline urgency colours — also status colours, not categorical. */
export const DEADLINE_COLORS = {
  overdue: "var(--destructive)",
  today: "var(--warning)",
  week: "var(--chart-2)",
  completed: "var(--success)",
} as const;
