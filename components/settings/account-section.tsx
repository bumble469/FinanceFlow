"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  SettingsSection, SettingsRow, SettingsFooter, SettingsMessage, SETTINGS_FIELD,
} from "@/components/settings/settings-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { useSnackbar } from "@/lib/useSnackbar";
import { cn } from "@/lib/utils";
import { useFinancialStore } from "@/lib/store";
import { ChangePasswordDialog } from "@/components/settings/change-password-dialog";

const TYPES = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "COMPANY", label: "Company" },
];

const errMsg = (err: any, fallback: string) => err?.response?.data?.error || fallback;

/* ---------- Account details ---------- */
export function AccountDetailsSection() {
  const { show } = useSnackbar();
  const [account, setAccount] = useState<{ name: string; type: string } | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("INDIVIDUAL");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authClient
      .request("/api/settings/account")
      .then((res) => {
        const a = res.data.data;
        setAccount(a);
        setName(a.name);
        setType(a.type);
      })
      .catch(() => show("Could not load account", "error"));
  }, []);

  const dirty = !!account && (name.trim() !== account.name || type !== account.type);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authClient.request("/api/settings/account", {
        method: "PATCH",
        data: { name: name.trim(), type },
      });
      setAccount(res.data.data);
      show("Account updated", "success");
    } catch (err) {
      show(errMsg(err, "Failed to update account"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (!account) return <SettingsMessage>Loading account...</SettingsMessage>;

  return (
    <SettingsSection title="Account" description="Your workspace name and type.">
      <SettingsRow label="Account name" htmlFor="account-name">
        <Input
          id="account-name"
          className={SETTINGS_FIELD}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          disabled={saving}
        />
      </SettingsRow>

      <SettingsRow label="Account type">
        <div className="grid grid-cols-2 gap-3">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              disabled={saving}
              onClick={() => setType(t.value)}
              className={cn(
                "h-10 cursor-pointer rounded-lg border px-3 text-sm font-medium shadow-xs transition-colors",
                type === t.value
                  ? "border-foreground bg-muted/40 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </SettingsRow>

      <SettingsFooter>
        <Button
          variant="outline"
          className="cursor-pointer"
          disabled={!dirty || saving}
          onClick={() => {
            setName(account.name);
            setType(account.type);
          }}
        >
          Cancel
        </Button>
        <Button className="cursor-pointer" onClick={handleSave} disabled={!dirty || !name.trim() || saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save changes"}
        </Button>
      </SettingsFooter>
    </SettingsSection>
  );
}

/* ---------- Security ---------- */
export function SecuritySection() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    authClient
      .request("/api/settings/profile")
      .then((res) => setHasPassword(res.data.data.hasPassword))
      .catch(() => setHasPassword(false));
  }, []);

  const handleSignOutAll = async () => {
    try {
      await authClient.request("/api/auth/logout-all", { method: "POST" });
    } finally {
      useFinancialStore.getState().setCurrentUser(null);
      window.location.href = "/login"; // use your real login route
    }
  };

  return (
    <>
      <SettingsSection title="Security" description="Password and sign-in.">
        <SettingsRow
          action
          label="Password"
          description={
            hasPassword === false
              ? "You sign in with Google, so there is no password to change."
              : "We'll email you a code to confirm it's you before you can change it."
          }
        >
          {hasPassword ? (
            <Button variant="outline" className="cursor-pointer" onClick={() => setDialogOpen(true)}>
              Change password
            </Button>
          ) : null}
        </SettingsRow>

        <SettingsRow
          action
          label="Sign out of all devices"
          description="You'll need to log in again everywhere, including here."
        >
          <Button variant="outline" className="cursor-pointer" onClick={handleSignOutAll}>
            Sign out everywhere
          </Button>
        </SettingsRow>
      </SettingsSection>

      <ChangePasswordDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}

/* ---------- Danger zone ---------- */
export function DangerZoneSection() {
  const { show } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<{ email: string; hasPassword: boolean } | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    authClient
      .request("/api/settings/profile")
      .then((res) => setProfile(res.data.data))
      .catch(() => {});
  }, []);

  const emailOk = !!profile && confirmEmail.trim().toLowerCase() === profile.email.toLowerCase();
  const canDelete = emailOk && (!profile?.hasPassword || !!password) && !deleting;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await authClient.request("/api/settings/account", {
        method: "DELETE",
        data: { confirmEmail, password },
      });
      useFinancialStore.getState().setCurrentUser(null);
      window.location.href = "/login";
    } catch (err) {
      show(errMsg(err, "Failed to delete account"), "error");
      setDeleting(false);
    }
  };

  return (
    <>
      <SettingsSection title="Danger zone" tone="danger">
        <SettingsRow  
          action
          label="Delete account"
          description="Permanently delete your account, plans and messages. This can't be undone."
        >
          <Button variant="destructive" className="cursor-pointer" onClick={() => setOpen(true)}>
            Delete account
          </Button>
        </SettingsRow>
      </SettingsSection>

      <Dialog open={open} onOpenChange={(o) => !deleting && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently removes your account, your plans and your messages.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type your email ({profile?.email}) to confirm</Label>
              <Input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
            </div>
            {profile?.hasPassword && (
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting} className="cursor-pointer">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!canDelete} className="cursor-pointer">
              {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}