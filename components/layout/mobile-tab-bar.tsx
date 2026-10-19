"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, LayoutGrid, Cable } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnectionPrefs } from "@/hooks/use-connection-prefs";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/plans", label: "Plans", icon: LayoutGrid },
  { href: "/connections", label: "Connections", icon: Cable },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { prefs, unreadCount } = useConnectionPrefs();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-sidebar-border bg-sidebar py-2">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        const badge =
          item.href === "/connections" && prefs.unreadBadgeEnabled && unreadCount > 0
            ? unreadCount
            : 0;
        return (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-lg px-4 py-1.5 text-[11px]",
              isActive ? "text-primary" : "text-sidebar-foreground/60"
            )}
          >
            <span className="relative">
              <Icon className="h-5 w-5" />
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}