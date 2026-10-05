"use client";

import {
  ArrowUpRight, Building2, CheckSquare, FileText, Flag, Lock, Receipt, Wallet, X, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { humanize, type ChatEntity, type EntityType } from "@/lib/chat-types";

export const ENTITY_META: Record<EntityType, { label: string; Icon: LucideIcon; accent: string }> = {
  task: { label: "Task", Icon: CheckSquare, accent: "text-blue-500" },
  milestone: { label: "Milestone", Icon: Flag, accent: "text-violet-500" },
  department: { label: "Department", Icon: Building2, accent: "text-orange-500" },
  expense: { label: "Expense", Icon: Receipt, accent: "text-red-500" },
  document: { label: "Document", Icon: FileText, accent: "text-sky-500" },
  income: { label: "Income", Icon: Wallet, accent: "text-emerald-500" },
};

function formatDue(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return "Today";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

interface EntityCardProps {
  entity: ChatEntity;
  compact?: boolean;
  onRemove?: () => void; // ✕ (composer preview)
  onClick?: () => void; // whole card (palette selection)
  onGoTo?: () => void; // ↗ arrow (message bubble)
  isOwn?: boolean;
}

export function EntityCard({ entity, compact, onRemove, onClick, onGoTo, isOwn }: EntityCardProps) {
  const { label, Icon, accent } = ENTITY_META[entity.type];

  const base = cn(
    "relative w-full rounded-xl border text-left",
    isOwn ? "bg-[#027788] text-white border-primary-foreground/20" : "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5",
    compact ? "px-3 py-2" : "px-3 py-2.5",
    onClick && "cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
  );

  const actions =
    onGoTo || onRemove ? (
      <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5">
        {onGoTo && (
          <button
            type="button"
            title="Go to item"
            aria-label={`Go to ${label.toLowerCase()}`}
            onClick={(e) => {
              e.stopPropagation();
              onGoTo();
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            aria-label="Remove attachment"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    ) : null;

  if ("unavailable" in entity) {
    return (
      <div className={cn(base, "flex items-center gap-2 opacity-70")}>
        <Lock className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs">{label} no longer available</span>
        {onRemove && actions}
      </div>
    );
  }

  const due = formatDue(entity.dueDate);

  return (
    <div className={base} onClick={onClick} role={onClick ? "button" : undefined}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium opacity-70">
        <Icon className={cn("h-3 w-3", accent)} />
        {label}
      </div>
      <p className="text-sm font-semibold truncate pr-14">{entity.title}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] opacity-70">
        {due && <span>Due: {due}</span>}
        {entity.status && (
          <span className="rounded-full bg-black/10 dark:bg-white/10 px-1.5 py-0.5 font-medium">
            {humanize(entity.status)}
          </span>
        )}
        {entity.details.map((d) => (
          <span key={d} className="truncate max-w-[200px]">
            {d}
          </span>
        ))}
      </div>
      {actions}
    </div>
  );
}