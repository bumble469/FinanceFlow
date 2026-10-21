import type { ReactNode } from "react";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/**
 * The single empty state used across every Overview tab.
 *
 * Previously each tab hand-rolled its own `<p className="text-sm text-muted-foreground text-center py-10">`,
 * which meant the same "no data" moment looked different in every view. This
 * matches the Summary tab's treatment: a muted icon disc above a short line
 * of copy, centred in the space the content would have occupied.
 */
export function EmptyState({
  icon,
  title,
  description,
  tone = "neutral",
}: {
  icon?: ReactNode;
  title?: string;
  description?: string;
  /** `success` for "nothing wrong here" panels, `neutral` for "no data yet" */
  tone?: "neutral" | "success";
}) {
  return (
    <Empty className="gap-2 border-0 p-0 py-8">
      {icon && (
        <EmptyMedia
          variant="icon"
          className={cn(
            "size-10 rounded-full",
            tone === "success" ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"
          )}
        >
          {icon}
        </EmptyMedia>
      )}
      {title && <EmptyTitle className="text-sm font-medium text-foreground">{title}</EmptyTitle>}
      {description && <EmptyDescription>{description}</EmptyDescription>}
    </Empty>
  );
}
