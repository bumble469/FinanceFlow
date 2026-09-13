"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useFinancialStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Role, Department } from "@/lib/types";
import { useEditLock } from "@/hooks/use-edit-lock";
import { EditingPresenceIndicator } from "@/components/shared/editing-presence-indicator";

type AllowedRole = Exclude<Role, "ADMIN">;

const ALL_ROLES: AllowedRole[] = [
  "CO_ADMIN",
  "MANAGER",
  "CO_MANAGER",
  "MEMBER",
];

interface TeamMember {
  id: string;
  name: string;
  role: AllowedRole;
  departmentIds: string[];
  monthlyCost?: number;
  departmentCostShares?: Record<string, number>;
}

interface Props {
  open: boolean;
  planId: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TeamMember) => void;
  initialData?: {
    id: string;
    name: string;
    email: string;
    role: AllowedRole;
    departmentIds: string[];
    monthlyCost?: number;
    departmentCostShares?: Record<string, number>;
  } | null;
}

type BudgetSnapshot = {
  durationMonths: number;
  durationKnown: boolean;
  totalBudget: number;
  totalCommitted: number;
  departments: { id: string; name: string; budget: number; committed: number }[];
};

export function AddEditMemberDialog({
  open,
  planId,
  onOpenChange,
  onSubmit,
  initialData,
}: Props) {
  const { departments } = useFinancialStore();

  const isEditMode = !!initialData;

  const [formData, setFormData] = useState({
    id: "",
    email: "",
    name: "",
    role: "" as AllowedRole | "",
    departmentIds: [] as string[],
    monthlyCost: "",
  });

  const [users, setUsers] = useState<any[]>([]);
  const [loadingUser, setLoadingUser] = useState(false);
  const [userSelected, setUserSelected] = useState(false);
  const [budgetSnapshot, setBudgetSnapshot] = useState<BudgetSnapshot | null>(null);
  const [departmentCostShares, setDepartmentCostShares] = useState<Record<string, string>>({});
  const { locked, lockedByName, otherEditors } = useEditLock("member", initialData?.id ?? null, open && isEditMode);

  useEffect(() => {
    if (!open) return;

    if (initialData) {
      setFormData({
        id: initialData.id,
        email: initialData.email,
        name: initialData.name,
        role: initialData.role,
        departmentIds: initialData.departmentIds,
        monthlyCost: initialData.monthlyCost?.toString() ?? "",
      });

      setUserSelected(true);
      setUsers([]);
    } else {
      resetForm();
    }
  }, [open, initialData]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await authClient.request(`/api/plan/${planId}/members/budget-snapshot`, {
          method: "GET",
          params: isEditMode && initialData ? { excludeMemberId: initialData.id } : undefined,
        });
        setBudgetSnapshot(res.data.data);
      } catch {
        setBudgetSnapshot(null);
      }
    })();
  }, [open, planId, isEditMode, initialData]);

  useEffect(() => {
    if (isEditMode) return;

    if (!formData.email.trim()) {
      setUsers([]);
      setUserSelected(false);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setLoadingUser(true);

        const res = await authClient.request("/api/users/by-email", {
          method: "GET",
          params: {
            email: formData.email,
            planId,
          },
        });

        setUsers(res.data || []);
      } catch {
        setUsers([]);
      } finally {
        setLoadingUser(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [formData.email, planId, isEditMode]);

  const handleSelectUser = (user: any) => {
    setFormData((prev) => ({
      ...prev,
      id: user.id,
      name: user.name || "",
      email: user.email,
    }));

    setUsers([]);
    setUserSelected(true);
  };

  function toggleDepartment(deptId: string) {
    setFormData((prev) => {
      const already = prev.departmentIds.includes(deptId);
      const next = already
        ? prev.departmentIds.filter((id) => id !== deptId)
        : [...prev.departmentIds, deptId];
      return { ...prev, departmentIds: next };
    });
    setDepartmentCostShares((prev) => {
      const { [deptId]: _, ...rest } = prev;
      return prev[deptId] !== undefined ? rest : { ...prev, [deptId]: "" };
    });
  }

  const resetForm = () => {
    setFormData({
      id: "",
      email: "",
      name: "",
      role: "",
      departmentIds: [],
      monthlyCost: "",
    });

    setUsers([]);
    setUserSelected(false);
  };

  function getBudgetError(): string | null {
    if (!budgetSnapshot) return null;
    const cost = Number(formData.monthlyCost);
    if (!cost || cost <= 0) return null;

    const committedByThis = cost * budgetSnapshot.durationMonths;
    const durationNote = budgetSnapshot.durationKnown
      ? `over ${budgetSnapshot.durationMonths} month(s)`
      : "(monthly only — plan has no defined duration)";

    if (formData.role === "CO_ADMIN") {
      if (budgetSnapshot.totalBudget <= 0) return null;
      const projected = budgetSnapshot.totalCommitted + committedByThis;
      if (projected > budgetSnapshot.totalBudget) {
        return `Exceeds total plan budget: ₹${projected.toLocaleString("en-IN")} committed vs ₹${budgetSnapshot.totalBudget.toLocaleString("en-IN")} ${durationNote}.`;
      }
      return null;
    }

    if (formData.departmentIds.length === 0) {
      if (budgetSnapshot.totalBudget <= 0) return null;
      const projected = budgetSnapshot.totalCommitted + committedByThis;
      if (projected > budgetSnapshot.totalBudget) {
        return `No department selected — exceeds total plan budget: ₹${projected.toLocaleString("en-IN")} vs ₹${budgetSnapshot.totalBudget.toLocaleString("en-IN")} ${durationNote}.`;
      }
      return null;
    }

    for (const deptId of formData.departmentIds) {
      const dept = budgetSnapshot.departments.find((d) => d.id === deptId);
      if (!dept || dept.budget <= 0) continue;
      const projected = dept.committed + committedByThis;
      if (projected > dept.budget) {
        return `"${dept.name}" budget exceeded: ₹${projected.toLocaleString("en-IN")} vs ₹${dept.budget.toLocaleString("en-IN")} ${durationNote}.`;
      }
    }

    return null;
  }

  const budgetError = getBudgetError();

  const handleSubmit = () => {
    if (!formData.id || !formData.role || locked) return;

    onSubmit({
      id: formData.id,
      name: formData.name,
      role: formData.role as AllowedRole,
      departmentIds: isEditMode ? formData.departmentIds : [],
      monthlyCost: isEditMode && formData.monthlyCost ? Number(formData.monthlyCost) : undefined,
      departmentCostShares: isEditMode && formData.departmentIds.length > 1
        ? Object.fromEntries(formData.departmentIds.map((id) => [id, Number(departmentCostShares[id] || 0)]))
        : undefined,
    });

    resetForm();
    onOpenChange(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const formatRole = (role: string) =>
    role
      .toLowerCase()
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("-");

  const showDepartments =
    isEditMode && formData.role && formData.role !== "CO_ADMIN";

  const showCost = isEditMode && !!formData.role;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {isEditMode ? "Edit Member" : "Invite Member"}
            </DialogTitle>
            <EditingPresenceIndicator editors={otherEditors} />
          </div>
        </DialogHeader>

        {locked && (
          <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
            Currently being edited by {lockedByName}.
          </div>
        )}

        <div className="space-y-4 pt-4">
          {/* Invite Mode */}
          {!isEditMode && (
            <div className="space-y-2 relative">
              <Label>Email</Label>
              <Input
                placeholder="Search user by email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
              />

              {loadingUser && (
                <p className="text-xs text-muted-foreground">
                  Searching...
                </p>
              )}

              {users.length > 0 && !userSelected && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="cursor-pointer px-3 py-2 hover:bg-accent text-sm"
                      onClick={() => handleSelectUser(user)}
                    >
                      {user.email}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({user.name || "No name"})
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {userSelected && (
                <>
                  <p className="text-xs text-green-600">
                    Selected: {formData.name}
                  </p>

                  <div className="space-y-2 mt-3">
                    <Label>Role</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(v) =>
                        setFormData((prev) => ({
                          ...prev,
                          role: v as AllowedRole,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {formatRole(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Edit Mode */}
          {isEditMode && (
            <>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      role: v as AllowedRole,
                      departmentIds: [],
                      monthlyCost: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {formatRole(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showDepartments && (
                <div className="space-y-2">
                  <Label>Departments</Label>

                  <div className="grid grid-cols-2 gap-2">
                    {departments.map((d: Department) => {
                      const selected = formData.departmentIds.includes(d.id);

                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleDepartment(d.id)}
                          className={`rounded border p-2 text-sm transition ${selected
                            ? "bg-primary text-white"
                            : "bg-background hover:bg-muted"
                            }`}
                        >
                          {d.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {showDepartments && formData.departmentIds.length > 1 && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <Label className="text-xs text-muted-foreground">
                    Split ₹{formData.monthlyCost || 0} across departments
                  </Label>
                  {formData.departmentIds.map((deptId) => {
                    const dept = departments.find((d) => d.id === deptId);
                    return (
                      <div key={deptId} className="flex items-center gap-2">
                        <span className="text-xs w-32 truncate">{dept?.name}</span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0"
                          value={departmentCostShares[deptId] ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;

                            if (value === "" || Number(value) >= 0) {
                              setDepartmentCostShares((prev) => ({
                                ...prev,
                                [deptId]: value,
                              }));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "-" || e.key === "e" || e.key === "E") {
                              e.preventDefault();
                            }
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                    );
                  })}
                  {(() => {
                    const sum = formData.departmentIds.reduce(
                      (s, id) => s + Number(departmentCostShares[id] || 0), 0
                    );
                    const total = Number(formData.monthlyCost || 0);
                    const mismatch = Math.abs(sum - total) > 0.01;
                    return (
                      <p className={cn("text-xs", mismatch ? "text-destructive" : "text-muted-foreground")}>
                        Allocated ₹{sum.toLocaleString("en-IN")} of ₹{total.toLocaleString("en-IN")}
                      </p>
                    );
                  })()}
                </div>
              )}

              {showCost && (
                <div className="space-y-2">
                  <Label>Monthly Cost (optional)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Enter monthly cost"
                    value={formData.monthlyCost}
                    onChange={(e) => {
                      const value = e.target.value;

                      if (value === "" || Number(value) >= 0) {
                        setFormData((prev) => ({
                          ...prev,
                          monthlyCost: value,
                        }));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e" || e.key === "E") {
                        e.preventDefault();
                      }
                    }}
                    className={budgetError ? "border-destructive" : ""}
                  />
                  {budgetError && (
                    <p className="text-xs text-destructive">{budgetError}</p>
                  )}
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              className="cursor-pointer hover:text-gray-600"
            >
              Cancel
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={!userSelected || !formData.role || !!budgetError || locked}
              className="cursor-pointer"
            >
              {isEditMode ? "Save Changes" : "Send Invitation"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}