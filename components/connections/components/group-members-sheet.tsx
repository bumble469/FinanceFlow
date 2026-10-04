"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { humanize, getRoleColor } from "@/lib/chat-types";
import type { GroupMemberView } from "@/lib/group";

export function GroupMembersSheet({ members }: { members: GroupMemberView[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full" onClick={() => setOpen(true)}>
        <Users className="h-4 w-4" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-80 p-4 flex flex-col h-full">
          <SheetHeader className="p-0 pb-3 shrink-0">
            <SheetTitle>Members ({members.length})</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0 -mx-2 px-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-semibold text-primary overflow-hidden border border-primary/20">
                  {m.image ? (
                    <img src={m.image} alt={m.name ?? m.email} className="h-full w-full object-cover" />
                  ) : (
                    (m.name || m.email)[0]?.toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{m.name || m.email}</p>
                  <span className={`inline-flex mt-1 text-[9px] px-1.5 py-0.5 rounded-full border font-medium uppercase tracking-wider ${getRoleColor(m.role)}`}>
                    {humanize(m.role)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}