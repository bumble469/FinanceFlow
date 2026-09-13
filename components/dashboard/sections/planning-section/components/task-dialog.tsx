// components/task-dialog.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Task } from "@/lib/types";
import { useEditLock } from "@/hooks/use-edit-lock";
import { EditingPresenceIndicator } from "@/components/shared/editing-presence-indicator";

export interface TaskRequirementInput {
  requireApproval: boolean;
  requireDescription: boolean;
  requireImages: boolean;
  minImages: number | null;
  maxImages: number | null;
  requireVideo: boolean;
  requireDocument: boolean;
  allowMultipleEvidenceTypes: boolean;
}

const DEFAULT_REQUIREMENT: TaskRequirementInput = {
  requireApproval: true,
  requireDescription: false,
  requireImages: false,
  minImages: null,
  maxImages: null,
  requireVideo: false,
  requireDocument: false,
  allowMultipleEvidenceTypes: true,
};

export function TaskDialog({
  open,
  editingTask,
  onClose,
  onSave,
}: {
  open: boolean;
  editingTask?: (Task & { requirement?: TaskRequirementInput | null }) | null;
  onClose: () => void;
  onSave: (data: { title: string; description?: string; dueDate?: string; requirement: TaskRequirementInput }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirement, setRequirement] = useState<TaskRequirementInput>(DEFAULT_REQUIREMENT);
  const [showRequirements, setShowRequirements] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const originalRef = useRef({ title: "", description: "", dueDate: "" });
  const { locked, lockedByName, allowMultipleEditing, otherEditors } = useEditLock(
    "task",
    editingTask?.id ?? null,
    open && !!editingTask
  );

  useEffect(() => {
    if (open) {
      const t = editingTask?.title ?? "";
      const d = editingTask?.description ?? "";
      const due = editingTask?.dueDate ? editingTask.dueDate.split("T")[0] : "";
      setTitle(t);
      setDescription(d);
      setDueDate(due);
      setRequirement(editingTask?.requirement ?? DEFAULT_REQUIREMENT);
      setShowRequirements(false);
      originalRef.current = { title: t, description: d, dueDate: due };
    }
  }, [open, editingTask]);

  if (!open) return null;

  const handleSave = () => {
    if (!title.trim() || locked) return;

    if (editingTask) {
      // Only include fields the user actually changed, so a concurrent edit
      // to a different field (title vs due date, etc.) from another user
      // isn't silently clobbered by this save.
      const payload: { title?: string; description?: string; dueDate?: string; requirement: TaskRequirementInput } = {
        requirement,
      };
      const trimmedTitle = title.trim();
      const trimmedDesc = description.trim() || undefined;
      const nextDue = dueDate || undefined;

      if (trimmedTitle !== originalRef.current.title) payload.title = trimmedTitle;
      if (trimmedDesc !== (originalRef.current.description || undefined)) payload.description = trimmedDesc;
      if (nextDue !== (originalRef.current.dueDate || undefined)) payload.dueDate = nextDue;

      onSave(payload as { title: string; description?: string; dueDate?: string; requirement: TaskRequirementInput });
    } else {
      onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        requirement,
      });
    }
  };

  const patchReq = (patch: Partial<TaskRequirementInput>) => setRequirement((prev) => ({ ...prev, ...patch }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-96 max-h-[90vh] overflow-y-auto rounded-xl border bg-card p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            {editingTask ? "Edit Task" : "New Task"}
          </h3>
          <EditingPresenceIndicator editors={otherEditors} />
        </div>

        {!allowMultipleEditing && locked && (
          <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
            Currently being edited by {lockedByName}. You can view this task but can't save changes until they're done.
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="task-title">Title</Label>
          <Input
            id="task-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") onClose();
            }}
            placeholder="Task title"
            disabled={locked}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <textarea
            id="task-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            placeholder="Add a description..."
            rows={3}
            disabled={locked}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-due">Due date <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={locked}
          />
        </div>

        <div className="rounded-lg border border-border">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium cursor-pointer"
            onClick={() => setShowRequirements((v) => !v)}
          >
            Completion Requirements
            <span className="text-xs text-muted-foreground">{showRequirements ? "Hide" : "Show"}</span>
          </button>

          {showRequirements && (
            <div className="space-y-3 border-t border-border p-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={requirement.requireApproval}
                  onCheckedChange={(v) => patchReq({ requireApproval: !!v })}
                  className="border-white data-[state=checked]:border-white"
                />
                Require approval before completion
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={requirement.requireDescription}
                  onCheckedChange={(v) => patchReq({ requireDescription: !!v })}
                  className="border-white data-[state=checked]:border-white"
                />
                Require description on submission
              </label>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={requirement.requireImages}
                    onCheckedChange={(v) => patchReq({ requireImages: !!v })}
                    className="border-white data-[state=checked]:border-white"
                  />
                  Require image upload
                </label>
                {requirement.requireImages && (
                  <div className="flex items-center gap-2 pl-6">
                    <Input
                      type="number"
                      min={0}
                      placeholder="Min"
                      className="h-7 w-20 text-xs"
                      value={requirement.minImages ?? ""}
                      onChange={(e) => patchReq({ minImages: e.target.value ? Number(e.target.value) : null })}
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Max"
                      className="h-7 w-20 text-xs"
                      value={requirement.maxImages ?? ""}
                      onChange={(e) => patchReq({ maxImages: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={requirement.requireVideo}
                  onCheckedChange={(v) => patchReq({ requireVideo: !!v })}
                  className="border-white data-[state=checked]:border-white"
                />
                Require video upload
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={requirement.requireDocument}
                  onCheckedChange={(v) => patchReq({ requireDocument: !!v })}
                  className="border-white data-[state=checked]:border-white"
                />
                Require document/file upload
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={requirement.allowMultipleEvidenceTypes}
                  onCheckedChange={(v) => patchReq({ allowMultipleEvidenceTypes: !!v })}
                  className="border-white data-[state=checked]:border-white"
                />
                Allow multiple evidence types together
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" className="cursor-pointer" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!title.trim() || locked} onClick={handleSave} className="cursor-pointer">
            {editingTask ? "Save changes" : "Add task"}
          </Button>
        </div>
      </div>
    </div>
  );
}