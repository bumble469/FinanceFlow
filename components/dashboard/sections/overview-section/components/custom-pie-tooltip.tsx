import { ChartPieTooltip } from "../lib/chart-tooltip";

/**
 * The pie tooltip used by the Planning tab's task-status donut.
 *
 * It now delegates to the shared `ChartPieTooltip` so every pie in the
 * Overview renders the same tooltip surface.
 */
export function CustomPieTooltip(props: any) {
  return <ChartPieTooltip {...props} />;
}
