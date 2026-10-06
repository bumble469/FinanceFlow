"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, Receipt, CalendarDays, FileBarChart,
  KanbanSquare, ChevronLeft, ChevronRight, ArrowLeft, Wrench
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useFinancialStore } from "@/lib/store";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  planName?: string;
  entityName: string;
  isOwner?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "event", label: "Planning", icon: CalendarDays },
  { id: "workspace", label: "Workspace", icon: KanbanSquare },
  { id: "team", label: "Team & Roles", icon: Users },
  { id: "expenses", label: "Revenue and Expenses", icon: Receipt },
  { id: "hardware", label: "Hardware", icon: Wrench },
  { id: "reports", label: "Reports & Docs", icon: FileBarChart },
];

export function Sidebar({
  activeSection,
  onSectionChange,
  planName,
  entityName,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const router = useRouter();
  const { currentPlanMeta } = useFinancialStore();

  const isEvent = currentPlanMeta?.type === "event";
  const financeOn = currentPlanMeta?.financeEnabled !== false;

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("flex items-center gap-3 border-b border-border p-4", collapsed && "justify-center px-2")}>
        <Image src="/web_logo.png" alt="FinanceFlow Logo" width={36} height={36} className="rounded-lg shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="font-semibold text-sidebar-foreground truncate">FinanceFlow</h1>
            <p className="text-xs text-muted-foreground line-clamp-1">{planName || "Plan Dashboard"}</p>
          </div>
        )}
      </div>

      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute cursor-pointer -right-3 top-16 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground shadow-sm transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      )}

      <div className={cn("p-3", collapsed && "px-2")}>
        <button
          type="button"
          title="Back to plans"
          onClick={() => router.push("/plans")}
          className={cn(
            "cursor-pointer flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors",
            collapsed ? "justify-center px-0" : "px-3"
          )}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {!collapsed && "Back to plans"}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3 pt-0">
        {!collapsed && (
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Navigation
          </p>
        )}

        {navItems.filter((item) => 
          (item.id !== "hardware" || currentPlanMeta?.hasHardware) &&
          (item.id !== "expenses" || financeOn)
        ).map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              title={collapsed ? item.label : undefined}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "cursor-pointer flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0" : "px-3",
                isActive ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && item.label}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-border p-4">
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">Project / Event</p>
            <p className="truncate text-sm font-medium text-sidebar-foreground">{entityName}</p>
          </div>
        </div>
      )}
    </aside>
  );
}