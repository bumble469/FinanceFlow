"use client";
import { useState } from "react";
import { Settings } from "lucide-react";
import { NotificationBell } from "../components/notification-bell";
import { PlanSettingsDialog } from "../components/plan-settings-dialog";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  title: string;
  planId: string;
}

export function Topbar({ title, planId }: TopbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="flex items-center gap-1">
        <NotificationBell planId={planId} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Plan settings"
          onClick={() => setSettingsOpen(true)}
          className="h-9 w-9 hover:bg-blue-600 hover:text-white cursor-pointer"
        >
          <Settings className="h-4.5 w-4.5" />
        </Button>
      </div>

      <PlanSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} planId={planId} />
    </header>
  );
}
