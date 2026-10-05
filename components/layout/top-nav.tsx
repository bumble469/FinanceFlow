"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, Settings, Bell } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useFinancialStore } from "@/lib/store";

// IMPORTANT: Adjust these import paths to match where you saved these files
import { useNotifications } from "@/hooks/use-notifications"; 
import { NotificationsDialog } from "../dashboard/dialogs/notifications-dialog";

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const currentUser = useFinancialStore((s) => s.currentUser);

  // 1. Local state to control the dialog visibility
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // 2. Initialize the hook WITHOUT a planId to fetch global notifications
  const {
    unreadCount,
    unreadGeneral,
    unreadPersonal,
    general,
    personal,
    loading,
    fetchTab,
    markRead,
    markAllRead,
  } = useNotifications();

  if (pathname.startsWith("/plans/") && !pathname.endsWith("/plans")) {
    return null;
  }

  const initials =
    currentUser?.name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() ||
    currentUser?.email?.[0]?.toUpperCase() ||
    "U";

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search plans, tasks..."
          className="w-full rounded-full border border-border bg-secondary/50 py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* 3. Wire up the Bell button & add an unread indicator badge */}
        <button
          title="Notifications"
          onClick={() => setIsNotificationsOpen(true)}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
        >
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
          )}
        </button>

        <button
          title="Settings"
          onClick={() => router.push("/settings")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
        >
          <Settings className="h-4.5 w-4.5" />
        </button>

        <button
          title={currentUser?.name || "Account"}
          onClick={() => router.push("/settings")}
          className="ml-1 cursor-pointer"
        >
          <Avatar className="h-9 w-9 border border-border">
            <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </div>

      {/* 4. Render the Dialog and pass the hook data into it */}
      <NotificationsDialog
        open={isNotificationsOpen}
        onOpenChange={setIsNotificationsOpen}
        contextLabel="System Notifications"
        general={general}
        personal={personal}
        unreadGeneral={unreadGeneral}
        unreadPersonal={unreadPersonal}
        loading={loading}
        onLoadTab={fetchTab}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
      />
    </header>
  );
}