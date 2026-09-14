// Financial Dashboard Types - Multi-Plan Architecture

// ============================================================
// ACCOUNT LEVEL
// ============================================================

export type AccountType = "individual" | "company";
export type PlanType = "project" | "event";
export type PlanStatus = "active" | "completed";
export const ROLES = [
  "ADMIN",
  "CO_ADMIN",
  "MANAGER",
  "CO_MANAGER",
  "MEMBER",
] as const;

export type Role = (typeof ROLES)[number];
export type PaymentMethod = "CASH" | "UPI";

export type HardwareCategory = "AV" | "FURNITURE" | "ELECTRICAL" | "STRUCTURAL" | "IT" | "OTHER";
export type HardwareSource = "OWNED" | "RENTED" | "BORROWED";
export type HardwareRequestStatus = "PENDING" | "APPROVED" | "DECLINED";
export type HardwareCondition = "WORKING" | "IN_USE" | "BROKEN_DOWN" | "PURCHASED" | "RETURNED" | "LOST";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  createdAt: Date;
  members?: string[];
}

export interface Plan {
  id: string;
  accountId: string;
  name: string;
  type: PlanType;
  status: PlanStatus;
  budget: number;
  spent: number;
  createdAt: Date;
  teamMembers: TeamMember[];
  project: any;
  event: any;
  expenses: Expense[];
  income: Income[];
  eventData?: EventData;
  simulation: SimulationModifiers;
  currency: string;
  description: string;
  mode: "project" | "event";
  hasHardware?: boolean;
}

// ============================================================
// PLAN CONTENT TYPES
// ============================================================

export type Mode = "project" | "event";

export type Department = {
  id: string;
  name: string;
  budget: number;
};

export interface Module {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  departmentId?: string;
}

type DepartmentMember = {
  department: {
    id: string;
    name: string;
  };
};

export type ConnectionStatus =
  | "NONE"
  | "SELF"
  | "ACCEPTED"
  | "PENDING_SENT"
  | "PENDING_RECEIVED";

export interface TeamMember {
  id: string;
  name: string;
  role: Role;
  user: any;
  userId: string;
  departmentMembers?: DepartmentMember[];
  permissions?: Record<string, any> | null;
  monthlyCost: number;
  departmentCostShares?: Record<string, number>;
  connectionStatus?: ConnectionStatus;
}

export type ExpenseStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED";

export type PaymentStatus =
  | "PENDING"
  | "PARTIAL"
  | "COMPLETED"
  | "OVERDUE";

export type IncomeStatus =
  | "EXPECTED"
  | "PARTIAL"
  | "RECEIVED"
  | "CANCELLED";

export type ExpenseCategory =
  | "SALARY"
  | "TOOLS"
  | "MARKETING"
  | "OPERATIONS"
  | "EVENT"
  | "EQUIPMENT"
  | "OTHER";

export type FinancialStatus = "healthy" | "warning" | "risk";

export type IncomeType =
  | "REVENUE"
  | "INVESTMENT"
  | "SPONSORSHIP"
  | "DONATION"
  | "GRANT"
  | "MERCHANDISE"
  | "REFUND"
  | "CLIENT_PAYMENT"
  | "STALL_INCOME"
  | "OTHER";

export interface Expense {
  id: string;

  workItemId: string;

  phaseId?: string;
  phaseName?: string;

  departmentId?: string;
  departmentName?: string;

  stallId?: string;
  hardwareItemId?: string;
  hardwareItemName?: string;

  category: ExpenseCategory;

  amount: number;
  paidAmount: number;

  status: ExpenseStatus;
  paymentStatus: PaymentStatus;

  requestedById?: string;
  requestedByName?: string;
  approvedById?: string;
  approvedByName?: string;
  rejectedById?: string;
  rejectedByName?: string;

  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;

  description?: string;

  occurredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Income {
  id: string;

  workItemId: string;

  phaseId?: string;
  phaseName?: string;

  departmentId?: string;
  departmentName?: string;

  stallId?: string;
  hardwareItemId?: string;

  type: IncomeType;

  amount: number;
  receivedAmount: number;

  status: IncomeStatus;
  paymentStatus: PaymentStatus;

  source?: string;
  description?: string;

  createdById?: string;
  createdByName?: string;

  receivedAt?: string;
  createdAt: string;
}

export interface EventData {
  estimatedAttendance: number;
  ticketPrice: number;
  expectedRevenue: number;
  eventBudget: number;
}

export interface SimulationModifiers {
  costMultiplier: number;
  additionalMembers: number;
  revenueAdjustment: number;
  isSimulating: boolean;
}

export interface FinancialMetrics {
  totalBudget: number;
  totalSpent: number;
  remainingBalance: number;
  estimatedProfitLoss: number;
}

// ================= MILESTONE =================

export type MilestoneStatus = "UPCOMING" | "IN_PROGRESS" | "ACHIEVED" | "MISSED";

export interface MilestoneTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority?: number;
  startDate?: string;
  dueDate?: string;
  originalDueDate?: string;
  extensionReason?: string;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  originalDueDate?: string;
  extensionReason?: string;
  status: MilestoneStatus;
  achievedAt?: string;
  departmentId?: string;
  tasks: MilestoneTask[];
}

export interface MilestoneFormData {
  title: string;
  description?: string;
  dueDate?: string;
  status: MilestoneStatus;
  departmentId?: string;
  phaseId?: string;
  taskIds: string[];
}

export type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "DONE"
  | "BLOCKED"
  | "SUBMITTED"
  | "CHANGES_REQUESTED"
  | "COMPLETED";

export interface TaskAssignee {
  id: string; // WorkItemMember id
  name: string | null;
  image: string | null;
}

export interface TaskMilestoneRef {
  id: string;
  title: string;
  status: MilestoneStatus;
  dueDate?: string;
}

export interface TaskRequirement {
  requireApproval: boolean;
  requireDescription: boolean;
  requireImages: boolean;
  minImages: number | null;
  maxImages: number | null;
  requireVideo: boolean;
  requireDocument: boolean;
  allowMultipleEvidenceTypes: boolean;
}

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: number;
  workItemId?: string;
  departmentId?: string;
  phaseId?: string;
  startDate?: string;
  dueDate?: string;
  originalDueDate?: string;
  extensionReason?: string;
  completedAt?: string;
  assignees?: TaskAssignee[];
  dependsOnIds?: string[];
  milestones?: TaskMilestoneRef[];
  requirement?: TaskRequirement | null;
  createdAt?: string;
  updatedAt?: string;
};

export interface ExtensionRequest {
  id: string;

  targetType: "TASK" | "MILESTONE";
  status: "PENDING" | "APPROVED" | "REJECTED";

  taskId?: string;
  milestoneId?: string;

  currentDueDate?: string;
  requestedDueDate: string;

  reason: string;

  reviewNote?: string;
  applyMode?: string;

  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;

  requestedBy: {
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      email: string;
      image?: string | null;
    };
  };

  reviewedBy?: {
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      email: string;
      image?: string | null;
    };
  } | null;

  task?: {
    id: string;
    title: string;
  } | null;

  milestone?: {
    id: string;
    title: string;
    dueDate?: string;
  } | null;

  department?: {
    id: string;
    name: string;
  } | null;
}

export interface StallMemberEntry {
  id: string; // StallMember.id
  userId: string;
  user: { id: string; name: string | null; email?: string; image?: string | null };
}

export interface Stall {
  id: string;
  workItemId: string;
  name: string;
  description?: string | null;
  members: StallMemberEntry[];
  _count?: { income: number; expenses: number };
  createdAt: string;
  updatedAt: string;
}

export interface TicketType {
  id: string;
  workItemId: string;
  name: string;
  price: number;
  capacity: number | null;
  salesStart?: string | null;
  salesEnd?: string | null;
  description?: string | null;
  isActive: boolean;
  _count?: { bookings: number };
}

export interface TicketAttendee {
  id: string;
  bookingId: string;
  name: string;
  email?: string | null;
  checkedIn: boolean;
  checkedInAt?: string | null;
  checkedInById?: string | null;
}

export interface TicketBooking {
  id: string;
  workItemId: string;
  ticketTypeId: string;
  bookedByName: string;
  bookedByEmail?: string | null;
  bookedByPhone?: string | null;
  quantity: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  status: "CONFIRMED" | "CANCELLED";
  bookingCode: string;
  ticketType?: { id: string; name: string; price: number };
  attendees: TicketAttendee[];
  createdAt: string;
}

export interface HardwareItem {
  id: string;
  workItemId: string;
  name: string;
  category: HardwareCategory;
  source: HardwareSource;
  quantity: number;
  vendor?: string | null;
  notes?: string | null;

  departmentId?: string | null;
  department?: { id: string; name: string } | null;
  stallId?: string | null;
  stall?: { id: string; name: string } | null;

  requestStatus: HardwareRequestStatus;
  requestedById: string;
  requestedBy?: { id: string; user: { id: string; name: string | null } };
  declineReason?: string | null;
  reviewedById?: string | null;
  reviewedBy?: { id: string; user: { id: string; name: string | null } } | null;
  reviewedAt?: string | null;

  condition?: HardwareCondition | null;

  rentalStart?: string | null;
  rentalEnd?: string | null;
  monthlyRentAmount?: number | null;
  lastBilledAt?: string | null;
  depositAmount?: number | null;
  depositReturned: boolean;

  createdAt: string;
  updatedAt: string;
}

// SUBSCRIPTION

export type SubscriptionPlanCode = "STARTER" | "BASIC" | "EMPLOYER" | "MANAGER";
export type BillingInterval = "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";
export type SubscriptionStatus = "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED" | "EXPIRED" | "PENDING";

export interface PlanPrice {
  id: string;
  planId: string;
  currency: string;
  billingInterval: BillingInterval;
  amount: number;
  isActive: boolean;
}

export interface SubscriptionPlan {
  id: string;
  code: SubscriptionPlanCode;
  name: string;
  description?: string | null;
  isActive: boolean;
  isPublic: boolean;
  maxProjects: number | null;
  maxEvents: number | null;
  maxTotalWorkItems: number | null;
  maxMembersPerWorkItem: number | null;
  maxStorageBytes: string | null;
  maxDepartments: number | null;
  maxTasksPerWorkItem: number | null;
  features: Record<string, boolean> | null;
  prices: PlanPrice[];
}

export interface AccountSubscription {
  id: string;
  accountId: string;
  planId: string;
  plan: SubscriptionPlan;
  priceId: string;
  price: PlanPrice;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currency: string;
  amount: number;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}