"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogoutSection } from "@/components/settings/logout-section";
import { ProfileSection, PreferencesSection } from "@/components/settings/profile-section";
import { AppearanceSection } from "@/components/settings/appearance-section";
import { AccountDetailsSection, SecuritySection, DangerZoneSection } from "@/components/settings/account-section";
import { TwoFactorSection } from "@/components/settings/two-factor-section";
import { SettingsSection, SettingsRow, SettingsMessage } from "@/components/settings/settings-layout";
import { authClient } from "@/lib/auth-client";
import type { AccountSubscription, ConnectionPrefs } from "@/lib/types";
import { DEFAULT_CONNECTION_PREFS } from "@/lib/types";
import Link from "next/link";
import { useFinancialStore } from "@/lib/store";
import { Switch } from "@/components/ui/switch";
import { useSnackbar } from "@/lib/useSnackbar";
import { useConnectionStore } from "@/lib/connection-store";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  TRIALING: "secondary",
  PAST_DUE: "destructive",
  CANCELLED: "outline",
  EXPIRED: "destructive",
  PENDING: "secondary",
};

// Text tabs with a soft pill on the active one
const TAB_LIST =
  "h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0";
const TAB_TRIGGER =
  "h-auto flex-none cursor-pointer rounded-md border-0 px-3 py-2 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-muted";

export function SettingsTabs() {
  const [subscription, setSubscription] = useState<AccountSubscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const { show } = useSnackbar();

  const [connPrefs, setConnPrefs] = useState<ConnectionPrefs>(DEFAULT_CONNECTION_PREFS);
  const [loadingConnPrefs, setLoadingConnPrefs] = useState(true);
  // Keep the Zustand store in sync so ConnectionNotifier always reads the
  // latest preference values without needing a page reload.
  const setStorePrefs = useConnectionStore((s) => s.setPrefs);

  useEffect(() => {
    authClient.request("/api/subscription")
      .then((res) => setSubscription(res.data.data ?? null))
      .catch((err) => console.error("Failed to fetch subscription:", err))
      .finally(() => setLoadingSub(false));
  }, []);

  // Load the Connections preferences from the server (they are persisted
  // per-user, not in the local zustand store).
  useEffect(() => {
    let cancelled = false;

    authClient
      .request("/api/settings/connections", { method: "GET" })
      .then((res) => {
        if (cancelled) return;
        if (res.data?.data) setConnPrefs(res.data.data as ConnectionPrefs);
      })
      .catch((err) => console.error("Failed to load connection settings:", err))
      .finally(() => {
        if (!cancelled) setLoadingConnPrefs(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Save one Connections preference. Optimistic update with rollback on error.
   */
  const saveConnPref = async <K extends keyof ConnectionPrefs>(
    key: K,
    value: ConnectionPrefs[K]
  ) => {
    const previous = connPrefs;
    const updated = { ...connPrefs, [key]: value };
    // Optimistic update in local state AND the global Zustand store so the
    // ConnectionNotifier (which reads from the store) reacts immediately.
    setConnPrefs(updated);
    setStorePrefs(updated);

    try {
      await authClient.request("/api/settings/connections", {
        method: "PATCH",
        data: { [key]: value },
      });
    } catch (error) {
      console.error("Failed to update connection setting", error);
      setConnPrefs(previous);
      setStorePrefs(previous);
      show("Failed to save setting. Please try again.", "error");
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-1 sm:space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="general" className="gap-8">
        <TabsList className={TAB_LIST}>
          <TabsTrigger value="general" className={TAB_TRIGGER}>General</TabsTrigger>
          <TabsTrigger value="account" className={TAB_TRIGGER}>Account</TabsTrigger>
          <TabsTrigger value="appearance" className={TAB_TRIGGER}>Appearance</TabsTrigger>
          <TabsTrigger value="subscription" className={TAB_TRIGGER}>Subscription</TabsTrigger>
          <TabsTrigger value="connections" className={TAB_TRIGGER}>Connections</TabsTrigger>
        </TabsList>

        {/* GENERAL TAB */}
        <TabsContent value="general" className="space-y-10">
          <ProfileSection />
          <PreferencesSection />
          <LogoutSection />
        </TabsContent>

        {/* ACCOUNT TAB */}
        <TabsContent value="account" className="space-y-10">
          <AccountDetailsSection />
          <SecuritySection />
          <TwoFactorSection />
          <DangerZoneSection />
        </TabsContent>

        {/* APPEARANCE TAB */}
        <TabsContent value="appearance" className="space-y-10">
          <AppearanceSection />
        </TabsContent>

        {/* SUBSCRIPTION TAB */}
        <TabsContent value="subscription" className="space-y-10">
          <SettingsSection
            title="Subscription"
            description="Your current plan and billing period."
            action={
              <Link href="/settings/subscription-plan" className="text-sm font-medium text-primary hover:underline">
                Change plan →
              </Link>
            }
          >
            {loadingSub ? (
              <SettingsMessage>Loading subscription details...</SettingsMessage>
            ) : !subscription ? (
              <SettingsMessage>
                No active subscription found.{" "}
                <Link href="/settings/subscription-plan" className="text-primary hover:underline">
                  Choose a plan
                </Link>
              </SettingsMessage>
            ) : (
              <>
                <SettingsRow label="Plan">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{subscription.plan.name}</p>
                    <Badge variant={STATUS_VARIANT[subscription.status] ?? "outline"}>
                      {subscription.status}
                    </Badge>
                    {subscription.cancelAtPeriodEnd && (
                      <Badge variant="outline">Cancels at period end</Badge>
                    )}
                  </div>
                </SettingsRow>

                <SettingsRow label="Billing">
                  <p className="text-sm text-foreground">
                    {subscription.amount === 0
                      ? "Free"
                      : `₹${subscription.amount.toLocaleString("en-IN")} / ${subscription.billingInterval.toLowerCase().replace("_", "-")}`}
                  </p>
                </SettingsRow>

                <SettingsRow label="Claimed on">
                  <p className="text-sm text-foreground">{formatDate(subscription.startedAt)}</p>
                </SettingsRow>

                <SettingsRow label="Current period started">
                  <p className="text-sm text-foreground">{formatDate(subscription.currentPeriodStart)}</p>
                </SettingsRow>

                <SettingsRow label="Valid till">
                  <p className="text-sm text-foreground">{formatDate(subscription.currentPeriodEnd)}</p>
                </SettingsRow>

                <SettingsRow label="Plan limits">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Projects</p>
                      <p className="font-medium text-foreground">{subscription.plan.maxProjects ?? "Unlimited"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Events</p>
                      <p className="font-medium text-foreground">{subscription.plan.maxEvents ?? "Unlimited"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total work items</p>
                      <p className="font-medium text-foreground">{subscription.plan.maxTotalWorkItems ?? "Unlimited"}</p>
                    </div>
                  </div>
                </SettingsRow>
              </>
            )}
          </SettingsSection>
        </TabsContent>

        {/* CONNECTIONS TAB */}
        <TabsContent value="connections" className="space-y-10">
          <SettingsSection title="Connections" description="Control how you connect with people.">
            <SettingsRow
              action
              label="Auto-connect with Coworkers"
              description="Automatically connect with people added to your plans and work items."
            >
              <Switch
                className="cursor-pointer"
                checked={connPrefs.autoConnectWithCoworkers}
                disabled={loadingConnPrefs}
                onCheckedChange={(v) => saveConnPref("autoConnectWithCoworkers", v)}
              />
            </SettingsRow>

            <SettingsRow
              action
              label="Message Notifications"
              description="Show a snackbar at the top-left when a new message arrives."
            >
              <Switch
                className="cursor-pointer"
                checked={connPrefs.messageSnackbarEnabled}
                disabled={loadingConnPrefs}
                onCheckedChange={(v) => saveConnPref("messageSnackbarEnabled", v)}
              />
            </SettingsRow>


            <SettingsRow
              action
              label="Email Notifications"
              description="Receive email for connection requests and messages."
            >
              <Switch
                className="cursor-pointer"
                checked={connPrefs.emailNotificationsEnabled}
                disabled={loadingConnPrefs}
                onCheckedChange={(v) => saveConnPref("emailNotificationsEnabled", v)}
              />
            </SettingsRow>
          </SettingsSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}