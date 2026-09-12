"use client";

import { useState } from "react";
import { ArrowRight, Trash2, Pencil, Briefcase, CalendarDays } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useFinancialStore } from "@/lib/store";
import type { Plan } from "@/lib/types";
import { authClient } from "@/lib/auth-client";

interface PlanCardProps {
  plan: any;
  onEdit: (plan: Plan) => void;
  variant?: "default" | "invitation" | "collaboration";
  onRefresh?: () => void;
}

export function PlanCard({
  plan,
  onEdit,
  variant = "default",
  onRefresh,
}: PlanCardProps) {
  const { removePlan } = useFinancialStore();
  const [deleting, setDeleting] = useState(false);

  const isInvitation = variant === "invitation";
  const isCollaboration = variant === "collaboration";

  const handleInvitation = async (action: "ACCEPT" | "REJECT") => {
    try {
      await authClient.request(
        `/api/plan/${plan.workItemId}/members/invitation/response`,
        {
          method: "POST",
          data: {
            invitationId: plan.id,
            action,
          },
        }
      );
      onRefresh?.();
    } catch (err) {
      console.error(err);
    }
  };

  if (isInvitation) {
    return (
      <Card className="border border-border bg-card p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {plan.workItem.name}
          </h3>

          <div className="mt-2 flex gap-2">
            <Badge variant="outline">{plan.workItem.type}</Badge>
            <Badge className="bg-warning text-warning-foreground">
              {plan.status}
            </Badge>
          </div>
        </div>

        {plan.workItem.description && (
          <p className="text-sm text-muted-foreground">
            {plan.workItem.description}
          </p>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Invited By</span>
            <span>{plan.invitedBy?.name || "Unknown"}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span>{plan.role}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1 cursor-pointer"
            onClick={() => handleInvitation("ACCEPT")}
          >
            Accept
          </Button>

          <Button
            variant="outline"
            className="flex-1 cursor-pointer hover:text-gray-600"
            onClick={() => handleInvitation("REJECT")}
          >
            Reject
          </Button>
        </div>
      </Card>
    );
  }

  const spent = plan.expenses.reduce(
    (sum: number, e: any) => sum + e.amount,
    0
  );

  const spentPercent = (spent / plan.budget) * 100;
  const isWarning = spentPercent > 75;
  const isRisk = spentPercent > 90;

  const getStatusColor = () => {
    if (plan.status === "completed") return "bg-muted text-muted-foreground";
    if (isRisk) return "bg-danger text-danger-foreground";
    if (isWarning) return "bg-warning text-warning-foreground";
    return "bg-success text-success-foreground";
  };

  const getStatusLabel = () => {
    if (plan.status === "completed") return "Completed";
    if (isRisk) return "At Risk";
    if (isWarning) return "Warning";
    return "Healthy";
  };

  const handleDeletePlan = async () => {
    try {
      setDeleting(true);
      await authClient.request(`/api/plan/${plan.id}`, { method: "DELETE" });
      removePlan(plan.id);
    } catch (error) {
      console.error("Failed to delete plan", error);
    } finally {
      setDeleting(false);
    }
  };

  const TypeIcon = plan.type === "project" ? Briefcase : CalendarDays;

  return (
    <Card className="group overflow-hidden border border-border bg-card p-0 transition-all duration-300 hover:shadow-lg hover:scale-102">
      {/* Banner */}
      <div
        className="relative h-40 w-full overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, var(--secondary) 0%, var(--muted) 45%, var(--secondary) 100%)",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <TypeIcon className="h-10 w-10 text-muted-foreground/30" />
        </div>

        {!isCollaboration && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-3 right-3 cursor-pointer h-8 w-8 bg-background/70 backdrop-blur-sm hover:bg-background"
            onClick={() => onEdit(plan)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}

        <Badge variant="outline" className="absolute top-3 left-3 bg-background/70 backdrop-blur-sm text-xs">
          {plan.type === "project" ? "Project" : "Event"}
        </Badge>
      </div>

      <div className="border-t border-border/60 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-foreground line-clamp-1">
            {plan.name}
          </h3>
          <Badge className={`shrink-0 text-xs ${getStatusColor()}`}>
            {getStatusLabel()}
            {isCollaboration && plan.role ? ` · ${plan.role}` : ""}
          </Badge>
        </div>

        <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
          {plan.currency || "$"}{spent.toLocaleString()} spent of {plan.currency || "$"}{plan.budget.toLocaleString()} budget ({spentPercent.toFixed(0)}% used)
        </p>
      </div>

      <div className="border-t border-border/60 p-3 flex items-center gap-2">
        <Link href={`/plans/${plan.id}`} className="flex-1">
          <Button
            className="w-full gap-2 cursor-pointer rounded-full bg-secondary hover:bg-gray-300 hover:text-gray-800 text-foreground font-semibold"
            size="sm"
          >
            View Dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>

        {!isCollaboration && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive shrink-0 cursor-pointer">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Plan?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer hover:text-gray-600">Cancel</AlertDialogCancel>
                <AlertDialogAction className="cursor-pointer bg-red-500 hover:bg-red-700 hover:text-gray-100" onClick={handleDeletePlan} disabled={deleting}>
                  {deleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </Card>
  );
}