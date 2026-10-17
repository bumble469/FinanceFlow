"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { NotificationsDialog } from "../dialogs/notifications-dialog";
import { Button } from "@/components/ui/button";

export function NotificationBell({ planId }: { planId: string | undefined }) {
  const [open, setOpen] = useState(false);
  const { unreadCount, unreadGeneral, unreadPersonal, general, personal, loading, fetchTab, markRead, markAllRead } = useNotifications(planId);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="relative cursor-pointer flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted/60 transition-colors"
        title="Notifications"
        variant="ghost"
      >
        <Bell className="h-4.5 w-4.5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      <NotificationsDialog
        open={open}
        onOpenChange={setOpen}
        general={general}
        personal={personal}
        unreadGeneral={unreadGeneral}
        unreadPersonal={unreadPersonal}
        loading={loading}
        onLoadTab={fetchTab}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
      />
    </>
  );
}