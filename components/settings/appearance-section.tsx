"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { SettingsSection, SettingsRow } from "@/components/settings/settings-layout";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  {
    value: "light",
    label: "Light",
    description: "Crisp, bright interfaces for daytime focus",
    icon: Sun,
    preview: {
      bg: "bg-slate-50",
      sidebar: "bg-slate-100 border-slate-200",
      card: "bg-white border-slate-200 shadow-sm",
      text: "bg-slate-800",
      muted: "bg-slate-300",
      accent: "bg-blue-600",
    },
  },
  {
    value: "dark",
    label: "Dark",
    description: "Deep, sleek tones that are easy on the eyes",
    icon: Moon,
    preview: {
      bg: "bg-background",
      sidebar: "bg-card border-zinc-800",
      card: "bg-card border-zinc-800 shadow-sm",
      text: "bg-zinc-100",
      muted: "bg-zinc-700",
      accent: "bg-blue-500",
    },
  },
  {
    value: "system",
    label: "System",
    description: "Automatically matches your device settings",
    icon: Monitor,
    preview: {
      bg: "bg-gradient-to-r from-slate-100 to-zinc-900",
      sidebar: "bg-gradient-to-r from-slate-200 to-zinc-800 border-slate-300",
      card: "bg-gradient-to-r from-white to-zinc-850 border-slate-200 shadow-sm",
      text: "bg-gradient-to-r from-slate-800 to-zinc-200",
      muted: "bg-gradient-to-r from-slate-300 to-zinc-600",
      accent: "bg-blue-500",
    },
  },
];

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <SettingsSection
      title="Appearance"
      description="Customize how FinanceFlow looks and feels across your devices."
    >
      <SettingsRow label="Theme mode" description="Choose how FinanceFlow looks on this device." wide>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = mounted && theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                    "group relative flex flex-col text-left rounded-xl border p-4 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active
                      ? "border-primary bg-primary/[0.04] shadow-sm ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-border/80 hover:bg-muted/40"
                  )}
                >
                  {/* Visual Preview Miniature */}
                  <div
                    className={cn(
                      "relative mb-3 h-24 w-full overflow-hidden rounded-lg border p-2 flex gap-1.5 transition-transform duration-200 group-hover:scale-[1.02]",
                      opt.preview.bg
                    )}
                  >
                    {/* Sidebar */}
                    <div className={cn("w-1/4 h-full rounded flex flex-col gap-1 p-1 border", opt.preview.sidebar)}>
                      <div className={cn("h-1.5 w-3/4 rounded-sm", opt.preview.accent)} />
                      <div className={cn("h-1 w-full rounded-sm opacity-60", opt.preview.muted)} />
                      <div className={cn("h-1 w-2/3 rounded-sm opacity-60", opt.preview.muted)} />
                    </div>
                    {/* Main canvas */}
                    <div className="flex-1 flex flex-col gap-1.5">
                      <div className={cn("h-2.5 w-1/2 rounded-sm", opt.preview.text)} />
                      <div className={cn("flex-1 rounded p-1.5 flex flex-col justify-between border", opt.preview.card)}>
                        <div className={cn("h-1.5 w-3/4 rounded-sm", opt.preview.muted)} />
                        <div className="flex items-center gap-1">
                          <div className={cn("h-1 w-1/3 rounded-sm", opt.preview.muted)} />
                          <div className={cn("h-1 w-1/4 rounded-sm", opt.preview.accent)} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("text-sm font-semibold", active ? "text-foreground" : "text-muted-foreground")}>
                        {opt.label}
                      </span>
                    </div>
                    {active && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {opt.description}
                  </p>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground pt-1">
            {mounted && theme === "system"
              ? "FinanceFlow will automatically switch between light and dark mode to match your system preferences."
              : mounted && theme === "dark"
              ? "Dark mode is currently active, providing high contrast and low glare in dim environments."
              : "Light mode is currently active, optimized for bright environments."}
          </p>
        </div>
      </SettingsRow>
    </SettingsSection>
  );
}
