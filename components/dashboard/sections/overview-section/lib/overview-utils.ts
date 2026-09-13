import { getCurrencySymbol } from "@/lib/currency";
import type { FinancialStatus, TaskStatus } from "@/lib/types";

export function formatCurrency(value: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol} ${value.toLocaleString("en-IN")}`;
}

export function getStatus(value: number, threshold: number): FinancialStatus {
  if (threshold === 0) return "risk";
  const ratio = value / threshold;
  if (ratio >= 0.7) return "healthy";
  if (ratio >= 0.3) return "warning";
  return "risk";
}

export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; hex: string }> = {
  TODO: { label: "To do", hex: "#9ca3af" },
  IN_PROGRESS: { label: "In progress", hex: "#0ea5e9" },
  SUBMITTED: { label: "Submitted", hex: "#6366f1" },
  CHANGES_REQUESTED: { label: "Changes requested", hex: "#f59e0b" },
  BLOCKED: { label: "Blocked", hex: "#ef4444" },
  DONE: { label: "Done", hex: "#22c55e" },
  COMPLETED: { label: "Completed", hex: "#22c55e" },
};

export const DEADLINE_BUCKET_CONFIG = {
  overdue: { label: "Overdue", hex: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  today: { label: "Due today", hex: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  week: { label: "Due this week", hex: "#0ea5e9", bg: "rgba(14,165,233,0.1)" },
  completed: { label: "Completed (7d)", hex: "#22c55e", bg: "rgba(34,197,94,0.1)" },
} as const;

export const DEPT_PALETTE = ["#6366f1", "#22c55e", "#f59e0b", "#0ea5e9", "#ec4899", "#a855f7", "#14b8a6", "#f97316"];