"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useFinancialStore } from "@/lib/store";
import { authClient } from "@/lib/auth-client";
import { fetchTicketingAndStalls } from "@/lib/fetch-ticketing-stalls";

export default function PlanDashboardPage() {
  const params = useParams();
  const planId = params.planId as string;
  const { setCurrentPlanId, setCurrentPlanMeta, setPlanMeta, setIncome, setExpenses } = useFinancialStore();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!planId) return;

    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    const init = async () => {
      try {
        setCurrentPlanId(planId);
        const res = await authClient.request(`/api/plan/${planId}`, {
          method: "GET",
        });

        if (cancelled) return;

        const data = res.data.data;

        setCurrentPlanMeta({
          id: data.id,
          name: data.name,
          type: data.type?.toLowerCase() as "project" | "event" | "plan",
          status: data.status?.toLowerCase(),
          isOwner: data.isOwner,
          role: data.role,
          memberId: data.memberId ?? null,
          departmentIds: data.departmentIds,
          permissions: data.permissions ?? null,
          hasStalls: data.event?.hasStalls ?? false,
          hasHardware: data.hasHardware ?? false,
          hasTicketing: data.event?.hasTicketing ?? false,
          upiQrUrl: data.event?.upiQrUrl ?? null,
          eventDate: data.event?.eventDate ?? null,
          venue: data.event?.venue ?? null,
          allowMultipleEditing: data.allowMultipleEditing ?? true,
        });

        setPlanMeta({
          eventBudget: data.budget,
          departments: data.departments || [],
          modules: data.phases || [],
          tasks: data.tasks || [],
          currency: data.currency,
          teamMembers: data.members || [],
          milestones: data.milestones || [],
        });

        setIncome((data.income || []).map((i: any) => ({ ...i, amount: Number(i.amount) })));
        setExpenses((data.expenses || []).map((e: any) => ({ ...e, amount: Number(e.amount) })));
        await fetchTicketingAndStalls(planId, {
          hasTicketing: !!data.event?.hasTicketing,
          hasStalls: !!data.event?.hasStalls,
        });
      } catch (err: any) {
        if (cancelled) return;
        console.error("Failed to fetch plan:", err);
        if (err?.response?.status === 404 || err?.response?.status === 403) {
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [planId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading plan...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">Plan not found or access denied.</p>
      </div>
    );
  }

  return <DashboardLayout planId={planId} />;
}