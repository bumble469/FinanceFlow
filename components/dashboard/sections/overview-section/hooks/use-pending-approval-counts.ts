import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { Expense } from "@/lib/types";

export function usePendingApprovalCounts(currentPlanId: string | null, expenses: Expense[]) {
  const [pendingExtensions, setPendingExtensions] = useState(0);

  useEffect(() => {
    if (!currentPlanId) return;
    authClient.request(`/api/plan/${currentPlanId}/extension-requests/pending-counts`)
      .then((res) => {
        const byMilestone = res.data.data.byMilestone ?? {};
        setPendingExtensions(Object.values(byMilestone).reduce((s: number, n: any) => s + n, 0));
      })
      .catch((err) => console.error("Failed to fetch pending extension counts:", err));
  }, [currentPlanId]);

  const pendingExpenseApprovals = expenses.filter((e) => e.status === "PENDING_APPROVAL").length;

  return { pendingExpenseApprovals, pendingExtensions };
}