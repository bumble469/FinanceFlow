"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

interface Summary {
  id: string;
  name: string;
  type: string;
  _count: { tasks: number; milestones: number };
}

export function ContextSummaryCard({ conversationId, workItemId }: { conversationId: string; workItemId: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setExpanded(false);
    authClient
      .request(`/api/conversations/${conversationId}/context-summary`, {
        method: "GET",
        params: { workItemId },
      })
      .then((res) => {
        if (!cancelled) setData(res.data.data);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [conversationId, workItemId]);

  if (!data) return null;

  return (
    <div className="px-4 py-2 border-b border-border shrink-0">
      <div className="rounded-xl border border-border bg-card p-3">
        {/* Mobile: one-line toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="md:hidden flex w-full items-center justify-between gap-2 text-left cursor-pointer"
        >
          <span className="text-xs font-medium truncate">
            {data.name} · {data._count.tasks} tasks · {data._count.milestones} milestones
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-180")} />
        </button>

        <div className={cn("md:block", expanded ? "block mt-2" : "hidden")}>
          <p className="hidden md:block text-sm font-semibold">{data.name}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{data._count.tasks} Tasks</span>
            <span>{data._count.milestones} Milestones</span>
          </div>
          <Link
            href={`/plans/${data.id}`}
            className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
          >
            View project →
          </Link>
        </div>
      </div>
    </div>
  );
}