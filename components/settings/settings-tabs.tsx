"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/layout/top-nav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogoutSection } from "@/components/settings/logout-section";
import { authClient } from "@/lib/auth-client";
import type { AccountSubscription } from "@/lib/types";
import Link from "next/link";

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

export function SettingsTabs() {
  const [subscription, setSubscription] = useState<AccountSubscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);

  useEffect(() => {
    authClient.request("/api/subscription")
      .then((res) => setSubscription(res.data.data ?? null))
      .catch((err) => console.error("Failed to fetch subscription:", err))
      .finally(() => setLoadingSub(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground">Manage your account and preferences</p>
          </div>

          <Tabs defaultValue="general" className="space-y-6">
            <TabsList>
              <TabsTrigger value="general" className="cursor-pointer">General</TabsTrigger>
              <TabsTrigger value="account" className="cursor-pointer">Account</TabsTrigger>
              <TabsTrigger value="subscription" className="cursor-pointer">Subscription</TabsTrigger>
            </TabsList>

            {/* GENERAL TAB */}
            <TabsContent value="general" className="space-y-6">
              <Card className="border border-border bg-card p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  About This Dashboard
                </h2>
                <p className="text-muted-foreground mb-3">
                  This financial management dashboard uses a hierarchical, multi-plan architecture:
                </p>
                <div className="space-y-2 text-sm text-muted-foreground font-mono">
                  <p>Account (Individual or Company)</p>
                  <p className="ml-4">└── Plans (Projects or Events)</p>
                  <p className="ml-8">├── Team Members</p>
                  <p className="ml-8">├── Expenses</p>
                  <p className="ml-8">├── Event Data (if Event type)</p>
                  <p className="ml-8">└── Simulation State</p>
                </div>
              </Card>
              <LogoutSection />
            </TabsContent>

            {/* ACCOUNT TAB */}
            <TabsContent value="account" className="space-y-6">
              <Card className="border border-border bg-card p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  Account Settings
                </h2>
                <p className="text-muted-foreground mb-4">
                  Account management features will appear here.
                </p>
                <p className="text-sm text-muted-foreground italic">Future features:</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mt-2">
                  <li>Change account type (Individual/Company)</li>
                  <li>Update account name</li>
                  <li>Manage team members (Company accounts)</li>
                </ul>
              </Card>
            </TabsContent>

            {/* SUBSCRIPTION TAB */}
            <TabsContent value="subscription" className="space-y-6">
              <Card className="border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-foreground">Subscription</h2>
                  <Link href="/settings/subscription-plan" className="text-sm text-primary hover:underline font-medium">
                    Change plan →
                  </Link>
                </div>

                {loadingSub ? (
                  <p className="text-sm text-muted-foreground">Loading subscription details...</p>
                ) : !subscription ? (
                  <p className="text-muted-foreground">
                    No active subscription found.{" "}
                    <Link href="/settings/subscription-plan" className="text-primary hover:underline">
                      Choose a plan
                    </Link>
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-semibold text-foreground">{subscription.plan.name}</p>
                      <Badge variant={STATUS_VARIANT[subscription.status] ?? "outline"}>
                        {subscription.status}
                      </Badge>
                      {subscription.cancelAtPeriodEnd && (
                        <Badge variant="outline">Cancels at period end</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Billing</p>
                        <p className="text-foreground font-medium">
                          {subscription.amount === 0
                            ? "Free"
                            : `₹${subscription.amount.toLocaleString("en-IN")} / ${subscription.billingInterval.toLowerCase().replace("_", "-")}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Claimed on</p>
                        <p className="text-foreground font-medium">{formatDate(subscription.startedAt)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Current period started</p>
                        <p className="text-foreground font-medium">{formatDate(subscription.currentPeriodStart)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Valid till</p>
                        <p className="text-foreground font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Projects</p>
                        <p className="text-foreground font-medium">{subscription.plan.maxProjects ?? "Unlimited"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Events</p>
                        <p className="text-foreground font-medium">{subscription.plan.maxEvents ?? "Unlimited"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total work items</p>
                        <p className="text-foreground font-medium">{subscription.plan.maxTotalWorkItems ?? "Unlimited"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}