import type { CurrentPlanMeta } from "./store";
import type { MemberRole } from "@prisma/client";
export type PlanRole = "OWNER" | "ADMIN" | "CO_ADMIN" | "MANAGER" | "CO_MANAGER" | "MEMBER";
export type AccessLevel = "NONE" | "VIEW" | "MANAGE";

export interface PlanPermissions {
  // departments
  canAddDepartment: boolean;
  canEditDepartment: (deptId: string) => boolean;
  canDeleteDepartment: boolean;

  // phases
  canAddPhase: (deptId: string) => boolean;
  canEditPhase: (deptId: string) => boolean;
  canDeletePhase: boolean;

  // milestones
  canAddMilestone: boolean;
  canEditMilestone: boolean;
  canDeleteMilestone: boolean;

  // income / expenses
  canAddIncome: boolean;
  canEditIncome: boolean;
  canDeleteIncome: boolean;

  // any member can submit an expense request — approval is gated separately
  canAddExpense: boolean;
  canEditExpense: boolean;
  canDeleteExpense: boolean;

  // approve / reject / mark-paid — OWNER/ADMIN always, CO_ADMIN only if granted
  canApproveExpense: boolean;

  // members
  canInviteMember: boolean;
  canEditMember: boolean;
  canDeleteMember: boolean;

  // tasks
  canAddTask: (deptId?: string) => boolean;
  canEditTask: (deptId: string | null) => boolean;
  canDeleteTask: boolean;
  canCompleteTask: boolean;
  canSubmitTaskWork: (isAssignedToMe: boolean) => boolean;
  canApproveTaskSubmission: (deptId: string) => boolean;

  // document permissions
  canAddReport: boolean;
  canDeleteReport: boolean;

  // extension requests permissions
  canRequestTaskExtension: (deptId: string, isAssignedToMe: boolean) => boolean;
  canExtendMilestoneDirectly: () => boolean;
  canRequestMilestoneExtension: (deptId: string) => boolean;
  canViewExtensionRequests: (deptId: string) => boolean;
  canApproveExtensionRequests: (deptId: string) => boolean;

  // stall permissions
  canManageStalls: boolean;
  canManageTicketing: boolean;
  canCheckInAttendee: boolean;
  canManageTicketingQr: boolean;

  // hardware logistics
  canRequestHardware: boolean;
  canManageHardware: (deptId?: string | null) => boolean;
  canApproveHardwareRequest: (deptId?: string | null) => boolean;
  canDeleteHardware: boolean;

  canManagePlanSettings: boolean;
}

export function getPermissions(meta: CurrentPlanMeta | null): PlanPermissions {
  const role = (meta?.role ?? "MEMBER") as PlanRole;
  const scopedDeptIds = meta?.departmentIds ?? null;
  const rawPerms = meta?.permissions ?? null;

  const isOwnerOrAdmin = role === "OWNER" || role === "ADMIN";
  const isCoAdmin = role === "CO_ADMIN";
  const isManager = role === "MANAGER";
  const isCoManager = role === "CO_MANAGER";

  const inScope = (deptId: string) =>
    scopedDeptIds === null || scopedDeptIds.includes(deptId);

  const coAdminPerms = isCoAdmin ? (rawPerms as CoAdminPermissions | null) : null;
  const managerPerms = isManager ? (rawPerms as ManagerPermissions | null) : null;
  const coManagerPerms = isCoManager ? (rawPerms as CoManagerPermissions | null) : null;

  const ca = (key: keyof CoAdminPermissions, subKey?: string): boolean => {
    if (!coAdminPerms) return false;
    const val = coAdminPerms[key];

    if ((val as any) === "NONE") return false;

    if (subKey) {
      if (typeof val === "object" && val !== null) {
        return !!(val as Record<string, boolean>)[subKey];
      }
      return false;
    }

    return !!val;
  };

  const managerCan = (key: keyof ManagerPermissions, level: "VIEW" | "MANAGE"): boolean => {
    if (!managerPerms) return false;
    const val = managerPerms[key] as AccessLevel | boolean;
    if (level === "VIEW") return val === "VIEW" || val === "MANAGE";
    return val === "MANAGE";
  };

  const coManagerCan = (key: keyof CoManagerPermissions, level: "VIEW" | "MANAGE"): boolean => {
    if (!coManagerPerms) return false;
    const val = coManagerPerms[key] as AccessLevel;
    if (level === "VIEW") return val === "VIEW" || val === "MANAGE";
    return val === "MANAGE";
  };

  return {
    canAddDepartment: isOwnerOrAdmin || ca("departments", "edit"),
    canEditDepartment: (deptId) =>
      isOwnerOrAdmin ||
      ca("departments", "edit") ||
      (isManager && inScope(deptId)),
    canDeleteDepartment: isOwnerOrAdmin || ca("departments", "delete"),

    canAddPhase: (deptId) =>
      isOwnerOrAdmin ||
      ca("phases", "edit") ||
      ((isManager || isCoManager) && inScope(deptId)),
    canEditPhase: (deptId) =>
      isOwnerOrAdmin ||
      ca("phases", "edit") ||
      ((isManager || isCoManager) && inScope(deptId)),
    canDeletePhase: isOwnerOrAdmin || ca("phases", "delete"),

    canAddMilestone: isOwnerOrAdmin || isCoAdmin || isManager || isCoManager,
    canEditMilestone: isOwnerOrAdmin || isCoAdmin || isManager || isCoManager,
    canDeleteMilestone: isOwnerOrAdmin,

    canAddIncome:
      isOwnerOrAdmin ||
      ca("revenue", "create") ||
      (isManager && managerCan("revenue", "MANAGE")) ||
      (isCoManager && coManagerCan("revenue", "MANAGE")),
    canEditIncome:
      isOwnerOrAdmin ||
      ca("revenue", "edit") ||
      (isManager && managerCan("revenue", "MANAGE")) ||
      (isCoManager && coManagerCan("revenue", "MANAGE")),
    canDeleteIncome:
      isOwnerOrAdmin ||
      ca("revenue", "delete") ||
      (isManager && managerCan("revenue", "MANAGE")) ||
      (isCoManager && coManagerCan("revenue", "MANAGE")),

    // Any member of the plan can submit an expense request; "Add expense" is
    // really "request an expense", so every role gets it.
    canAddExpense:
      isOwnerOrAdmin ||
      ca("expenses", "create") ||
      (isManager && managerCan("expenses", "MANAGE")) ||
      (isCoManager && coManagerCan("expenses", "MANAGE")),

    canEditExpense:
      isOwnerOrAdmin ||
      ca("expenses", "edit") ||
      (isManager && managerCan("expenses", "MANAGE")) ||
      (isCoManager && coManagerCan("expenses", "MANAGE")),
    canDeleteExpense:
      isOwnerOrAdmin ||
      ca("expenses", "delete") ||
      (isManager && managerCan("expenses", "MANAGE")) ||
      (isCoManager && coManagerCan("expenses", "MANAGE")),
    // Deliberately narrower than edit/delete — only OWNER/ADMIN always,
    // CO_ADMIN only when explicitly granted the `approve` flag.
    canApproveExpense: isOwnerOrAdmin || ca("expenses", "approve"),

    canInviteMember: isOwnerOrAdmin || ca("members", "edit"),
    canEditMember: isOwnerOrAdmin || ca("members", "edit"),
    canDeleteMember: isOwnerOrAdmin || ca("members", "delete"),

    canAddTask: (deptId?: string): boolean =>
      isOwnerOrAdmin ||
      (isCoAdmin && coAdminPerms?.tasks?.create === true) ||
      (isManager && !!deptId && inScope(deptId)),

    canEditTask: (deptId: string | null): boolean =>
      isOwnerOrAdmin ||
      (isCoAdmin && coAdminPerms?.tasks?.edit === true) ||
      (isManager && deptId !== null && inScope(deptId)) ||
      (isCoManager && deptId !== null && inScope(deptId)),

    canDeleteTask: isOwnerOrAdmin || (isCoAdmin && coAdminPerms?.tasks?.delete === true),
    canCompleteTask: true,

    // any assignee can submit their own work for review, regardless of role
    canSubmitTaskWork: (isAssignedToMe) => isAssignedToMe === true,

    // Admin/Co-Admin/Manager always; Co-Manager only if explicitly granted
    canApproveTaskSubmission: (deptId) =>
      isOwnerOrAdmin ||
      isCoAdmin ||
      (isManager && inScope(deptId)) ||
      (isCoManager && inScope(deptId) && coManagerPerms?.canApproveTaskSubmissions === true),

    canAddReport:
      isOwnerOrAdmin ||
      ca("reports", "create") ||
      (isManager && managerCan("reports", "MANAGE")) ||
      (isCoManager && coManagerCan("reports", "MANAGE")),

    canDeleteReport:
      isOwnerOrAdmin ||
      ca("reports", "delete") ||
      (isManager && managerCan("reports", "MANAGE")) ||
      (isCoManager && coManagerCan("reports", "MANAGE")),

    canRequestTaskExtension: (deptId, isAssignedToMe) =>
      (role === "MEMBER" && isAssignedToMe) ||
      (isManager && inScope(deptId)) ||
      (isCoManager && inScope(deptId) && coManagerPerms?.canRequestExtension === true),

    // direct milestone extension — bypasses the request flow entirely.
    // Only OWNER/ADMIN, or a CO_ADMIN explicitly granted extensions.approve.
    canExtendMilestoneDirectly: () =>
      isOwnerOrAdmin || ca("extensions", "approve"),

    // request-based extension — managers/co-managers only (not members).
    // A missing/empty deptId means the milestone is plan-wide; managers are
    // always in-scope for those. Co-managers need canRequestExtension granted.
    canRequestMilestoneExtension: (deptId) => {
      const milestoneInScope = !deptId || inScope(deptId);
      return (
        (isManager && milestoneInScope) ||
        (isCoManager && milestoneInScope && coManagerPerms?.canRequestExtension === true)
      );
    },

    canViewExtensionRequests: (deptId) =>
      isOwnerOrAdmin || isCoAdmin || (isManager && inScope(deptId)),

    canApproveExtensionRequests: (deptId) =>
      isOwnerOrAdmin ||
      ca("extensions", "approve") ||
      (isManager && inScope(deptId) && managerPerms?.canApproveExtensionRequests === true),

    canManageStalls: isOwnerOrAdmin || isCoAdmin,
    canManageTicketing: isOwnerOrAdmin || isCoAdmin,
    canCheckInAttendee: isOwnerOrAdmin || isCoAdmin || isManager || isCoManager,
    canManageTicketingQr: isOwnerOrAdmin || isCoAdmin,

    // hardware logistics
    canRequestHardware: true, // every member of the plan can request

    canManageHardware: (deptId) =>
      isOwnerOrAdmin ||
      ca("hardware", "edit") ||
      (isManager && (!deptId || inScope(deptId)) && managerCan("hardware", "MANAGE")) ||
      (isCoManager && (!deptId || inScope(deptId)) && coManagerCan("hardware", "MANAGE")),

    canApproveHardwareRequest: (deptId) =>
      isOwnerOrAdmin ||
      ca("hardware", "approve") ||
      (isManager && (!deptId || inScope(deptId)) && managerPerms?.canApproveHardwareRequests === true) ||
      (isCoManager && (!deptId || inScope(deptId)) && coManagerPerms?.canApproveHardwareRequests === true),

    canDeleteHardware: isOwnerOrAdmin || ca("hardware", "delete"),

    canManagePlanSettings: isOwnerOrAdmin || (isCoAdmin && coAdminPerms?.planSettings?.edit === true),
  };
}

/**
 * Whether the requester themself (not an admin) can still edit/withdraw
 * their own expense request. Once it leaves PENDING_APPROVAL, only
 * canEditExpense/canDeleteExpense (admin-level) holders can touch it.
 */
export function canModifyOwnExpenseRequest(status: string): boolean {
  return status === "PENDING_APPROVAL";
}

export interface CoAdminPermissions {
  members: { edit: boolean; delete: boolean };
  departments: { edit: boolean; delete: boolean };
  phases: { edit: boolean; delete: boolean };
  tasks: { create: boolean; edit: boolean; delete: boolean };

  revenue: { create: boolean; edit: boolean; delete: boolean };
  expenses: { create: boolean; edit: boolean; delete: boolean; approve: boolean };
  reports: { create: boolean; edit: boolean; delete: boolean };
  hardware: { edit: boolean; delete: boolean; approve: boolean };
  extensions: { approve: boolean };
  canManagePermissions: boolean;
  planSettings: { edit: boolean };
}

export interface ManagerPermissions {
  revenue: AccessLevel;
  expenses: AccessLevel;
  reports: AccessLevel;
  canApproveExtensionRequests: boolean;
  canManageCoManagerPermissions: boolean;
  hardware: AccessLevel;
  canApproveHardwareRequests: boolean;
}

export interface CoManagerPermissions {
  revenue: AccessLevel;
  expenses: AccessLevel;
  reports: AccessLevel;
  canRequestExtension: boolean;
  canApproveTaskSubmissions: boolean;
  hardware: AccessLevel;
  canApproveHardwareRequests: boolean;
}

export const DEFAULT_CO_ADMIN_PERMISSIONS: CoAdminPermissions = {
  members: { edit: false, delete: false },
  departments: { edit: false, delete: false },
  phases: { edit: false, delete: false },
  tasks: { create: true, edit: false, delete: true },
  revenue: { create: false, edit: false, delete: false },
  expenses: { create: false, edit: false, delete: false, approve: false },
  reports: { create: false, edit: false, delete: false },
  hardware: { edit: false, delete: false, approve: false },
  extensions: { approve: false },
  canManagePermissions: false,
  planSettings: { edit: false },
};

export const DEFAULT_MANAGER_PERMISSIONS: ManagerPermissions = {
  revenue: "NONE",
  expenses: "NONE",
  reports: "NONE",
  canApproveExtensionRequests: false,
  canManageCoManagerPermissions: false,
  hardware: "NONE",
  canApproveHardwareRequests: false,
};

export const DEFAULT_CO_MANAGER_PERMISSIONS: CoManagerPermissions = {
  revenue: "NONE",
  expenses: "NONE",
  reports: "NONE",
  canRequestExtension: false,
  canApproveTaskSubmissions: false,
  hardware: "NONE",
  canApproveHardwareRequests: false,
};

type ActingMember = { role: MemberRole; permissions: CoAdminPermissions | ManagerPermissions | null };

export function canEditPermissionsOf(
  acting: ActingMember,
  targetRole: "CO_ADMIN" | "MANAGER" | "CO_MANAGER"
): boolean {
  if (acting.role === "ADMIN") return true;

  if (acting.role === "CO_ADMIN" && targetRole === "MANAGER") {
    return (acting.permissions as CoAdminPermissions | null)?.canManagePermissions === true;
  }

  if (acting.role === "MANAGER" && targetRole === "CO_MANAGER") {
    return (acting.permissions as ManagerPermissions | null)?.canManageCoManagerPermissions === true;
  }

  return false;
}

export function canAssignRole(actingRole: PlanRole, targetRole: PlanRole): boolean {
  if (targetRole === "ADMIN" || targetRole === "CO_ADMIN") {
    return actingRole === "OWNER" || actingRole === "ADMIN";
  }
  return true;
}