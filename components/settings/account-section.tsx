"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
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

  if (!account) {
    return (
      <Card className="border border-border bg-card p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">Loading account...</p>
      </Card>
    );
  }

  return (
    <Card className="border border-border bg-card p-4 sm:p-6">
      <h2 className="text-xl font-semibold text-foreground">Account</h2>
      <p className="mb-6 text-sm text-muted-foreground">Your workspace name and type.</p>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Account name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} disabled={saving} />
        </div>

        <div className="space-y-2">
          <Label>Account type</Label>
          <div className="grid grid-cols-3 gap-3">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                disabled={saving}
                onClick={() => setType(t.value)}
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-3 text-sm font-medium transition-colors",
                  type === t.value
                    ? "border-foreground bg-muted/40 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button className="cursor-pointer" onClick={handleSave} disabled={!dirty || !name.trim() || saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save changes"}
          </Button>
        </div>
      </div>
    </Card>
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
      <Card className="border border-border bg-card p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-foreground">Security</h2>
        <p className="mb-6 text-sm text-muted-foreground">Password and sign-in.</p>

        {hasPassword === false ? (
          <p className="mb-6 text-sm text-muted-foreground">
            You sign in with Google, so there is no password to change.
          </p>
        ) : hasPassword ? (
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Password</p>
              <p className="text-xs text-muted-foreground">
                We'll email you a code to confirm before it's changed.
              </p>
            </div>
            <Button variant="outline" className="cursor-pointer" onClick={() => setDialogOpen(true)}>
              Change password
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Sign out of all devices</p>
            <p className="text-xs text-muted-foreground">You'll need to log in again everywhere, including here.</p>
          </div>
          <Button variant="outline" className="cursor-pointer" onClick={handleSignOutAll}>
            Sign out everywhere
          </Button>
        </div>
      </Card>

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
      <Card className="border border-destructive/40 bg-card p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-destructive">Danger zone</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Permanently delete your account, plans and messages. This can't be undone.
          </p>
          <Button variant="destructive" className="cursor-pointer" onClick={() => setOpen(true)}>
            Delete account
          </Button>
        </div>
      </Card>

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