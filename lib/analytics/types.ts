// Shared types for the Overview analytics layer.
//
// These types describe the shape of the data that arrives from the API
// (or, in the case of client-side derivation, from the store). They are
// intentionally free of React and Prisma imports so the pure functions in
// this folder can be unit-tested in a plain node environment.

export type PlanType = "project" | "event";

export type FinancialStatus = "healthy" | "warning" | "risk" | "unset";

/** A task status, normalised to the six buckets we actually chart. */
export type TaskStatusBucket =
  | "TODO"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "CHANGES_REQUESTED"
  | "BLOCKED"
  | "DONE";

export interface TaskLike {
  id: string;
  title?: string;
  status: string;
  departmentId?: string | null;
  phaseId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  completedAt?: string | null;
  priority?: number;
}

export interface MilestoneLike {
  id: string;
  title: string;
  dueDate?: string | null;
  originalDueDate?: string | null;
  status: string;
  departmentId?: string | null;
  tasks?: { id: string; title?: string; status: string }[];
}

export interface DepartmentLike {
  id: string;
  name: string;
  budget?: number | null;
}

export interface ExpenseLike {
  id: string;
  amount: number;
  paidAmount?: number;
  status: string;
  paymentStatus?: string;
  category?: string;
  departmentId?: string | null;
  phaseId?: string | null;
  stallId?: string | null;
  occurredAt?: string | null;
  createdAt?: string | null;
}

export interface IncomeLike {
  id: string;
  amount?: number | null;
  receivedAmount?: number;
  type?: string;
  status?: string;
  departmentId?: string | null;
  phaseId?: string | null;
  stallId?: string | null;
  receivedAt?: string | null;
  createdAt?: string | null;
}

export interface WorkloadEntry {
  memberId: string;
  name: string;
  role: string;
  departmentId?: string | null;
  departmentName?: string | null;
  taskCount: number;
}

export interface AttendanceLike {
  id: string;
  name: string;
  email?: string | null;
  checkedIn: boolean;
  checkedInAt?: string | null;
  checkedInById?: string | null;
  bookingId?: string;
  ticketTypeId?: string;
}
