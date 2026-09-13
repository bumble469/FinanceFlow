"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Module } from "@/lib/types";
import { useEditLock } from "@/hooks/use-edit-lock";
import { EditingPresenceIndicator } from "@/components/shared/editing-presence-indicator";

export function ModuleDialog({
  open,
  editingModule,
  onClose,
  onSave,
}: {
  open: boolean;
  editingModule?: Module | null;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const { locked, lockedByName, otherEditors } = useEditLock(
    "phase",
    editingModule?.id ?? null,
    open && !!editingModule
  );

  useEffect(() => {
    if (open) setName(editingModule?.name ?? "");
  }, [open, editingModule]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-80 rounded-xl border bg-card p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            {editingModule ? "Rename Module" : "New Module"}
          </h3>
          <EditingPresenceIndicator editors={otherEditors} />
        </div>

        {locked && (
          <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
            Currently being edited by {lockedByName}.
          </div>
        )}

        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim() && !locked) onSave(name.trim());
            if (e.key === "Escape") onClose();
          }}
          placeholder="Module name"
          disabled={locked}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" className="cursor-pointer" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!name.trim() || locked}
            onClick={() => onSave(name.trim())}
            className="cursor-pointer hover:bg-green-800"
          >
            {editingModule ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}