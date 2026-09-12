"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, LayoutGrid, Cable } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/plans", label: "Plans", icon: LayoutGrid },
  { href: "/connections", label: "Connections", icon: Cable },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-sidebar-border bg-sidebar py-2">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg px-4 py-1.5 text-[11px]",
              isActive ? "text-primary" : "text-sidebar-foreground/60"
            )}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}