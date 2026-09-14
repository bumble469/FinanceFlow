"use client";

import { useState, useEffect, useCallback } from "react";
import { useFinancialStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  DollarSign,
  RefreshCw,
  Search,
  Building2,
  ShieldCheck,
  Shield,
  UserCog,
  User,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Loader2,
  Check,
  Clock,
} from "lucide-react";
import type { TeamMember, ConnectionStatus } from "@/lib/types";
import { ROLES } from "@/lib/types";
import { getCurrencySymbol } from "@/lib/currency";
import { AddEditMemberDialog } from "./components/member-dialog";
import { authClient } from "@/lib/auth-client";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useSnackbar } from '@/lib/useSnackbar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PlanPermissions } from "@/lib/permissions";
import { PermissionsDialog } from "./components/permissions-dialog";
import { canEditPermissionsOf, type CoAdminPermissions, type ManagerPermissions } from "@/lib/permissions";

function formatCurrency(value: number | undefined, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol} ${(value ?? 0).toLocaleString("en-IN")}`;
}

function isMissingSetup(member: TeamMember): boolean {
  const missingCost = !member.monthlyCost || member.monthlyCost <= 0;
  const missingDept =
    member.role !== "CO_ADMIN" &&
    (!member.departmentMembers || member.departmentMembers.length === 0);
  return missingCost || missingDept;
}

function isMissingPermissions(member: TeamMember): boolean {
  if (!["CO_ADMIN", "MANAGER", "CO_MANAGER"].includes(member.role)) return false;
  const perms = member.permissions;
  if (!perms) return true;

  if (member.role === "CO_ADMIN") {
    const p = perms as any;
    return (
      !p.members?.edit && !p.members?.delete &&
      !p.departments?.edit && !p.departments?.delete &&
      !p.phases?.edit && !p.phases?.delete &&
      !p.revenue?.create && !p.revenue?.edit && !p.revenue?.delete &&
      !p.expenses?.create && !p.expenses?.edit && !p.expenses?.delete && !p.expenses?.approve &&
      !p.reports?.create && !p.reports?.edit && !p.reports?.delete &&
      !p.canManagePermissions
    );
  }

  const p = perms as any;
  const noAccess = (v: string | undefined) => !v || v === "NONE";
  const managerExtra = member.role === "MANAGER" ? !p.canManageCoManagerPermissions : true;
  return noAccess(p.revenue) && noAccess(p.expenses) && noAccess(p.reports) && managerExtra;
}

const ROLE_ICON: Record<string, typeof User> = {
  ADMIN: ShieldCheck,
  CO_ADMIN: Shield,
  MANAGER: UserCog,
  CO_MANAGER: UserCog,
  MEMBER: User,
};

const PAGE_SIZE = 10;

type Stats = {
  totalMembers: number;
  totalMonthlyCost: number;
  byDepartment: { id: string; name: string; count: number; cost: number }[];
  byRole: { role: string; count: number; cost: number }[];
};

export function TeamSection({ planId, permissions }: { planId: string; permissions: PlanPermissions }) {
  const {
    teamMembers,
    removeTeamMember,
    currency,
    currentUser,
    setTeamMembers,
    currentPlanMeta
  } = useFinancialStore();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const { show } = useSnackbar();
  const [permissionsMember, setPermissionsMember] = useState<TeamMember | null>(null);
  const [connectingUserId, setConnectingUserId] = useState<string | null>(null);
  const [connectConfirmMember, setConnectConfirmMember] = useState<TeamMember | null>(null);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    totalMonthlyCost: 0,
    byDepartment: [],
    byRole: [],
  });

  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("");

  // debounce the search box into `search`
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchTeamData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authClient.request(`/api/plan/${planId}/members`, {
        method: "GET",
        params: { search, page, pageSize: PAGE_SIZE },
      });
      setTeamMembers(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
      setTotalCount(res.data.pagination.total);
      setStats(res.data.stats);
      if (!selectedRole && res.data.stats.byRole.length > 0) {
        setSelectedRole(res.data.stats.byRole[0].role);
      }
      const activeDepts = (res.data.stats.byDepartment as Stats["byDepartment"]).filter((d) => d.count > 0);
      if (!selectedDept && activeDepts.length > 0) {
        setSelectedDept(activeDepts[0].id);
      }
    } catch (err) {
      console.error(err);
      show("Failed to fetch team members", "error");
    } finally {
      setLoading(false);
    }
  }, [planId, search, page]);

  useEffect(() => {
    fetchTeamData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, search, page]);

  const handleSubmit = async (data: {
    id: string;
    name: string;
    role: string;
    departmentIds: string[];
    monthlyCost?: number;
    departmentCostShares?: Record<string, number>;
  }) => {
    try {
      if (!editingMember) {
        await authClient.request(`/api/plan/${planId}/members/invitation`, {
          method: "POST",
          data: { invitedUserId: data.id, role: data.role },
        });
        show("User Invited", "success");
      } else {
        await authClient.request(`/api/plan/${planId}/members/${editingMember.id}`, {
          method: "PATCH",
          data: {
            role: data.role,
            departmentIds: data.departmentIds,
            monthlyCost: data.monthlyCost,
            departmentCostShares: data.departmentCostShares,
          },
        });
      }
      setIsAddOpen(false);
      setEditingMember(null);
      fetchTeamData();
      show("Member Updated", "success");
    } catch (err: any) {
      console.error(err);
      show(
        err?.response?.data?.error ||
        (editingMember ? "Failed to update member" : "Failed to send invitation"),
        "error"
      );
    }
  };
  const handleEdit = (member: TeamMember) => {
    setEditingMember(member);
    setIsAddOpen(true);
  };

  const confirmMemberDelete = async () => {
    if (!deletingMember) return;
    try {
      await authClient.request(`/api/plan/${planId}/members/${deletingMember.id}`, {
        method: "DELETE",
      });
      removeTeamMember(deletingMember.id);
      setDeletingMember(null);
      fetchTeamData();
    } catch (err: any) {
      console.error(err);
      show(err?.response?.data?.error || "Failed to delete member", "error");
    }
  };

  const handleConnect = async (member: TeamMember) => {
    setConnectingUserId(member.userId);
    try {
      const res = await authClient.request("/api/connections/request", {
        method: "POST",
        data: { targetUserId: member.userId },
      });
      const newStatus: ConnectionStatus = res.data.status === "ACCEPTED" ? "ACCEPTED" : "PENDING_SENT";
      setTeamMembers(
        teamMembers.map((m) =>
          m.userId === member.userId ? { ...m, connectionStatus: newStatus } : m
        )
      );
      show(
        newStatus === "ACCEPTED" ? "Connected!" : "Connection request sent",
        "success"
      );
    } catch (err: any) {
      show(err?.response?.data?.error || "Failed to send request", "error");
    } finally {
      setConnectingUserId(null);
    }
  };

  // Only show the Actions column if the viewer can do at least one action
  const canManageAnyPermissions =
    currentPlanMeta?.isOwner ||
    (currentPlanMeta?.role === "ADMIN") ||
    (currentPlanMeta?.role === "CO_ADMIN" &&
      !!(currentPlanMeta?.permissions as CoAdminPermissions | null)?.canManagePermissions) ||
    (currentPlanMeta?.role === "MANAGER" &&
      !!(currentPlanMeta?.permissions as ManagerPermissions | null)?.canManageCoManagerPermissions);

  const showActionsColumn = permissions.canEditMember || permissions.canDeleteMember || canManageAnyPermissions;
  const canSeeSetupBadges = permissions.canEditMember || canManageAnyPermissions;

  const selectedRoleStat = stats.byRole.find((r) => r.role === selectedRole);
  const SelectedRoleIcon = selectedRole ? ROLE_ICON[selectedRole] ?? User : User;

  const activeDepartments = stats.byDepartment.filter((d) => d.count > 0);
  const selectedDeptStat = stats.byDepartment.find((d) => d.id === selectedDept);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team & Roles</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your team members and their associated costs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {permissions.canInviteMember && (
            <Button
              className="cursor-pointer"
              onClick={() => {
                setEditingMember(null);
                setIsAddOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          )}

          <Button
            className="cursor-pointer"
            variant="outline"
            onClick={() => {
              fetchTeamData();
              show("Members Reloaded", "success");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reload
          </Button>

          {permissions.canInviteMember && (
            <AddEditMemberDialog
              open={isAddOpen}
              planId={planId}
              onOpenChange={(open) => {
                setIsAddOpen(open);
                if (!open) setEditingMember(null);
              }}
              onSubmit={handleSubmit}
              initialData={
                editingMember
                  ? {
                    id: editingMember.userId,
                    email: editingMember.user?.email ?? "",
                    name: editingMember.user?.name ?? "",
                    role: editingMember.role as any,
                    departmentIds:
                      editingMember.departmentMembers?.map(
                        (dm: any) => dm.departmentId
                      ) ?? [],
                    monthlyCost: editingMember.monthlyCost,
                  }
                  : null
              }
            />
          )}

          {permissions.canDeleteMember && (
            <ConfirmDeleteDialog
              open={!!deletingMember}
              type="member"
              setOpen={(open) => {
                if (!open) setDeletingMember(null);
              }}
              onConfirm={confirmMemberDelete}
            />
          )}
        </div>

        {permissionsMember && (
          <PermissionsDialog
            open={!!permissionsMember}
            onOpenChange={(open) => { if (!open) setPermissionsMember(null); }}
            member={permissionsMember}
            planId={planId}
            onSaved={(updated) => {
              setTeamMembers(
                teamMembers.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
              );
              setPermissionsMember(null);
            }}
          />
        )}
      </div>

      {/* Statistical cards — everything (totals, cost by dept, cost by role) lives up here now */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Members</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalMembers}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Monthly Cost</p>
              <p className="text-xl font-bold text-success">
                {formatCurrency(stats.totalMonthlyCost, currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Cost by department — dropdown selector */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Cost by Department</p>
            {activeDepartments.length > 0 ? (
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="h-7 w-[130px] text-xs">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {activeDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
          {activeDepartments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No department data</p>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <Building2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-m font-bold text-foreground">{formatCurrency(selectedDeptStat?.cost, currency)}/mo</p>
                <p className="text-xs text-muted-foreground">
                  {selectedDeptStat?.count ?? 0}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Members by role — dropdown selector */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Members by Role</p>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="h-7 w-[110px] text-xs">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {stats.byRole.map((r) => (
                  <SelectItem key={r.role} value={r.role}>{r.role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <SelectedRoleIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{selectedRoleStat?.count ?? 0}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(selectedRoleStat?.cost, currency)}/mo
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Member table — full width */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">All Members</h3>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Departments</TableHead>
                <TableHead className="text-right">Monthly Cost</TableHead>
                {showActionsColumn && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={showActionsColumn ? 5 : 4} className="text-center text-sm text-muted-foreground py-8">
                    Loading members...
                  </TableCell>
                </TableRow>
              ) : teamMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showActionsColumn ? 5 : 4} className="text-center text-sm text-muted-foreground py-8">
                    {search ? "No members match your search." : "No members yet."}
                  </TableCell>
                </TableRow>
              ) : (
                teamMembers.map((member) => {
                  const isSelf = member.userId === currentUser?.id;

                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{member.user?.name || "-"}</span>
                          {isSelf && (
                            <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                              You
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>{member.role}</TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {member.departmentMembers?.length ? (
                            member.departmentMembers.map((dm) => (
                              <span
                                key={dm.department.id}
                                className="rounded-full bg-secondary px-2 py-1 text-xs"
                              >
                                {dm.department?.name || "—"}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-mono">
                        {formatCurrency(member.monthlyCost || 0, currency)}
                      </TableCell>

                      {showActionsColumn && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {permissions.canEditMember && !isSelf && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEdit(member)}
                                className="relative cursor-pointer"
                                title={canSeeSetupBadges && isMissingSetup(member) ? "Missing monthly cost or department" : undefined}
                              >
                                <Pencil className="h-4 w-4" />
                                {canSeeSetupBadges && isMissingSetup(member) && (
                                  <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-yellow-500 text-[9px] font-bold text-white">
                                    !
                                  </span>
                                )}
                              </Button>
                            )}

                            {!isSelf &&
                              ["CO_ADMIN", "MANAGER", "CO_MANAGER"].includes(member.role) &&
                              (currentPlanMeta?.isOwner ||
                                (currentPlanMeta?.role &&
                                  canEditPermissionsOf(
                                    {
                                      role: currentPlanMeta.role as any,
                                      permissions: currentPlanMeta.permissions as CoAdminPermissions | ManagerPermissions | null,
                                    },
                                    member.role as "CO_ADMIN" | "MANAGER" | "CO_MANAGER"
                                  ))) && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setPermissionsMember(member)}
                                  className="relative cursor-pointer"
                                  title={isMissingPermissions(member) ? "No permissions granted yet" : "Manage permissions"}
                                >
                                  <Shield className="h-4 w-4" />
                                  {isMissingPermissions(member) && (
                                    <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-yellow-500 text-[9px] font-bold text-white">
                                      !
                                    </span>
                                  )}
                                </Button>
                              )}

                            {/* Connect icon — only for others, only when not already accepted */}
                            {!isSelf && member.connectionStatus !== "SELF" && (
                              member.connectionStatus === "ACCEPTED" ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  disabled
                                  title="Already connected"
                                  className="text-success cursor-default"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              ) : member.connectionStatus === "PENDING_SENT" ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  disabled
                                  title="Connection request sent — awaiting response"
                                  className="text-muted-foreground cursor-default"
                                >
                                  <Clock className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  disabled={connectingUserId === member.userId}
                                  onClick={() => setConnectConfirmMember(member)}
                                  className="cursor-pointer"
                                  title={
                                    member.connectionStatus === "PENDING_RECEIVED"
                                      ? "Accept connection request"
                                      : "Send connection request"
                                  }
                                >
                                  {connectingUserId === member.userId ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <UserPlus className="h-4 w-4" />
                                  )}
                                </Button>
                              )
                            )}

                            {permissions.canDeleteMember && !isSelf && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeletingMember(member)}
                                className="text-danger hover:text-danger cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-muted-foreground">
          <span>
            {totalCount === 0 ? "0 members" : `Showing ${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, totalCount)} of ${totalCount}`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs">Page {page} of {totalPages}</span>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Connect Confirmation Dialog */}
      <AlertDialog
        open={!!connectConfirmMember}
        onOpenChange={(open) => { if (!open) setConnectConfirmMember(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {connectConfirmMember?.connectionStatus === "PENDING_RECEIVED"
                ? "Accept Connection Request"
                : "Send Connection Request"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {connectConfirmMember?.connectionStatus === "PENDING_RECEIVED"
                ? `${connectConfirmMember?.user?.name ?? "This person"} has already sent you a request. Confirm to accept and connect.`
                : `Send a connection request to ${connectConfirmMember?.user?.name ?? "this person"}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="cursor-pointer hover:text-gray-600"
              onClick={() => setConnectConfirmMember(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              onClick={() => {
                if (connectConfirmMember) {
                  handleConnect(connectConfirmMember);
                  setConnectConfirmMember(null);
                }
              }}
            >
              {connectConfirmMember?.connectionStatus === "PENDING_RECEIVED" ? "Accept" : "Connect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}