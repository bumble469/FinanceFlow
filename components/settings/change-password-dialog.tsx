"use client";

import { useEffect, useState } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { authClient } from "@/lib/auth-client";
import { useSnackbar } from "@/lib/useSnackbar";
import { cn } from "@/lib/utils";

type Channel = "PRIMARY" | "SECONDARY";

const maskEmail = (email: string) => {
  const [u, d] = email.split("@");
  if (!u || !d) return email;
  return `${u.slice(0, 2)}***@${d}`;
};

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { show } = useSnackbar();

  const [loadingInfo, setLoadingInfo] = useState(true);
  const [accountEmail, setAccountEmail] = useState("");
  const [twoFactor, setTwoFactor] = useState<{ enabled: boolean; recoveryEmail?: string | null } | null>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [channel, setChannel] = useState<Channel>("PRIMARY");
  const [destination, setDestination] = useState("");
  const [remaining, setRemaining] = useState(4);
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);

  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const secondaryAvailable = !!twoFactor?.enabled && !!twoFactor.recoveryEmail;

  // reset and load details each time the dialog opens
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setChannel("PRIMARY");
    setDestination("");
    setRemaining(4);
    setCooldown(0);
    setCode("");
    setNext("");
    setConfirm("");
    setError("");

    setLoadingInfo(true);
    Promise.all([
      authClient.request("/api/settings/profile"),
      authClient.request("/api/auth/two-factor/settings").catch(() => null),
    ])
      .then(([profile, tf]) => {
        setAccountEmail(profile.data.data.email ?? "");
        setTwoFactor(tf?.data?.data ?? { enabled: false });
      })
      .catch(() => setError("Could not load your details. Please try again."))
      .finally(() => setLoadingInfo(false));
  }, [open]);

  // resend countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    setSending(true);
    setError("");
    try {
      const res = await authClient.request("/api/settings/password/send-code", {
        method: "POST",
        data: { channel },
      });
      setDestination(res.data.destination);
      setRemaining(res.data.remaining ?? 0);
      setCooldown(30);
      setCode("");
      setStep(2);
    } catch (e: any) {
      if (typeof e?.response?.data?.remaining === "number") setRemaining(e.response.data.remaining);
      setError(e?.response?.data?.error || "Could not send the code");
    } finally {
      setSending(false);
    }
  };

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = code.length === 6 && !!next && next === confirm && !saving;

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await authClient.request("/api/settings/password", {
        method: "PATCH",
        data: { code, newPassword: next },
      });
      show("Password changed", "success");
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const options: { value: Channel; label: string; sub: string }[] = [
    { value: "PRIMARY", label: "Account email", sub: maskEmail(accountEmail) },
    ...(secondaryAvailable
      ? [{ value: "SECONDARY" as Channel, label: "Secondary email", sub: maskEmail(twoFactor!.recoveryEmail!) }]
      : []),
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && !saving && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            {step === 1
              ? "We'll email you a 6-digit code to confirm it's you."
              : `Enter the code sent to ${destination}, then choose a new password.`}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-3">
            {loadingInfo ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <>
                <Label>Send the code to</Label>
                <div className="space-y-2">
                  {options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setChannel(o.value)}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                        channel === o.value
                          ? "border-foreground bg-muted/40"
                          : "border-border hover:bg-muted/30"
                      )}
                    >
                      <span className="text-sm font-medium text-foreground">{o.label}</span>
                      <span className="text-xs text-muted-foreground">{o.sub}</span>
                    </button>
                  ))}
                </div>

                {!secondaryAvailable && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Use a secondary email</p>
                      <p className="text-xs text-muted-foreground">
                        {twoFactor?.enabled
                          ? "Add a recovery email in your two-step settings."
                          : "Turn on two-step verification to add one."}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 cursor-pointer"
                      onClick={() => (window.location.href = "/two-factor/setup")}
                    >
                      {twoFactor?.enabled ? "Manage two-step" : "Enable two-step"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Verification code</Label>
              <InputOTP maxLength={6} value={code} onChange={setCode} pattern={REGEXP_ONLY_DIGITS} autoFocus>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <button
                type="button"
                onClick={sendCode}
                disabled={sending || cooldown > 0 || remaining === 0}
                className="cursor-pointer text-xs text-primary hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
              >
                {sending
                  ? "Sending..."
                  : remaining === 0
                    ? "No sends left, try again in 15 minutes"
                    : cooldown > 0
                      ? `Resend code in ${cooldown}s`
                      : `Resend code (${remaining} left)`}
              </button>
            </div>

            <div className="space-y-2">
              <Label>New password</Label>
              <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                At least 8 characters with upper and lower case, a number and a symbol.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Confirm new password</Label>
              <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              {mismatch && <p className="text-xs text-destructive">Passwords don't match.</p>}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 1 ? (
            <>
              <Button variant="outline" className="cursor-pointer mx-2" onClick={() => onOpenChange(false)} disabled={sending}>
                Cancel
              </Button>
              <Button
                className="cursor-pointer"
                onClick={sendCode}
                disabled={loadingInfo || !accountEmail || sending || remaining === 0}
              >
                {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : "Send code"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="cursor-pointer" onClick={() => { setStep(1); setError(""); }} disabled={saving}>
                Back
              </Button>
              <Button className="cursor-pointer" onClick={submit} disabled={!canSubmit}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</> : "Change password"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}