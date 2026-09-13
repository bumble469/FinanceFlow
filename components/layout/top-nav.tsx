"use client";

import { useRouter, usePathname } from "next/navigation";
import { Search, Settings, Bell } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useFinancialStore } from "@/lib/store";

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const currentUser = useFinancialStore((s) => s.currentUser);

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
        <button
          title="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
        >
          <Bell className="h-4.5 w-4.5" />
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
    </header>
  );
}