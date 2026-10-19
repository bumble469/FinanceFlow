"use client";

import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export const SETTINGS_FIELD = "h-10 rounded-lg border-border bg-background shadow-xs";
export const SETTINGS_TEXTAREA = "rounded-lg border-border bg-background shadow-xs";

const InSectionContext = createContext(false);

export function SettingsSection({
  title,
  description,
  action,
  tone = "default",
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "default" | "danger";
  className?: string;
  children: ReactNode;
}) {
  const danger = tone === "danger";
  return (
    <InSectionContext.Provider value={true}>
      <section
        className={cn(
          "w-full overflow-hidden rounded-xl border bg-card shadow-xs",
          danger ? "border-destructive/40" : "border-border",
          className
        )}
      >
        <div
          className={cn(
            "flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6",
            danger ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30"
          )}
        >
          <div className="min-w-0">
            <h2 className={cn("text-base lg:text-xl sm:text-md font-bold", danger ? "text-destructive" : "text-foreground")}>
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        <div className="divide-y divide-border">{children}</div>
      </section>
    </InSectionContext.Provider>
  );
}

export function SettingsRow({
  label,
  description,
  htmlFor,
  wide,
  action,
  className,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  wide?: boolean; // let the right column use the full width (e.g. theme cards)
  action?: boolean; // row whose control is a button/switch: pin it to the right edge
  className?: string;
  children?: ReactNode;
}) {
  const labelBlock = (
    <div className="min-w-0 space-y-0.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );

  if (action) {
    return (
      <div
        className={cn(
          "flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-6",
          className
        )}
      >
        {labelBlock}
        <div className="shrink-0">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-3 px-5 py-5 sm:px-6 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-8",
        className
      )}
    >
      {labelBlock}
      <div className={cn("min-w-0", !wide && "max-w-[512px]")}>{children}</div>
    </div>
  );
}

export function SettingsFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end gap-3 border-t border-border bg-muted/20 px-5 py-4 sm:px-6">
      {children}
    </div>
  );
}

export function SettingsMessage({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "error";
}) {
  const inSection = useContext(InSectionContext);
  return (
    <p
      className={cn(
        "text-sm",
        tone === "error" ? "text-destructive" : "text-muted-foreground",
        inSection
          ? "px-5 py-6 sm:px-6"
          : "rounded-xl border border-border bg-card px-6 py-6 shadow-xs"
      )}
    >
      {children}
    </p>
  );
}