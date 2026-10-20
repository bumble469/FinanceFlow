import type { MilestoneLike, TaskLike } from "./types";

/**
 * Rule-based insight generation — ported from the old
 * `overview-section/components/insights-engine.ts`.
 *
 * Tones map onto the app's semantic status tokens:
 *   positive -> --success, warning -> --warning, negative -> --destructive,
 *   neutral  -> --muted-foreground
 */
export type InsightTone = "positive" | "warning" | "negative" | "neutral";

export interface Insight {
  id: string;
  text: string;
  tone: InsightTone;
}

export interface InsightInput {
  isProject: boolean;
  budgetUsedPct: number;
  progressPct: number;
  overdueMilestones: MilestoneLike[];
  blockedTasks: TaskLike[];
  departmentStats: {
    name: string;
    budgetUsedPct: number;
    completionPct: number;
    openTasks: number;
  }[];
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  daysLeft?: number | null;
  incompleteTasks?: number;
  financeEnabled?: boolean;
}

export function generateInsights(params: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const {
    budgetUsedPct,
    progressPct,
    overdueMilestones,
    blockedTasks,
    departmentStats,
    expensesByCategory,
    totalExpenses,
    daysLeft,
    incompleteTasks,
    financeEnabled = true,
  } = params;

  const push = (text: string, tone: InsightTone) =>
    insights.push({ id: `insight-${insights.length}`, text, tone });

  if (financeEnabled && budgetUsedPct - progressPct > 15) {
    push(
      `Budget utilization (${budgetUsedPct.toFixed(0)}%) is running ahead of progress (${progressPct.toFixed(0)}%).`,
      "warning"
    );
  }

  if (overdueMilestones.length > 0) {
    const titles = overdueMilestones
      .slice(0, 2)
      .map((m) => `"${m.title}"`)
      .join(", ");
    push(
      `${overdueMilestones.length} milestone${overdueMilestones.length > 1 ? "s are" : " is"} overdue: ${titles}${
        overdueMilestones.length > 2 ? "..." : ""
      }.`,
      "negative"
    );
  }

  if (blockedTasks.length > 0) {
    push(
      `${blockedTasks.length} task${blockedTasks.length > 1 ? "s are" : " is"} currently blocked and need attention.`,
      "negative"
    );
  }

  const highestWorkload = [...departmentStats].sort((a, b) => b.openTasks - a.openTasks)[0];
  if (highestWorkload && highestWorkload.openTasks > 0) {
    push(
      `${highestWorkload.name} has the highest pending workload (${highestWorkload.openTasks} open tasks).`,
      "neutral"
    );
  }

  const bestDept = [...departmentStats]
    .filter((d) => d.completionPct > 0)
    .sort((a, b) => b.completionPct - a.completionPct)[0];
  if (bestDept) {
    push(
      `${bestDept.name} is leading with ${bestDept.completionPct.toFixed(0)}% task completion.`,
      "positive"
    );
  }

  const overBudgetDept = departmentStats.find((d) => d.budgetUsedPct > 100);
  if (financeEnabled && overBudgetDept) {
    push(
      `${overBudgetDept.name} has exceeded its allocated budget (${overBudgetDept.budgetUsedPct.toFixed(0)}% used).`,
      "negative"
    );
  }

  if (financeEnabled && totalExpenses > 0) {
    const sorted = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const [topCategory, topAmount] = sorted[0];
      if (topAmount / totalExpenses > 0.5) {
        push(
          `${Math.round((topAmount / totalExpenses) * 100)}% of expenses belong to ${topCategory}.`,
          "neutral"
        );
      }
    }
  }

  if (
    !params.isProject &&
    daysLeft !== undefined &&
    daysLeft !== null &&
    incompleteTasks !== undefined
  ) {
    if (daysLeft >= 0 && incompleteTasks > 0) {
      push(
        `Event is ${daysLeft} day${daysLeft !== 1 ? "s" : ""} away with ${incompleteTasks} incomplete task${
          incompleteTasks !== 1 ? "s" : ""
        }.`,
        daysLeft <= 7 && incompleteTasks > 5 ? "negative" : "neutral"
      );
    }
  }

  return insights.slice(0, 6);
}
