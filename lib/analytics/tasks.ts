import type { MilestoneLike, TaskLike, TaskStatusBucket } from "./types";

/**
 * Task and milestone rollups.
 *
 * `DONE` and `COMPLETED` are both green "finished" states in the schema, so
 * they are merged into a single "Done" bucket — that keeps the status donut
 * at six segments instead of seven.
 */

export const TASK_STATUS_ORDER: TaskStatusBucket[] = [
  "TODO",
  "IN_PROGRESS",
  "SUBMITTED",
  "CHANGES_REQUESTED",
  "BLOCKED",
  "DONE",
];

export const TASK_STATUS_LABELS: Record<TaskStatusBucket, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  CHANGES_REQUESTED: "Changes requested",
  BLOCKED: "Blocked",
  DONE: "Done",
};

/** Normalise a raw status string into one of the six charted buckets. */
export function normaliseTaskStatus(status: string): TaskStatusBucket {
  if (status === "DONE" || status === "COMPLETED") return "DONE";
  if (
    status === "TODO" ||
    status === "IN_PROGRESS" ||
    status === "SUBMITTED" ||
    status === "CHANGES_REQUESTED" ||
    status === "BLOCKED"
  ) {
    return status;
  }
  return "TODO";
}

export function isTaskFinished(status: string): boolean {
  return status === "DONE" || status === "COMPLETED";
}

export interface TaskStatusSlice {
  bucket: TaskStatusBucket;
  label: string;
  count: number;
}

/** Counts per status bucket, always returning all six (even at zero). */
export function countByStatus(tasks: TaskLike[]): TaskStatusSlice[] {
  const counts = new Map<TaskStatusBucket, number>();
  for (const bucket of TASK_STATUS_ORDER) counts.set(bucket, 0);

  for (const task of tasks) {
    const bucket = normaliseTaskStatus(task.status);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  return TASK_STATUS_ORDER.map((bucket) => ({
    bucket,
    label: TASK_STATUS_LABELS[bucket],
    count: counts.get(bucket) ?? 0,
  }));
}

export function completionPercent(tasks: TaskLike[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => isTaskFinished(t.status)).length;
  return Math.round((done / tasks.length) * 100);
}

export function openTaskCount(tasks: TaskLike[]): number {
  return tasks.filter((t) => !isTaskFinished(t.status)).length;
}

export function blockedTaskCount(tasks: TaskLike[]): number {
  return tasks.filter((t) => t.status === "BLOCKED").length;
}

// ─── Due buckets ────────────────────────────────────────────────────────────

export type DueBucketKey = "overdue" | "today" | "week" | "completed";

export interface DueBucket {
  key: DueBucketKey;
  label: string;
  count: number;
}

export interface DueBuckets {
  buckets: DueBucket[];
  overdue: number;
  today: number;
  week: number;
  completed: number;
  activeTotal: number;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Buckets open tasks by due date, plus tasks completed in the last 7 days.
 * "Today" and "This week" are relative to the current local day.
 */
export function computeDueBuckets(tasks: TaskLike[], now: Date = new Date()): DueBuckets {
  const dayStart = startOfDay(now);
  const dayEnd = dayStart + 86_400_000;
  const weekEnd = dayStart + 7 * 86_400_000;

  let overdue = 0;
  let today = 0;
  let week = 0;
  let completed = 0;

  for (const task of tasks) {
    if (isTaskFinished(task.status)) {
      if (
        task.completedAt &&
        now.getTime() - new Date(task.completedAt).getTime() < 7 * 86_400_000
      ) {
        completed += 1;
      }
      continue;
    }

    if (!task.dueDate) continue;
    const due = new Date(task.dueDate).getTime();
    if (Number.isNaN(due)) continue;

    if (due < dayStart) overdue += 1;
    else if (due < dayEnd) today += 1;
    else if (due < weekEnd) week += 1;
  }

  return {
    buckets: [
      { key: "overdue", label: "Overdue", count: overdue },
      { key: "today", label: "Due today", count: today },
      { key: "week", label: "Due this week", count: week },
      { key: "completed", label: "Completed (7d)", count: completed },
    ],
    overdue,
    today,
    week,
    completed,
    activeTotal: overdue + today + week,
  };
}

// ─── Milestones ─────────────────────────────────────────────────────────────

export interface MilestoneProgress {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
  totalTasks: number;
  doneTasks: number;
  percent: number;
  isOverdue: boolean;
  wasExtended: boolean;
  departmentId: string | null;
}

/**
 * Per-milestone task completion. A milestone with no tasks falls back to its
 * own status (ACHIEVED -> 100%, otherwise 0).
 */
export function computeMilestoneProgress(
  milestones: MilestoneLike[],
  now: Date = new Date()
): MilestoneProgress[] {
  return milestones.map((m) => {
    const tasks = m.tasks ?? [];
    const doneTasks = tasks.filter((t) => isTaskFinished(t.status)).length;
    const percent =
      tasks.length > 0
        ? Math.round((doneTasks / tasks.length) * 100)
        : m.status === "ACHIEVED"
          ? 100
          : 0;

    const isOverdue =
      m.status !== "ACHIEVED" &&
      !!m.dueDate &&
      new Date(m.dueDate).getTime() < now.getTime();

    return {
      id: m.id,
      title: m.title,
      dueDate: m.dueDate ?? null,
      status: m.status,
      totalTasks: tasks.length,
      doneTasks,
      percent,
      isOverdue,
      wasExtended: !!m.originalDueDate,
      departmentId: m.departmentId ?? null,
    };
  });
}

/** Milestones that are not yet achieved, overdue first, then by due date. */
export function sortMilestonesForDisplay(list: MilestoneProgress[]): MilestoneProgress[] {
  return [...list].sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return aDue - bDue;
  });
}

// ─── Workload ───────────────────────────────────────────────────────────────

export interface WorkloadRow {
  id: string;
  label: string;
  taskCount: number;
}

/**
 * Horizontal bar data for member workload. One series, one colour — the bars
 * are not coloured by value (that would double-encode the bar length).
 */
export function buildWorkloadRows(
  entries: { memberId: string; name: string; taskCount: number }[]
): WorkloadRow[] {
  return entries
    .filter((e) => e.taskCount > 0)
    .sort((a, b) => b.taskCount - a.taskCount)
    .map((e) => ({
      id: e.memberId,
      label: e.name,
      taskCount: e.taskCount,
    }));
}
