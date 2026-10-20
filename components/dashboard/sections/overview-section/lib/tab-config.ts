import { TentIcon, LayoutDashboard, CalendarDays, KanbanSquare, Users, Receipt, FileBarChart, CheckCircle } from "lucide-react";
import type { PlanType } from "@/lib/analytics";

export interface OverviewTabConfig {
  id: string;
  label: string;
  icon: typeof TentIcon;
  /** event plans see this tab; projects don't */
  allowedPlanTypes?: PlanType[];
  /** this tab only makes sense when the plan has finance switched on */
  requiresFinance?: boolean;
}

export const OVERVIEW_TABS: OverviewTabConfig[] = [
  { id: "summary",     label: "Summary",     icon: LayoutDashboard },
  { id: "planning",    label: "Planning",    icon: CalendarDays },
  { id: "workspace",   label: "Workspace",   icon: KanbanSquare },
  { id: "team",        label: "Team",        icon: Users },
  { id: "revenue",     label: "Revenue & Expense", icon: Receipt, requiresFinance: true },
  { id: "hardware",    label: "Hardware",    icon: CheckCircle },
  { id: "reports",     label: "Reports",     icon: FileBarChart },
  { id: "attendance",  label: "Attendance",  icon: TentIcon, allowedPlanTypes: ["event"] },
];

/** Tabs the given plan type and finance flag can actually show. */
export function visibleTabs(planType: PlanType, financeEnabled: boolean): OverviewTabConfig[] {
  return OVERVIEW_TABS.filter((t) => {
    if (t.allowedPlanTypes && !t.allowedPlanTypes.includes(planType)) return false;
    if (t.requiresFinance && !financeEnabled) return false;
    return true;
  });
}

export function isTabAllowed(
  tabId: string,
  planType: PlanType,
  financeEnabled = true
): boolean {
  return visibleTabs(planType, financeEnabled).some((t) => t.id === tabId);
}
