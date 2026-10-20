"use client";

import { cn } from "@/lib/utils";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Loader } from "@/components/shared/loader";
import { Inbox, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

interface CardPrimitiveProps {
  title: string;
  subtitle?: string;
  filters?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  error?: boolean;
  children?: ReactNode;
}

export function CardPrimitive({ title, subtitle, filters, icon, loading, empty, error, children }: CardPrimitiveProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
        </div>
        <div className="flex justify-center py-8">
          <Loader size="30" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
        </div>
        <Empty className="border-0 p-0">
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <TriangleAlert className="size-5" />
          </EmptyMedia>
          <EmptyDescription>
            Couldn&apos;t load this view. Please try again.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
        </div>
        <Empty className="border-0 p-0">
          <EmptyMedia variant="icon">
            <Inbox className="size-5" />
          </EmptyMedia>
          <EmptyDescription>No data yet</EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4")}>
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h3 className="text-sm font-medium">{title}</h3>
        {subtitle && <span className="text-xs font-normal text-muted-foreground">{subtitle}</span>}
      </div>
      {filters && <div className="mb-3">{filters}</div>}
      {children}
    </div>
  );
}
