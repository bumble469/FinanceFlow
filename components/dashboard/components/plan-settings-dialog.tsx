"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sun,
  Moon,
  Monitor,
  Settings as SettingsIcon,
  Lock,
  Bell,
  Users,
  Palette,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useFinancialStore } from "@/lib/store";
import { getPermissions } from "@/lib/permissions";
import { useSnackbar } from "@/lib/useSnackbar";
import { cn } from "@/lib/utils";

interface PlanSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
}

type SectionKey =
  | "general"
  | "notifications"
  | "collaboration"
  | "members"
  | "finance"
  | "appearance"
  | "danger";

const titleCase = (s?: string | null) =>
  (s ?? "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

// ─── small building blocks ────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6 border-b border-border pb-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function SettingRow({
  title,
  description,
  locked,
  comingSoon,
  children,
}: {
  title: string;
  description?: string;
  locked?: boolean;
  comingSoon?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 rounded-lg border border-border px-4 py-3.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Label>{title}</Label>
          {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
          {comingSoon && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              Coming soon
            </Badge>
          )}
        </div>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className={cn("shrink-0", comingSoon && "pointer-events-none opacity-50")}>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

// ─── dialog ───────────────────────────────────────────────────────────────────

export function PlanSettingsDialog({ open, onOpenChange, planId }: PlanSettingsDialogProps) {
  const router = useRouter();
  const { show } = useSnackbar();
  const { theme, setTheme } = useTheme();
  const { currentPlanMeta, setCurrentPlanMeta, removePlan, currency, budget } = useFinancialStore();
  const perms = getPermissions(currentPlanMeta);

  const isOwner = !!currentPlanMeta?.isOwner;
  const financeOn = currentPlanMeta?.financeEnabled !== false;

  const [section, setSection] = useState<SectionKey>("general");

  // general
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [savingGeneral, setSavingGeneral] = useState(false);

  // notifications
  const [receivingEmails, setReceivingEmails] = useState(true);
  const [loadingEmailPref, setLoadingEmailPref] = useState(true);
  const [savingEmailPref, setSavingEmailPref] = useState(false);

  // collaboration
  const [allowMultipleEditing, setAllowMultipleEditing] = useState(
    currentPlanMeta?.allowMultipleEditing ?? true
  );
  const [savingEditingPref, setSavingEditingPref] = useState(false);

  // danger zone
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // reset each time the dialog opens
  useEffect(() => {
    if (!open) return;
    setSection("general");
    setName(currentPlanMeta?.name ?? "");
    setDescription(currentPlanMeta?.description ?? "");
    setConfirmText("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !planId) return;
    setLoadingEmailPref(true);
    authClient
      .request(`/api/plan/${planId}/email-preference`)
      .then((res) => setReceivingEmails(res.data.receiving))
      .catch((err) => console.error("Failed to fetch email preference:", err))
      .finally(() => setLoadingEmailPref(false));
  }, [open, planId]);

  useEffect(() => {
    setAllowMultipleEditing(currentPlanMeta?.allowMultipleEditing ?? true);
  }, [currentPlanMeta?.allowMultipleEditing]);

  // ── handlers ────────────────────────────────────────────────────────────────

  const generalDirty =
    name.trim() !== (currentPlanMeta?.name ?? "") ||
    description.trim() !== (currentPlanMeta?.description ?? "");

  const handleSaveGeneral = async () => {
    if (!currentPlanMeta || !isOwner || !name.trim()) return;
    setSavingGeneral(true);
    try {
      await authClient.request(`/api/plan/${planId}`, {
        method: "PATCH",
        data: { name: name.trim(), description: description.trim() },
      });
      setCurrentPlanMeta({
        ...currentPlanMeta,
        name: name.trim(),
        description: description.trim() || null,
      });
      show("Plan details saved", "success");
    } catch (err: any) {
      show(err?.response?.data?.error || "Failed to save plan details", "error");
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleEmailToggle = async (value: boolean) => {
    setReceivingEmails(value);
    setSavingEmailPref(true);
    try {
      await authClient.request(`/api/plan/${planId}/email-preference`, {
        method: "PATCH",
        data: { receiving: value },
      });
    } catch (err) {
      console.error("Failed to update email preference:", err);
      setReceivingEmails(!value);
    } finally {
      setSavingEmailPref(false);
    }
  };

  const handleEditingToggle = async (value: boolean) => {
    if (!perms.canManagePlanSettings) return;
    setAllowMultipleEditing(value);
    setSavingEditingPref(true);
    try {
      await authClient.request(`/api/plan/${planId}`, {
        method: "PATCH",
        data: { allowMultipleEditing: value },
      });
      if (currentPlanMeta) {
        setCurrentPlanMeta({ ...currentPlanMeta, allowMultipleEditing: value });
      }
    } catch (err) {
      console.error("Failed to update editing preference:", err);
      setAllowMultipleEditing(!value);
    } finally {
      setSavingEditingPref(false);
    }
  };

  const handleDelete = async () => {
    if (!isOwner || confirmText !== currentPlanMeta?.name) return;
    setDeleting(true);
    try {
      await authClient.request(`/api/plan/${planId}`, { method: "DELETE" });
      removePlan(planId);
      onOpenChange(false);
      router.push("/plans");
    } catch (err: any) {
      show(err?.response?.data?.error || "Failed to delete plan", "error");
      setDeleting(false);
    }
  };

  // ── nav ─────────────────────────────────────────────────────────────────────

  const nav: { key: SectionKey; label: string; icon: LucideIcon; danger?: boolean }[] = [
    { key: "general", label: "General", icon: SettingsIcon },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "collaboration", label: "Collaboration", icon: Users },
    { key: "members", label: "Members & Roles", icon: ShieldCheck },
    ...(financeOn ? [{ key: "finance" as SectionKey, label: "Finance", icon: Wallet }] : []),
    { key: "appearance", label: "Appearance", icon: Palette },
    ...(isOwner
      ? [{ key: "danger" as SectionKey, label: "Danger zone", icon: AlertTriangle, danger: true }]
      : []),
  ];

  const money = (v?: number | null) =>
    new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(Number(v ?? 0));

  const eventDate = currentPlanMeta?.eventDate
    ? new Date(currentPlanMeta.eventDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:h-[80vh] sm:max-h-[780px] sm:max-w-[1000px]">
        {/* header */}
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Plan settings
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 truncate">
            <span className="truncate">
              {currentPlanMeta?.name ?? "This plan"}
            </span>

            <span className="shrink-0 rounded-md bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
              Under Work
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* sidebar (tab strip on mobile) */}
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-muted/30 p-2 md:w-60 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:p-3">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = section === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSection(item.key)}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-border/60 bg-background text-foreground shadow-sm"
                      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                    item.danger && !active && "hover:text-destructive",
                    item.danger && "md:mt-auto"
                  )}
                >
                  <Icon className={cn("h-4 w-4", item.danger && "text-destructive")} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* content */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-10">
            <div className="mx-auto max-w-2xl">
              {/* ───────── GENERAL ───────── */}
              {section === "general" && (
                <div>
                  <SectionHeader
                    title="General"
                    description="Basic details about this plan."
                  />

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Plan name</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={!isOwner || savingGeneral}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={!isOwner || savingGeneral}
                        rows={3}
                        className="resize-none"
                        placeholder="What is this plan about?"
                      />
                    </div>
                    {isOwner ? (
                      <div className="flex justify-end">
                        <Button
                          className="cursor-pointer"
                          onClick={handleSaveGeneral}
                          disabled={!generalDirty || !name.trim() || savingGeneral}
                        >
                          {savingGeneral ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save changes"
                          )}
                        </Button>
                      </div>
                    ) : (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        Only the plan owner can edit these details.
                      </p>
                    )}
                  </div>

                  <div className="mt-8 rounded-lg border border-border px-4 divide-y divide-border">
                    <InfoRow label="Type" value={titleCase(currentPlanMeta?.type)} />
                    <InfoRow label="Status" value={titleCase(currentPlanMeta?.status)} />
                    <InfoRow
                      label="Your role"
                      value={currentPlanMeta?.isOwner ? "Owner" : titleCase(currentPlanMeta?.role)}
                    />
                    <InfoRow label="Finance mode" value={financeOn ? "On" : "Off"} />
                    <InfoRow
                      label="Hardware logistics"
                      value={currentPlanMeta?.hasHardware ? "On" : "Off"}
                    />
                    {currentPlanMeta?.type === "event" && (
                      <>
                        <InfoRow label="Ticketing" value={currentPlanMeta.hasTicketing ? "On" : "Off"} />
                        <InfoRow label="Stalls" value={currentPlanMeta.hasStalls ? "On" : "Off"} />
                        <InfoRow label="Event date" value={eventDate} />
                        <InfoRow label="Venue" value={currentPlanMeta.venue || "—"} />
                      </>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Finance mode, hardware, ticketing and stalls are changed from Plans → Edit.
                  </p>
                </div>
              )}

              {/* ───────── NOTIFICATIONS ───────── */}
              {section === "notifications" && (
                <div>
                  <SectionHeader
                    title="Notifications"
                    description="Personal settings. These only affect you."
                  />
                  <div className="space-y-3">
                    <SettingRow
                      title="Receive email updates"
                      description="Get emailed about updates, invitations, and warnings for this plan."
                    >
                      <Switch
                        checked={receivingEmails}
                        onCheckedChange={handleEmailToggle}
                        disabled={loadingEmailPref || savingEmailPref}
                      />
                    </SettingRow>
                    <SettingRow
                      title="Daily digest"
                      description="One summary email per day instead of individual updates."
                      comingSoon
                    >
                      <Switch disabled />
                    </SettingRow>
                    <SettingRow
                      title="Mute this plan"
                      description="Silence all in-app notifications from this plan."
                      comingSoon
                    >
                      <Switch disabled />
                    </SettingRow>
                  </div>
                </div>
              )}

              {/* ───────── COLLABORATION ───────── */}
              {section === "collaboration" && (
                <div>
                  <SectionHeader
                    title="Collaboration"
                    description="How people work together in this plan. Affects everyone."
                  />
                  <div className="space-y-3">
                    <SettingRow
                      title="Allow multiple editing"
                      locked={!perms.canManagePlanSettings}
                      description={
                        (allowMultipleEditing
                          ? "Multiple people can edit the same item at once."
                          : "Only one person can edit an item at a time.") +
                        (!perms.canManagePlanSettings ? " Only an Admin can change this." : "")
                      }
                    >
                      <Switch
                        checked={allowMultipleEditing}
                        onCheckedChange={handleEditingToggle}
                        disabled={!perms.canManagePlanSettings || savingEditingPref}
                      />
                    </SettingRow>
                    <SettingRow
                      title="Members can invite others"
                      description="Let non-admin members send invitations."
                      comingSoon
                    >
                      <Switch disabled />
                    </SettingRow>
                    <SettingRow
                      title="Require approval for new members"
                      description="Admins approve every invitation before the person joins."
                      comingSoon
                    >
                      <Switch disabled />
                    </SettingRow>
                  </div>
                </div>
              )}

              {/* ───────── MEMBERS & ROLES ───────── */}
              {section === "members" && (
                <div>
                  <SectionHeader
                    title="Members & Roles"
                    description="Defaults for people joining this plan."
                  />
                  <div className="space-y-3">
                    <SettingRow
                      title="Default role for new members"
                      description="The role given when someone accepts an invitation."
                      comingSoon
                    >
                      <span className="text-sm text-muted-foreground">Member</span>
                    </SettingRow>
                    <SettingRow
                      title="Invitation link expiry"
                      description="How long an invitation stays valid."
                      comingSoon
                    >
                      <span className="text-sm text-muted-foreground">7 days</span>
                    </SettingRow>
                  </div>
                  <div className="mt-6 rounded-lg border border-dashed border-border px-4 py-6 text-center">
                    <p className="text-sm font-medium text-foreground">Roles and permissions</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Manage individual roles, departments and permissions from the Team section.
                    </p>
                  </div>
                </div>
              )}

              {/* ───────── FINANCE ───────── */}
              {section === "finance" && financeOn && (
                <div>
                  <SectionHeader
                    title="Finance"
                    description="Budget and approval rules for this plan."
                  />
                  <div className="rounded-lg border border-border px-4 divide-y divide-border">
                    <InfoRow label="Plan budget" value={money(budget)} />
                    <InfoRow label="Currency" value={currency || "USD"} />
                  </div>
                  <p className="mt-3 mb-6 text-xs text-muted-foreground">
                    Budget and currency are changed from Plans → Edit.
                  </p>
                  <div className="space-y-3">
                    <SettingRow
                      title="Budget alert threshold"
                      description="Warn admins when spending passes this share of the budget."
                      comingSoon
                    >
                      <span className="text-sm text-muted-foreground">75%</span>
                    </SettingRow>
                    <SettingRow
                      title="Expense approval threshold"
                      description="Expenses above this amount need an extra approval."
                      comingSoon
                    >
                      <span className="text-sm text-muted-foreground">Off</span>
                    </SettingRow>
                    <SettingRow
                      title="Require receipts"
                      description="Block expense requests that have no attachment."
                      comingSoon
                    >
                      <Switch disabled />
                    </SettingRow>
                  </div>
                </div>
              )}

              {/* ───────── APPEARANCE ───────── */}
              {section === "appearance" && (
                <div>
                  <SectionHeader
                    title="Appearance"
                    description="Choose how the app looks on this device."
                  />
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "light", label: "Light", icon: Sun },
                      { value: "dark", label: "Dark", icon: Moon },
                      { value: "system", label: "System", icon: Monitor },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const active = theme === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setTheme(opt.value)}
                          className={cn(
                            "flex cursor-pointer flex-col items-center gap-2 rounded-lg border px-3 py-5 text-sm font-medium transition-colors",
                            active
                              ? "border-foreground bg-muted/40 text-foreground"
                              : "border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ───────── DANGER ZONE ───────── */}
              {section === "danger" && isOwner && (
                <div>
                  <SectionHeader
                    title="Danger zone"
                    description="Actions here can't be undone."
                  />
                  <div className="space-y-4 rounded-lg border border-destructive/40 bg-destructive/5 p-5">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Delete this plan</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Permanently deletes the plan and everything in it: tasks, milestones,
                        finances, files, members and the group chat.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">
                        Type <span className="font-semibold">{currentPlanMeta?.name}</span> to confirm
                      </Label>
                      <Input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        disabled={deleting}
                        placeholder={currentPlanMeta?.name}
                      />
                    </div>
                    <Button
                      variant="destructive"
                      className="cursor-pointer"
                      onClick={handleDelete}
                      disabled={deleting || confirmText !== currentPlanMeta?.name}
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        "Delete plan"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}