"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import { useSnackbar } from "@/lib/useSnackbar";
import {
  DEFAULT_CO_ADMIN_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
  DEFAULT_CO_MANAGER_PERMISSIONS,
  type CoAdminPermissions,
  type ManagerPermissions,
  type CoManagerPermissions,
  type AccessLevel,
} from "@/lib/permissions";
import type { TeamMember } from "@/lib/types";
import { ShieldAlert, Users, LayoutTemplate, Wallet, FileText, KeyRound, CalendarClock, HardHat } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
  planId: string;
  onSaved: (updatedMember: any) => void;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function SwitchRow({
  label,
  checked,
  onCheckedChange,
  description,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function AccessSelect({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: AccessLevel;
  onChange: (v: AccessLevel) => void;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <Select value={value} onValueChange={(v) => onChange(v as AccessLevel)}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NONE">None</SelectItem>
          <SelectItem value="VIEW">View</SelectItem>
          <SelectItem value="MANAGE">Manage</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function PermissionsDialog({ open, onOpenChange, member, planId, onSaved }: Props) {
  const { show } = useSnackbar();
  const [saving, setSaving] = useState(false);
  const role = member.role as string;

  const [coAdminPerms, setCoAdminPerms] = useState<CoAdminPermissions>(
    () => ({ ...DEFAULT_CO_ADMIN_PERMISSIONS, ...(member.permissions as any) })
  );
  const [managerPerms, setManagerPerms] = useState<ManagerPermissions>(
    () => ({ ...DEFAULT_MANAGER_PERMISSIONS, ...(member.permissions as any) })
  );
  const [coManagerPerms, setCoManagerPerms] = useState<CoManagerPermissions>(
    () => ({ ...DEFAULT_CO_MANAGER_PERMISSIONS, ...(member.permissions as any) })
  );

  useEffect(() => {
    if (!open) return;
    setCoAdminPerms({ ...DEFAULT_CO_ADMIN_PERMISSIONS, ...(member.permissions as any) });
    setManagerPerms({ ...DEFAULT_MANAGER_PERMISSIONS, ...(member.permissions as any) });
    setCoManagerPerms({ ...DEFAULT_CO_MANAGER_PERMISSIONS, ...(member.permissions as any) });
  }, [open, member]);

  const handleSave = async () => {
    const payload =
      role === "CO_ADMIN"
        ? coAdminPerms
        : role === "MANAGER"
          ? managerPerms
          : coManagerPerms;

    try {
      setSaving(true);
      const res = await authClient.request(
        `/api/plan/${planId}/members/${member.id}/permissions`,
        { method: "PATCH", data: { permissions: payload } }
      );
      onSaved(res.data.data);
      show("Permissions saved", "success");
      onOpenChange(false);
    } catch (err: any) {
      show(err?.response?.data?.error || "Failed to save permissions", "error");
    } finally {
      setSaving(false);
    }
  };

  const memberName = member.user?.name || member.user?.email || "Member";

  const isConfigurable = ["CO_ADMIN", "MANAGER", "CO_MANAGER"].includes(role);
  const defaultTab = role === "CO_ADMIN" ? "members" : "financials";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl w-[95vw] md:w-full max-h-[85vh] overflow-y-auto p-0 gap-0">
        <div className="p-6 border-b border-border bg-muted/20">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Manage Permissions
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Configuring access for <span className="font-semibold text-foreground">{memberName}</span> ({role})
            </p>
          </DialogHeader>
        </div>

        {!isConfigurable ? (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Permissions for the <strong>{role}</strong> role are predefined and cannot be customized.
            </p>
          </div>
        ) : (
          <Tabs defaultValue={defaultTab} className="flex flex-col md:flex-row min-h-[400px]">
            {/* Sidebar Tabs */}
            <div className="w-full md:w-48 shrink-0 border-r border-border bg-muted/10 p-4">
              <TabsList className="flex flex-col h-auto w-full bg-transparent p-0 gap-1 items-stretch">
                {role === "CO_ADMIN" && (
                  <>
                    <TabsTrigger value="members" className="justify-start px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      <Users className="h-4 w-4 mr-2" /> Members
                    </TabsTrigger>
                    <TabsTrigger value="structure" className="justify-start px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      <LayoutTemplate className="h-4 w-4 mr-2" /> Structure
                    </TabsTrigger>
                  </>
                )}

                <TabsTrigger value="financials" className="justify-start px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Wallet className="h-4 w-4 mr-2" /> Financials
                </TabsTrigger>

                <TabsTrigger value="reports" className="justify-start px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <FileText className="h-4 w-4 mr-2" /> Reports
                </TabsTrigger>

                <TabsTrigger value="extensions" className="justify-start px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <CalendarClock className="h-4 w-4 mr-2" /> Extensions
                </TabsTrigger>

                <TabsTrigger value="hardware" className="justify-start px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <HardHat className="h-4 w-4 mr-2" /> Hardware
                </TabsTrigger>

                {(role === "CO_ADMIN" || role === "MANAGER") && (
                  <TabsTrigger value="access" className="justify-start px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <KeyRound className="h-4 w-4 mr-2" /> Access
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 overflow-y-auto">

              {/* MEMBERS TAB */}
              {role === "CO_ADMIN" && (
                <TabsContent value="members" className="mt-0 divide-y divide-border">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Member Management</h3>
                    <p className="text-xs text-muted-foreground">Control who can join and manage the team.</p>
                  </div>
                  <SwitchRow
                    label="Edit members"
                    description="Can change member roles and assign departments"
                    checked={coAdminPerms.members.edit}
                    onCheckedChange={(v) =>
                      setCoAdminPerms((p) => ({ ...p, members: { ...p.members, edit: v } }))
                    }
                  />
                  <SwitchRow
                    label="Delete members"
                    description="Can remove members from the plan entirely"
                    checked={coAdminPerms.members.delete}
                    onCheckedChange={(v) =>
                      setCoAdminPerms((p) => ({ ...p, members: { ...p.members, delete: v } }))
                    }
                  />
                </TabsContent>
              )}

              {/* STRUCTURE TAB */}
              {role === "CO_ADMIN" && (
                <TabsContent value="structure" className="mt-0 divide-y divide-border">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Project Structure</h3>
                    <p className="text-xs text-muted-foreground">Manage departments and phases/modules.</p>
                  </div>
                  <SwitchRow
                    label="Edit departments"
                    description="Can create and rename departments"
                    checked={coAdminPerms.departments.edit}
                    onCheckedChange={(v) =>
                      setCoAdminPerms((p) => ({ ...p, departments: { ...p.departments, edit: v } }))
                    }
                  />
                  <SwitchRow
                    label="Delete departments"
                    checked={coAdminPerms.departments.delete}
                    onCheckedChange={(v) =>
                      setCoAdminPerms((p) => ({ ...p, departments: { ...p.departments, delete: v } }))
                    }
                  />
                  <SwitchRow
                    label="Edit phases"
                    description="Can create and edit modules/phases"
                    checked={coAdminPerms.phases.edit}
                    onCheckedChange={(v) =>
                      setCoAdminPerms((p) => ({ ...p, phases: { ...p.phases, edit: v } }))
                    }
                  />
                  <SwitchRow
                    label="Delete phases"
                    checked={coAdminPerms.phases.delete}
                    onCheckedChange={(v) =>
                      setCoAdminPerms((p) => ({ ...p, phases: { ...p.phases, delete: v } }))
                    }
                  />
                  <SwitchRow
                    label="Add tasks"
                    description="Can create new tasks across all departments"
                    checked={coAdminPerms.tasks.create}
                    onCheckedChange={(v) =>
                      setCoAdminPerms((p) => ({ ...p, tasks: { ...p.tasks, create: v } }))
                    }
                  />
                  <SwitchRow
                    label="Edit tasks"
                    description="Can edit task details (title, description, due date) across all departments"
                    checked={coAdminPerms.tasks.edit}
                    onCheckedChange={(v) =>
                      setCoAdminPerms((p) => ({ ...p, tasks: { ...p.tasks, edit: v } }))
                    }
                  />
                  <SwitchRow
                    label="Delete tasks"
                    description="Can delete tasks across all departments"
                    checked={coAdminPerms.tasks.delete}
                    onCheckedChange={(v) =>
                      setCoAdminPerms((p) => ({ ...p, tasks: { ...p.tasks, delete: v } }))
                    }
                  />
                </TabsContent>
              )}

              {/* FINANCIALS TAB */}
              <TabsContent value="financials" className="mt-0 divide-y divide-border">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Financial Access</h3>
                  <p className="text-xs text-muted-foreground">Manage revenue, income, and expenses.</p>
                </div>

                {role === "CO_ADMIN" ? (
                  <>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider py-2 mt-2">Revenue</h4>
                    <SwitchRow label="Create revenue" checked={coAdminPerms.revenue.create} onCheckedChange={(v) => setCoAdminPerms((p) => ({ ...p, revenue: { ...p.revenue, create: v } }))} />
                    <SwitchRow label="Edit revenue" checked={coAdminPerms.revenue.edit} onCheckedChange={(v) => setCoAdminPerms((p) => ({ ...p, revenue: { ...p.revenue, edit: v } }))} />
                    <SwitchRow label="Delete revenue" checked={coAdminPerms.revenue.delete} onCheckedChange={(v) => setCoAdminPerms((p) => ({ ...p, revenue: { ...p.revenue, delete: v } }))} />

                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider py-2 mt-4 border-t">Expenses</h4>
                    <SwitchRow label="Create expenses" checked={coAdminPerms.expenses.create} onCheckedChange={(v) => setCoAdminPerms((p) => ({ ...p, expenses: { ...p.expenses, create: v } }))} />
                    <SwitchRow label="Edit expenses" checked={coAdminPerms.expenses.edit} onCheckedChange={(v) => setCoAdminPerms((p) => ({ ...p, expenses: { ...p.expenses, edit: v } }))} />
                    <SwitchRow label="Delete expenses" checked={coAdminPerms.expenses.delete} onCheckedChange={(v) => setCoAdminPerms((p) => ({ ...p, expenses: { ...p.expenses, delete: v } }))} />
                    <SwitchRow label="Approve/Reject expenses" description="Can review and approve/reject expense requests" checked={coAdminPerms.expenses.approve} onCheckedChange={(v) => setCoAdminPerms((p) => ({ ...p, expenses: { ...p.expenses, approve: v } }))} />
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-4 bg-muted/40 p-3 rounded-md border border-border">
                      Access applies to this member's assigned departments only.
                    </p>
                    <AccessSelect
                      label="Revenue access"
                      value={role === "MANAGER" ? managerPerms.revenue : coManagerPerms.revenue}
                      onChange={(v) => role === "MANAGER" ? setManagerPerms((p) => ({ ...p, revenue: v })) : setCoManagerPerms((p) => ({ ...p, revenue: v }))}
                    />
                    <AccessSelect
                      label="Expenses access"
                      value={role === "MANAGER" ? managerPerms.expenses : coManagerPerms.expenses}
                      onChange={(v) => role === "MANAGER" ? setManagerPerms((p) => ({ ...p, expenses: v })) : setCoManagerPerms((p) => ({ ...p, expenses: v }))}
                    />
                  </>
                )}
              </TabsContent>

              {/* REPORTS TAB */}
              <TabsContent value="reports" className="mt-0 divide-y divide-border">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Reports & Documents</h3>
                  <p className="text-xs text-muted-foreground">Access to project files and generated reports.</p>
                </div>

                {role === "CO_ADMIN" ? (
                  <>
                    <SwitchRow label="Create reports/docs" checked={coAdminPerms.reports.create} onCheckedChange={(v) => setCoAdminPerms((p) => ({ ...p, reports: { ...p.reports, create: v } }))} />
                    <SwitchRow label="Edit reports/docs" checked={coAdminPerms.reports.edit} onCheckedChange={(v) => setCoAdminPerms((p) => ({ ...p, reports: { ...p.reports, edit: v } }))} />
                    <SwitchRow label="Delete reports/docs" checked={coAdminPerms.reports.delete} onCheckedChange={(v) => setCoAdminPerms((p) => ({ ...p, reports: { ...p.reports, delete: v } }))} />
                  </>
                ) : (
                  <>
                    <AccessSelect
                      label="Reports & docs access"
                      value={role === "MANAGER" ? managerPerms.reports : coManagerPerms.reports}
                      onChange={(v) => role === "MANAGER" ? setManagerPerms((p) => ({ ...p, reports: v })) : setCoManagerPerms((p) => ({ ...p, reports: v }))}
                    />
                  </>
                )}
              </TabsContent>

              {/* EXTENSIONS TAB */}
              <TabsContent value="extensions" className="mt-0 divide-y divide-border">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Extension Requests</h3>
                  <p className="text-xs text-muted-foreground">Manage permissions for task and milestone extensions.</p>
                </div>

                {role === "CO_ADMIN" && (
                  <SwitchRow
                    label="Approve Extensions"
                    description="Can review and approve/reject extension requests"
                    checked={coAdminPerms.extensions?.approve || false}
                    onCheckedChange={(v) =>
                      setCoAdminPerms((p) => ({ ...p, extensions: { ...p.extensions, approve: v } }))
                    }
                  />
                )}

                {role === "MANAGER" && (
                  <SwitchRow
                    label="Approve Extensions"
                    description="Can review and approve/reject extension requests for their assigned departments"
                    checked={managerPerms.canApproveExtensionRequests || false}
                    onCheckedChange={(v) =>
                      setManagerPerms((p) => ({ ...p, canApproveExtensionRequests: v }))
                    }
                  />
                )}

                {role === "CO_MANAGER" && (
                  <SwitchRow
                    label="Request Extensions"
                    description="Can request extensions for tasks and milestones in their assigned departments"
                    checked={coManagerPerms.canRequestExtension || false}
                    onCheckedChange={(v) =>
                      setCoManagerPerms((p) => ({ ...p, canRequestExtension: v }))
                    }
                  />
                )}

                {role === "CO_MANAGER" && (
                  <SwitchRow
                    label="Approve task submissions"
                    description="Can review and approve/reject task submissions in their assigned departments"
                    checked={coManagerPerms.canApproveTaskSubmissions || false}
                    onCheckedChange={(v) =>
                      setCoManagerPerms((p) => ({ ...p, canApproveTaskSubmissions: v }))
                    }
                  />
                )}
              </TabsContent>

              {/* HARDWARE TAB */}
              <TabsContent value="hardware" className="mt-0 divide-y divide-border">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Hardware Logistics</h3>
                  <p className="text-xs text-muted-foreground">Manage hardware items, rentals, and requests.</p>
                </div>

                {role === "CO_ADMIN" ? (
                  <>
                    <SwitchRow
                      label="Edit hardware"
                      description="Can add and update hardware items"
                      checked={coAdminPerms.hardware.edit}
                      onCheckedChange={(v) =>
                        setCoAdminPerms((p) => ({ ...p, hardware: { ...p.hardware, edit: v } }))
                      }
                    />
                    <SwitchRow
                      label="Delete hardware"
                      checked={coAdminPerms.hardware.delete}
                      onCheckedChange={(v) =>
                        setCoAdminPerms((p) => ({ ...p, hardware: { ...p.hardware, delete: v } }))
                      }
                    />
                    <SwitchRow
                      label="Approve hardware requests"
                      description="Can approve or decline hardware requests"
                      checked={coAdminPerms.hardware.approve}
                      onCheckedChange={(v) =>
                        setCoAdminPerms((p) => ({ ...p, hardware: { ...p.hardware, approve: v } }))
                      }
                    />
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-4 bg-muted/40 p-3 rounded-md border border-border">
                      Access applies to this member's assigned departments only.
                    </p>
                    <AccessSelect
                      label="Hardware access"
                      value={role === "MANAGER" ? managerPerms.hardware : coManagerPerms.hardware}
                      onChange={(v) =>
                        role === "MANAGER"
                          ? setManagerPerms((p) => ({ ...p, hardware: v }))
                          : setCoManagerPerms((p) => ({ ...p, hardware: v }))
                      }
                    />
                    <SwitchRow
                      label="Approve hardware requests"
                      description="Can approve or decline hardware requests for their assigned departments"
                      checked={role === "MANAGER" ? managerPerms.canApproveHardwareRequests : coManagerPerms.canApproveHardwareRequests}
                      onCheckedChange={(v) =>
                        role === "MANAGER"
                          ? setManagerPerms((p) => ({ ...p, canApproveHardwareRequests: v }))
                          : setCoManagerPerms((p) => ({ ...p, canApproveHardwareRequests: v }))
                      }
                    />
                  </>
                )}
              </TabsContent>

              {/* ACCESS TAB */}
              {(role === "CO_ADMIN" || role === "MANAGER") && (
                <TabsContent value="access" className="mt-0 divide-y divide-border">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Delegation Settings</h3>
                    <p className="text-xs text-muted-foreground">Allow this user to configure permissions for subordinates.</p>
                  </div>

                  {role === "CO_ADMIN" && (
                    <SwitchRow
                      label="Manage Manager Permissions"
                      description="Allows this co-admin to configure permissions for managers"
                      checked={coAdminPerms.canManagePermissions}
                      onCheckedChange={(v) =>
                        setCoAdminPerms((p) => ({ ...p, canManagePermissions: v }))
                      }
                    />
                  )}

                  {role === "CO_ADMIN" && (
                    <SwitchRow
                      label="Manage plan settings"
                      description="Can change plan-wide settings like multi-user editing"
                      checked={coAdminPerms.planSettings.edit}
                      onCheckedChange={(v) =>
                        setCoAdminPerms((p) => ({ ...p, planSettings: { edit: v } }))
                      }
                    />
                  )}

                  {role === "MANAGER" && (
                    <SwitchRow
                      label="Manage Co-Manager Permissions"
                      description="Allows this manager to configure permissions for co-managers in their department"
                      checked={managerPerms.canManageCoManagerPermissions}
                      onCheckedChange={(v) =>
                        setManagerPerms((p) => ({ ...p, canManageCoManagerPermissions: v }))
                      }
                    />
                  )}
                </TabsContent>
              )}

            </div>
          </Tabs>
        )}

        <div className="flex justify-end gap-3 p-4 border-t border-border bg-card">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer hover:text-gray-600">
            Cancel
          </Button>
          {isConfigurable && (
            <Button onClick={handleSave} disabled={saving} className="cursor-pointer hover:bg-green-600">
              {saving ? "Saving..." : "Save Permissions"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}