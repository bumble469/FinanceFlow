"use client";
import { useState } from "react";
import { Users } from "lucide-react";
import type { Editor } from "@/hooks/use-edit-lock";

export function EditingPresenceIndicator({ editors }: { editors: Editor[] }) {
  const [expanded, setExpanded] = useState(false);

  if (editors.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 rounded-full bg-yellow-500/15 px-2.5 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-400 animate-pulse cursor-pointer"
      >
        <Users className="h-3 w-3" />
        {editors.length} editing
      </button>

      {expanded && (
        <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-md border border-border bg-popover p-2 shadow-md">
          <p className="text-xs font-medium text-muted-foreground mb-1">Currently editing:</p>
          {editors.map((e) => (
            <p key={e.userId} className="text-xs text-foreground py-0.5">
              {e.userName}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
