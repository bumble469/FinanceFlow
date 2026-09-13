"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sun, Moon, Monitor, Settings as SettingsIcon, Lock } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useFinancialStore } from "@/lib/store";
import { getPermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface PlanSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
}

export function PlanSettingsDialog({ open, onOpenChange, planId }: PlanSettingsDialogProps) {
  const { currentPlanMeta, setCurrentPlanMeta } = useFinancialStore();
  const perms = getPermissions(currentPlanMeta);
  const { theme, setTheme } = useTheme();

  const [receivingEmails, setReceivingEmails] = useState(true);
  const [loadingEmailPref, setLoadingEmailPref] = useState(true);
  const [savingEmailPref, setSavingEmailPref] = useState(false);

  const [allowMultipleEditing, setAllowMultipleEditing] = useState(
    currentPlanMeta?.allowMultipleEditing ?? true
  );
  const [savingEditingPref, setSavingEditingPref] = useState(false);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Settings
          </DialogTitle>
          <DialogDescription>
            {currentPlanMeta?.name ?? "This plan"}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="personal" className="space-y-4">
          <TabsList>
            <TabsTrigger value="personal" className="cursor-pointer">Personal</TabsTrigger>
            <TabsTrigger value="plan" className="cursor-pointer">Plan</TabsTrigger>
          </TabsList>

          {/* PERSONAL TAB — only affects the logged-in user */}
          <TabsContent value="personal" className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div className="pr-4">
                <Label>Receive email updates</Label>
                <p className="text-xs text-muted-foreground">
                  Get emailed about updates, invitations, and warnings for this plan.
                </p>
              </div>
              <Switch
                checked={receivingEmails}
                onCheckedChange={handleEmailToggle}
                disabled={loadingEmailPref || savingEmailPref}
              />
            </div>
          </TabsContent>

          {/* PLAN TAB — affects everybody, admin-gated per setting */}
          <TabsContent value="plan" className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div className="pr-4">
                <div className="flex items-center gap-1.5">
                  <Label>Allow multiple editing</Label>
                  {!perms.canManagePlanSettings && <Lock className="h-3 w-3 text-muted-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {allowMultipleEditing
                    ? "Multiple people can edit the same item at once."
                    : "Only one person can edit an item at a time."}
                  {!perms.canManagePlanSettings && " Only an Admin can change this."}
                </p>
              </div>
              <Switch
                checked={allowMultipleEditing}
                onCheckedChange={handleEditingToggle}
                disabled={!perms.canManagePlanSettings || savingEditingPref}
              />
            </div>

            <div className="rounded-lg border border-border px-4 py-3 space-y-3">
              <Label>Appearance</Label>
              <div className="grid grid-cols-3 gap-2">
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
                        "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-medium transition-colors cursor-pointer",
                        active
                          ? "border-foreground bg-muted/40 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}