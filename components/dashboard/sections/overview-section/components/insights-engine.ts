import type { Task, Milestone } from "@/lib/types";

export interface Insight {
  text: string;
  tone: "positive" | "warning" | "negative" | "neutral";
}

export function computeHealthScore(params: {
  budgetUsedPct: number;
  progressPct: number;
  overdueMilestones: number;
  blockedTasks: number;
  totalTasks: number;
}): number {
  const { budgetUsedPct, progressPct, overdueMilestones, blockedTasks, totalTasks } = params;

  const budgetScore = budgetUsedPct <= 100 ? 100 - Math.max(0, budgetUsedPct - progressPct) : Math.max(0, 60 - (budgetUsedPct - 100));
  const scheduleScore = Math.max(0, 100 - overdueMilestones * 15);
  const blockedRatio = totalTasks > 0 ? blockedTasks / totalTasks : 0;
  const executionScore = Math.max(0, 100 - blockedRatio * 100);

  const weighted = budgetScore * 0.4 + scheduleScore * 0.3 + executionScore * 0.3;
  return Math.round(Math.max(0, Math.min(100, weighted)));
}

export function generateInsights(params: {
  isProject: boolean;
  budgetUsedPct: number;
  progressPct: number;
  overdueMilestones: Milestone[];
  blockedTasks: Task[];
  departmentStats: { name: string; budgetUsedPct: number; completionPct: number; openTasks: number }[];
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  daysLeft?: number | null;
  incompleteTasks?: number;
}): Insight[] {
  const insights: Insight[] = [];
  const {
    budgetUsedPct, progressPct, overdueMilestones, blockedTasks,
    departmentStats, expensesByCategory, totalExpenses, daysLeft, incompleteTasks,
  } = params;

  if (budgetUsedPct - progressPct > 15) {
    insights.push({
      text: `Budget utilization (${budgetUsedPct.toFixed(0)}%) is running ahead of progress (${progressPct.toFixed(0)}%).`,
      tone: "warning",
    });
  }

  if (overdueMilestones.length > 0) {
    insights.push({
      text: `${overdueMilestones.length} milestone${overdueMilestones.length > 1 ? "s are" : " is"} overdue: ${overdueMilestones.slice(0, 2).map((m) => `"${m.title}"`).join(", ")}${overdueMilestones.length > 2 ? "..." : ""}.`,
      tone: "negative",
    });
  }

  if (blockedTasks.length > 0) {
    insights.push({
      text: `${blockedTasks.length} task${blockedTasks.length > 1 ? "s are" : " is"} currently blocked and need attention.`,
      tone: "negative",
    });
  }

  const highestWorkload = [...departmentStats].sort((a, b) => b.openTasks - a.openTasks)[0];
  if (highestWorkload && highestWorkload.openTasks > 0) {
    insights.push({ text: `${highestWorkload.name} has the highest pending workload (${highestWorkload.openTasks} open tasks).`, tone: "neutral" });
  }

  const bestDept = [...departmentStats].filter((d) => d.completionPct > 0).sort((a, b) => b.completionPct - a.completionPct)[0];
  if (bestDept) {
    insights.push({ text: `${bestDept.name} is leading with ${bestDept.completionPct.toFixed(0)}% task completion.`, tone: "positive" });
  }

  const overBudgetDept = departmentStats.find((d) => d.budgetUsedPct > 100);
  if (overBudgetDept) {
    insights.push({ text: `${overBudgetDept.name} has exceeded its allocated budget (${overBudgetDept.budgetUsedPct.toFixed(0)}% used).`, tone: "negative" });
  }

  if (totalExpenses > 0) {
    const sorted = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const [topCategory, topAmount] = sorted[0];
      if (topAmount / totalExpenses > 0.5) {
        insights.push({ text: `${Math.round((topAmount / totalExpenses) * 100)}% of expenses belong to ${topCategory}.`, tone: "neutral" });
      }
    }
  }

  if (!params.isProject && daysLeft !== undefined && daysLeft !== null && incompleteTasks !== undefined) {
    if (daysLeft >= 0 && incompleteTasks > 0) {
      insights.push({
        text: `Event is ${daysLeft} day${daysLeft !== 1 ? "s" : ""} away with ${incompleteTasks} incomplete task${incompleteTasks !== 1 ? "s" : ""}.`,
        tone: daysLeft <= 7 && incompleteTasks > 5 ? "negative" : "neutral",
      });
    }
  }

  return insights.slice(0, 6);
}