import type { DepartmentLike, ExpenseLike, FinancialStatus, IncomeLike } from "./types";

/**
 * Budget / money helpers for the Overview.
 *
 * NOTE: the old `getStatus(value, threshold)` in overview-utils returned
 * "risk" whenever threshold was 0, which made an unconfigured project
 * (no budget set) display a red "Budget Remaining" tile. Here a zero
 * budget is "unset" — a neutral state, not a failure.
 */

export const STATUS_THRESHOLDS = {
  /** ratio of budget consumed at or above which we warn */
  warning: 0.75,
  /** ratio of budget consumed at or above which we flag risk */
  risk: 0.9,
} as const;

export function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Status for a consumed-vs-allocated amount.
 * - no budget configured -> "unset" (neutral, not a failure)
 * - consumed ratio >= risk -> "risk"
 * - consumed ratio >= warning -> "warning"
 */
export function budgetStatus(consumed: number, budget: number): FinancialStatus {
  if (budget <= 0) return "unset";
  const ratio = consumed / budget;
  if (ratio >= STATUS_THRESHOLDS.risk) return "risk";
  if (ratio >= STATUS_THRESHOLDS.warning) return "warning";
  return "healthy";
}

export function remainingStatus(remaining: number, total: number): FinancialStatus {
  return budgetStatus(total - remaining, total);
}

export interface FinanceTotals {
  totalBudget: number;
  totalAllocated: number;
  remainingBudget: number;
  totalIncomeReceived: number;
  totalIncomeExpected: number;
  totalExpensesPaid: number;
  totalExpensesCommitted: number;
  estimatedProfitLoss: number;
  budgetUsedPct: number;
  allocationPct: number;
  hasBudget: boolean;
}

/** Expense statuses that count as committed spend. */
const COMMITTED_EXPENSE_STATUSES = new Set([
  "APPROVED",
  "PARTIALLY_PAID",
  "PAID",
]);

export function computeFinanceTotals(params: {
  totalBudget: number;
  departments: DepartmentLike[];
  income: IncomeLike[];
  expenses: ExpenseLike[];
}): FinanceTotals {
  const { totalBudget, departments, income, expenses } = params;

  const totalAllocated = departments.reduce((s, d) => s + num(d.budget), 0);

  const totalIncomeReceived = income.reduce((s, i) => s + num(i.receivedAmount), 0);
  const totalIncomeExpected = income.reduce(
    (s, i) => s + (num(i.receivedAmount) > 0 ? num(i.receivedAmount) : num(i.amount)),
    0
  );

  const totalExpensesPaid = expenses.reduce((s, e) => s + num(e.paidAmount), 0);
  const totalExpensesCommitted = expenses.reduce(
    (s, e) => s + (COMMITTED_EXPENSE_STATUSES.has(e.status) ? num(e.amount) : 0),
    0
  );

  const remainingBudget = totalBudget - totalAllocated;
  const estimatedProfitLoss = totalIncomeReceived - totalExpensesPaid;
  const hasBudget = totalBudget > 0;

  return {
    totalBudget,
    totalAllocated,
    remainingBudget,
    totalIncomeReceived,
    totalIncomeExpected,
    totalExpensesPaid,
    totalExpensesCommitted,
    estimatedProfitLoss,
    budgetUsedPct: hasBudget ? (totalExpensesPaid / totalBudget) * 100 : 0,
    allocationPct: hasBudget ? (totalAllocated / totalBudget) * 100 : 0,
    hasBudget,
  };
}

/** Sum of a numeric field, tolerant of nulls and string numerics. */
export function sumBy<T>(items: T[], pick: (item: T) => unknown): number {
  return items.reduce((s, item) => s + num(pick(item)), 0);
}

/** Group a list into a Map keyed by the result of `key`. */
export function groupBy<T, K extends string | null | undefined>(
  items: T[],
  key: (item: T) => K
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
