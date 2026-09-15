"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConnectionTab = "all" | "direct" | "groups" | "requests";

const TABS: { key: ConnectionTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "direct", label: "Direct" },
  { key: "groups", label: "Groups" },
  { key: "requests", label: "Requests" },
];

export function TabSelector({ active, onChange }: { active: ConnectionTab; onChange: (t: ConnectionTab) => void }) {
  const currentIndex = TABS.findIndex((t) => t.key === active);

  const cycle = (dir: 1 | -1) => {
    const next = (currentIndex + dir + TABS.length) % TABS.length;
    onChange(TABS[next].key);
  };

  return (
    <>
      {/* Desktop: small pill row, tight top-left margins */}
      <div className="hidden md:flex items-center gap-1 pt-2 pl-2 pb-1 my-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer",
              active === t.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Mobile: arrowed cycle switcher */}
      <div className="flex md:hidden items-center justify-between px-2 pt-2 pb-1">
        <button onClick={() => cycle(-1)} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted cursor-pointer">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">{TABS[currentIndex].label}</span>
        <button onClick={() => cycle(1)} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted cursor-pointer">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}