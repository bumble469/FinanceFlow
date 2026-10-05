"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck } from "lucide-react";
import type { NotificationItem } from "@/hooks/use-notifications";

interface NotificationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextLabel?: string; // e.g. "System" or "Plan"
  general: NotificationItem[];
  personal: NotificationItem[];
  unreadGeneral: number;
  unreadPersonal: number;
  loading: boolean;
  onLoadTab: (scope: "GENERAL" | "PERSONAL") => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: (scope?: "GENERAL" | "PERSONAL") => void;
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function NotificationList({
  items,
  onMarkRead,
}: {
  items: NotificationItem[];
  onMarkRead: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nothing here yet.
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {items.map((n) => (
        <button
          key={n.id}
          onClick={() => !n.isRead && onMarkRead(n.id)}
          className={cn(
            "w-full text-left rounded-lg border px-3 py-2.5 transition-colors",
            n.isRead ? "border-border bg-card" : "border-primary/30 bg-primary/5 hover:bg-primary/10"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{n.title}</p>
            {!n.isRead && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
        </button>
      ))}
    </div>
  );
}

export function NotificationsDialog({
  open,
  onOpenChange,
  contextLabel = "Notifications", // Defaults to "Notifications"
  general,
  personal,
  unreadGeneral,
  unreadPersonal,
  loading,
  onLoadTab,
  onMarkRead,
  onMarkAllRead,
}: NotificationsDialogProps) {
  const [tab, setTab] = useState<"GENERAL" | "PERSONAL">("PERSONAL");

  useEffect(() => {
    if (open) onLoadTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[90vw] max-h-[85vh] flex flex-col">
        <DialogHeader className="pr-10">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              {contextLabel}
            </DialogTitle>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs cursor-pointer" onClick={() => onMarkAllRead(tab)}>
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          </div>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border">
          {([
            { key: "PERSONAL", label: "Associated with me", unread: unreadPersonal },
            { key: "GENERAL", label: "General", unread: unreadGeneral },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {t.unread > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
                  {t.unread > 99 ? "99+" : t.unread}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pt-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-12">Loading...</p>
          ) : (
            <NotificationList items={tab === "GENERAL" ? general : personal} onMarkRead={onMarkRead} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}