/**
 * Health score — ported from the old `insights-engine.ts` so the numbers
 * stay identical to the previous Overview, but with the sub-scores exposed
 * so the card can show *why* a score is what it is.
 */

export interface HealthScoreInput {
  /** percentage of budget consumed (0-100+) */
  budgetUsedPct: number;
  /** percentage of tasks completed (0-100) */
  progressPct: number;
  overdueMilestones: number;
  blockedTasks: number;
  totalTasks: number;
  financeEnabled?: boolean;
}

export interface HealthScore {
  score: number;
  budget: number;
  schedule: number;
  execution: number;
  label: "Excellent" | "Moderate" | "At Risk";
  financeEnabled: boolean;
}

export function computeHealthScore(params: HealthScoreInput): HealthScore {
  const {
    budgetUsedPct,
    progressPct,
    overdueMilestones,
    blockedTasks,
    totalTasks,
    financeEnabled = true,
  } = params;

  const scheduleScore = Math.max(0, 100 - overdueMilestones * 15);
  const blockedRatio = totalTasks > 0 ? blockedTasks / totalTasks : 0;
  const executionScore = Math.max(0, 100 - blockedRatio * 100);

  let score: number;
  let budgetScore: number;

  if (!financeEnabled) {
    // No money to judge — schedule and execution carry the whole score.
    budgetScore = 100;
    score = scheduleScore * 0.5 + executionScore * 0.5;
  } else {
    budgetScore =
      budgetUsedPct <= 100
        ? 100 - Math.max(0, budgetUsedPct - progressPct)
        : Math.max(0, 60 - (budgetUsedPct - 100));
    score = budgetScore * 0.4 + scheduleScore * 0.3 + executionScore * 0.3;
  }

  const rounded = Math.round(Math.max(0, Math.min(100, score)));

  return {
    score: rounded,
    budget: Math.round(budgetScore),
    schedule: Math.round(scheduleScore),
    execution: Math.round(executionScore),
    label: rounded >= 75 ? "Excellent" : rounded >= 50 ? "Moderate" : "At Risk",
    financeEnabled,
  };
}
