import type { MilestoneLike, TaskLike } from "./types";

/**
 * Risk counters for the Summary "Risks & flags" panel.
 *
 * Four dimensions, shown as a 2x2 tile grid:
 *   Budget    - departments over their allocated budget
 *   Schedule  - overdue milestones
 *   Tasks     - blocked tasks
 *   Scope     - tasks whose due date falls after their milestone deadline
 *
 * Event plans add a fifth dimension, Attendance, which turns the grid into
 * 2x3.
 */

export type RiskDimension = "budget" | "schedule" | "tasks" | "scope" | "attendance";

export interface RiskCount {
  dimension: RiskDimension;
  label: string;
  sublabel: string;
  count: number;
}

export interface RiskInput {
  /** departments whose actual spend exceeds their budget */
  overBudgetDepartments: { name: string }[];
  overdueMilestones: MilestoneLike[];
  blockedTasks: TaskLike[];
  /** tasks whose dueDate is after the milestone's dueDate */
  scopeViolations: { id: string; title: string }[];
  /** event-only: attendees checked in vs expected crowd (null = not tracked) */
  attendance?: { checkedIn: number; total: number } | null;
}

export function computeRiskCounts(input: RiskInput): RiskCount[] {
  const counts: RiskCount[] = [
    {
      dimension: "budget",
      label: "over budget",
      sublabel: "departments",
      count: input.overBudgetDepartments.length,
    },
    {
      dimension: "schedule",
      label: "overdue",
      sublabel: "milestones",
      count: input.overdueMilestones.length,
    },
    {
      dimension: "tasks",
      label: "blocked",
      sublabel: "tasks",
      count: input.blockedTasks.length,
    },
    {
      dimension: "scope",
      label: "past due",
      sublabel: "milestone deadline",
      count: input.scopeViolations.length,
    },
  ];

  if (input.attendance) {
    const { checkedIn, total } = input.attendance;
    counts.push({
      dimension: "attendance",
      label: "not checked in",
      sublabel: "attendees",
      count: Math.max(0, total - checkedIn),
    });
  }

  return counts;
}

export function totalRiskCount(counts: RiskCount[]): number {
  return counts.reduce((s, c) => s + c.count, 0);
}

/**
 * A task is "past its milestone deadline" when the task's own due date sits
 * after the due date of a milestone it belongs to.
 */
export function findScopeViolations(
  tasks: (TaskLike & { milestones?: { id: string; title: string; dueDate?: string | null }[] })[]
): { id: string; title: string }[] {
  const violations: { id: string; title: string }[] = [];

  for (const task of tasks) {
    if (!task.dueDate) continue;
    const taskDue = new Date(task.dueDate).getTime();
    if (Number.isNaN(taskDue)) continue;

    for (const milestone of task.milestones ?? []) {
      if (!milestone.dueDate) continue;
      const msDue = new Date(milestone.dueDate).getTime();
      if (Number.isNaN(msDue)) continue;
      if (taskDue > msDue) {
        violations.push({ id: task.id, title: task.title ?? "Untitled task" });
        break;
      }
    }
  }

  return violations;
}
