"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, navItems } from "./navigation/sidebar";
import { Topbar } from "./navigation/topbar";
import { OverviewSection } from "./sections/overview-section/overview-section";
import { TeamSection } from "./sections/team_role_section/team-section";
import { RevenueExpenseSection } from "./sections/rev_exp_section/rev-exp_section";
import { PlanningSection } from "./sections/planning-section/planning-section";
import { ReportsSection } from "./sections/reports-section/page";
import { HardwareSection } from "./sections/hardware-section/hardware-section";
import { Menu, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFinancialStore } from "@/lib/store";
import { Loader } from "@/components/shared/loader";
import { getPermissions } from "@/lib/permissions";
import { useRealtimePermissions } from "@/hooks/use-realtime-permissions";
import { Workspace } from "./sections/workspace-section/workspace";
import { NotificationBell } from "./components/notification-bell";

interface DashboardLayoutProps {
  planId: string;
}

export function DashboardLayout({ planId }: DashboardLayoutProps) {
  const router = useRouter();
  const { currentPlanMeta } = useFinancialStore();
  const [activeSection, setActiveSection] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const permissions = getPermissions(currentPlanMeta);
  useRealtimePermissions(planId);

  if (!currentPlanMeta || currentPlanMeta.id !== planId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader label="Loading plan..." />
      </div>
    );
  }

  const isOwner = currentPlanMeta.isOwner;
  const activeTitle = navItems.find((n) => n.id === activeSection)?.label ?? "Overview";

  const renderSection = () => {
    switch (activeSection) {
      case "overview": return <OverviewSection />;
      case "reports": return <ReportsSection planId={planId} />;
      case "team": return <TeamSection planId={planId} permissions={permissions} />;
      case "expenses": return <RevenueExpenseSection planId={planId} permissions={permissions} />;
      case "event": return <PlanningSection permissions={permissions} />;
      case "workspace": return <Workspace planId={planId} />;
      case "hardware": return <HardwareSection planId={planId} permissions={permissions} />;
      default: return <OverviewSection />;
    }
  };

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block h-screen shrink-0">
        <Sidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          planName={currentPlanMeta.name}
          entityName={currentPlanMeta.name}
          isOwner={isOwner}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />
      </div>

      {/* Mobile Header */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-border bg-background px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push("/plans")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
              <span className="text-xs font-bold text-primary-foreground">$</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-muted-foreground">
                {currentPlanMeta.type === "project" ? "Project" : "Event"}
              </span>
              <span className="text-sm font-semibold text-foreground line-clamp-1">
                {currentPlanMeta.name}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <NotificationBell planId={planId} />
          <Button className="cursor-pointer" variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 z-40 h-full w-64 transform transition-transform duration-200 lg:hidden",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          entityName={currentPlanMeta.name}
          isOwner={isOwner}
        />
      </div>

      {/* Right column: topbar + content, connected to the sidebar (not floating over it) */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="hidden lg:block">
          <Topbar title={activeTitle} planId={planId} />
        </div>

        <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
          <div className="mx-auto max-w-7xl p-6 lg:p-8">{renderSection()}</div>
        </main>
      </div>
    </div>
  );
}