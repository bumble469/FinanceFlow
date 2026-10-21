import type { ReactNode } from "react";
import { formatCurrency } from "./relative-time";

/**
 * One tooltip surface for every chart in the Overview.
 *
 * The Summary tab already had a hand-built pie tooltip; the other tabs fell
 * back to Recharts' inline `contentStyle` objects, which rendered a slightly
 * different box in every chart. These components give all of them the same
 * rounded / bordered / popover surface, and a value set in the same
 * monospace tabular style the Summary metric cards use.
 */

export function ChartTooltipShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs">
      {children}
    </div>
  );
}

interface ChartTooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

/** Recharts passes `payload`/`active` straight through; we only need the shape. */
export interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
  /** currency code, when the chart's values are money */
  currency?: string;
  /** renders the value; defaults to the raw number */
  formatValue?: (value: number, entry: ChartTooltipEntry) => ReactNode;
  /** name shown before the value for each series */
  seriesName?: (entry: ChartTooltipEntry) => string;
  /** optional swatch colour; defaults to the series colour from the payload */
  showSwatch?: boolean;
}

/**
 * The generic multi-series tooltip. Pass it to Recharts as
 * `<Tooltip content={<ChartTooltip currency={currency} />} />`.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  currency,
  formatValue,
  seriesName,
  showSwatch = true,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const renderValue = (entry: ChartTooltipEntry) => {
    const raw = entry.value ?? 0;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (formatValue) return formatValue(Number.isFinite(n) ? n : 0, entry);
    if (currency) return formatMoney(n, currency);
    return raw;
  };

  return (
    <ChartTooltipShell>
      {label !== undefined && label !== "" && (
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={`${entry.dataKey ?? i}`} className="flex items-center gap-2">
            {showSwatch && entry.color && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
            )}
            <span className="text-muted-foreground">
              {seriesName ? seriesName(entry) : entry.name}
            </span>
            <span className="font-mono font-medium tabular-nums text-foreground">
              {renderValue(entry)}
            </span>
          </div>
        ))}
      </div>
    </ChartTooltipShell>
  );
}

/** Formats a money amount the same way the rest of the Overview does. */
export function formatMoney(value: number, currency: string): string {
  return formatCurrency(value, currency);
}

/**
 * The pie-specific tooltip the Summary tab already used — kept as a thin
 * wrapper so the pie charts keep their swatch-and-count look.
 */
export function ChartPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <ChartTooltipShell>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.payload?.hex }} />
        <span className="text-muted-foreground">{p.name}:</span>
        <span className="font-mono font-medium tabular-nums text-foreground">{p.value}</span>
      </div>
    </ChartTooltipShell>
  );
}
