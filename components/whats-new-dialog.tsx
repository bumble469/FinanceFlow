"use client";
import { Sparkles, Plus, TrendingUp, Wrench, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { changelog } from "@/lib/changeLog";

const TAG_STYLES: Record<string, { icon: LucideIcon; badge: string; dot: string }> = {
  New: {
    icon: Plus,
    badge: "bg-primary-500/10 text-primary-600 ring-emerald-500/20 dark:text-primary-400",
    dot: "bg-primary-500",
  },
  Improved: {
    icon: TrendingUp,
    badge: "bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  Fixed: {
    icon: Wrench,
    badge: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
    dot: "bg-amber-500",
  },
};

export function WhatsNewDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {/* Header */}
        <DialogHeader className="border-b bg-muted/30 px-8 py-6 text-left">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold tracking-tight">What's new</DialogTitle>
              <DialogDescription className="mt-0.5">
                The latest updates and improvements to FinanceFlow.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable timeline */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="relative space-y-8 border-l border-border pl-8">
            {changelog.map((e, i) => {
              const style = TAG_STYLES[e.tag] ?? TAG_STYLES.New;
              const Icon = style.icon;

              return (
                <section key={e.id} className="relative">
                  {/* Timeline dot */}
                  <span
                    className={`absolute -left-[37px] top-6 h-3 w-3 rounded-full ring-4 ring-background ${style.dot}`}
                  />

                  <article className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style.badge}`}
                      >
                        <Icon className="h-3 w-3" />
                        {e.tag}
                      </span>
                      {i === 0 && (
                        <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                          Latest
                        </span>
                      )}
                      <span className="ml-auto text-sm text-muted-foreground">{e.date}</span>
                    </div>

                    <h3 className="text-lg font-semibold tracking-tight">{e.title}</h3>

                    <ul className="mt-3 space-y-2">
                      {e.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                </section>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}