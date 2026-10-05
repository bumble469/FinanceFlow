"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { SharedWorkItem } from "@/lib/chat-store";

interface ContextSelectorProps {
  items: SharedWorkItem[];
  value: string | null; // null = General
  onChange: (workItemId: string | null) => void;
  loading?: boolean;
}

export function ContextSelector({ items, value, onChange, loading }: ContextSelectorProps) {
  const [open, setOpen] = useState(false);
  const active = items.find((i) => i.id === value);
  const label = active ? active.name : "General Chat";
  const disabled = loading || items.length === 0;

  const pick = (id: string | null) => {
    setOpen(false);
    if (id !== value) onChange(id);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0 bg-card/50">
      <span className="text-xs text-muted-foreground">Context:</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2.5 py-1 text-xs font-medium text-foreground",
              disabled ? "opacity-60 cursor-default" : "hover:bg-secondary cursor-pointer"
            )}
          >
            <span className="max-w-[180px] truncate">{label}</span>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1.5">
          <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Conversation context
          </p>
          {items.map((w) => (
            <button
              key={w.id}
              onClick={() => pick(w.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted cursor-pointer"
            >
              <Check className={cn("h-3.5 w-3.5 shrink-0", value === w.id ? "opacity-100 text-primary" : "opacity-0")} />
              <span className="truncate flex-1">{w.name}</span>
              <span className="text-[10px] text-muted-foreground">{w.type}</span>
            </button>
          ))}
          <div className="my-1 h-px bg-border" />
          <button
            onClick={() => pick(null)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted cursor-pointer"
          >
            <Check className={cn("h-3.5 w-3.5 shrink-0", value === null ? "opacity-100 text-primary" : "opacity-0")} />
            <span>General Chat</span>
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}