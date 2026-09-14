"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useFinancialStore } from "@/lib/store";
import { PlanCard } from "./plan-card";
import { CreatePlanDialog } from "./create-plan-dialog";
import type { Plan } from "@/lib/types";
import axios from "axios";
import { authClient } from "@/lib/auth-client";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Loader } from "@/components/shared/loader";

function mapWorkItemToPlan(workItem: any): Plan {
  return {
    id: workItem.id,
    accountId: workItem.accountId,
    name: workItem.name,
    type: workItem.type.toLowerCase() as Plan["type"],
    status: workItem.status.toLowerCase() as Plan["status"],
    budget: Number(workItem.budget ?? 0),
    spent: 0,
    currency: workItem.currency ?? "USD",
    description: workItem.description ?? undefined,
    createdAt: new Date(workItem.createdAt),
    teamMembers: [],
    project: workItem.project ?? null,
    event: workItem.event ?? null,
    expenses: workItem.expenses ?? [],
    income: workItem.income ?? [],
    eventData: undefined,
    simulation: {
      costMultiplier: 1,
      additionalMembers: 0,
      revenueAdjustment: 0,
      isSimulating: false,
    },
    mode: workItem.type === "EVENT" ? "event" : "project",
  };
}

export function PlansPage() {
  const {
    plans,
    setPlans,
    account,
    setIsLoading,
    setError,
    isLoading,
    error,
  } = useFinancialStore();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const [collaborations, setCollaborations] = useState<Plan[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);

  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    fetchPlans();
    authClient.request("/api/subscription")
      .then((res) => setSubscription(res.data.data ?? null))
      .catch((err) => console.error("Failed to fetch subscription:", err));
  }, []);

  const fetchPlans = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data } = await authClient.request("/api/plan", {
        method: "GET",
      });

      setPlans(data.data.myPlans.map(mapWorkItemToPlan));
      setCollaborations(
        data.data.collaborations.map(mapWorkItemToPlan)
      );

      setInvitations(data.data.invitations);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error || "Failed to fetch plans"
        );
      } else {
        setError("Something went wrong");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setIsCreateDialogOpen(true);
  };

  const renderPlans = (
    items: any[],
    emptyText: string,
    showCreateButton = false,
    variant: "default" | "invitation" | "collaboration" = "default"
  ) => {
    if (items.length === 0) {
      return (
        <Card className="border border-border bg-card/50 p-8 text-center">
          <p className="text-muted-foreground">{emptyText}</p>

          {showCreateButton && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              Create your first plan
            </Button>
          )}
        </Card>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onEdit={handleEditPlan}
            variant={variant}
            onRefresh={fetchPlans}
          />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader label="Loading plans..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  const projectCount = plans.filter((p) => p.type === "project").length;
  const eventCount = plans.filter((p) => p.type === "event").length;
  const totalCount = plans.length;

  const planLimits = subscription?.plan;
  const atTotalLimit = planLimits?.maxTotalWorkItems != null && totalCount >= planLimits.maxTotalWorkItems;
  const atProjectLimit = planLimits ? projectCount >= planLimits.maxProjects : false;
  const atEventLimit = planLimits ? eventCount >= planLimits.maxEvents : false;
  const createDisabled = atTotalLimit || (atProjectLimit && atEventLimit);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Plans
          </h1>
          <p className="text-muted-foreground">
            Manage financial plans for {account?.name}
          </p>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="gap-2 cursor-pointer"
                disabled={createDisabled}
              >
                <Plus className="h-4 w-4" />
                Create Plan
              </Button>
            </span>
          </TooltipTrigger>
          {createDisabled && (
            <TooltipContent>
              {atTotalLimit
                ? `You've reached your ${planLimits.name} plan's total work item limit (${planLimits.maxTotalWorkItems}). Upgrade to create more.`
                : `You've reached your ${planLimits.name} plan's project and event limits. Upgrade to create more.`}
            </TooltipContent>
          )}
        </Tooltip>
      </div>

      <Tabs defaultValue="my-plans" className="space-y-6">
        <TabsList>
          <TabsTrigger
            value="my-plans"
            className="gap-2 cursor-pointer"
          >
            My Plans
            <Badge variant="secondary">{plans.length}</Badge>
          </TabsTrigger>

          <TabsTrigger
            value="collaborations"
            className="gap-2 cursor-pointer"
          >
            Collaborations
            <Badge variant="secondary">
              {collaborations.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="invitations"
            className="gap-2 cursor-pointer"
          >
            Invitations
            <Badge variant="secondary">
              {invitations.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-plans">
          {renderPlans(plans, "No plans created yet.", true)}
        </TabsContent>

        <TabsContent value="collaborations">
          {renderPlans(collaborations, "No collaborations yet.", false, "collaboration")}
        </TabsContent>

        <TabsContent value="invitations">
          {renderPlans(
            invitations,
            "No pending invitations.",
            false,
            "invitation"
          )}
        </TabsContent>
      </Tabs>

      <CreatePlanDialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) setEditingPlan(null);
        }}
        onPlanCreate={fetchPlans}
        initialData={editingPlan ?? undefined}
        isEditMode={!!editingPlan}
        atProjectLimit={atProjectLimit}
        atEventLimit={atEventLimit}
        planName={planLimits?.name}
        maxProjects={planLimits?.maxProjects}
        maxEvents={planLimits?.maxEvents}
      />
    </div>
  );
}