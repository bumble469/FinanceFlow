"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { OverviewTabConfig } from "../lib/tab-config";

interface TabBarProps {
  activeTab: string;
  /** the tabs this plan can show — already filtered by plan type + finance */
  tabs: OverviewTabConfig[];
}

export function TabBar({ activeTab, tabs }: TabBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const setQueryParam = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const move = (dir: 1 | -1) => {
    const idx = tabs.findIndex((t) => t.id === activeTab);
    if (idx === -1 || tabs.length === 0) return;
    const nextIdx = (idx + dir + tabs.length) % tabs.length;
    setQueryParam(tabs[nextIdx].id);
  };

  if (tabs.length === 0) return null;

  return (
    <div className="overflow-x-auto w-fit">
      <ul role="tablist" className="flex gap-1" data-slot="tab-list">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <li key={tab.id} className="flex items-center">
              <button
                role="tab"
                type="button"
                aria-selected={isActive}
                className={cn(
                  "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-[color,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50",
                  isActive
                    ? "bg-background text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => setQueryParam(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") {
                    e.preventDefault();
                    move(1);
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    move(-1);
                  }
                }}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
