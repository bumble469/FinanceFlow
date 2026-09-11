"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { Department, Task, Milestone, MilestoneFormData, MilestoneStatus } from "@/lib/types";
import { useEditLock } from "@/hooks/use-edit-lock";
import { EditingPresenceIndicator } from "@/components/shared/editing-presence-indicator";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Milestone | null;
  departments: Department[];
  availableTasks: Task[];
  allMilestones: Milestone[];
  onClose: () => void;
  onCreate: (data: MilestoneFormData) => Promise<void>;
  onUpdate: (id: string, data: MilestoneFormData) => Promise<void>;
}

// ─── constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: MilestoneStatus; label: string }[] = [
  { value: "UPCOMING", label: "Upcoming" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "ACHIEVED", label: "Achieved" },
  { value: "MISSED", label: "Missed" },
];

const EMPTY: MilestoneFormData = {
  title: "",
  description: "",
  dueDate: "",
  status: "UPCOMING",
  departmentId: "",
  phaseId: "",
  taskIds: [],
};

// ─── component ───────────────────────────────────────────────────────────────

export function MilestoneDialog({
  open,
  onOpenChange,
  editing,
  departments,
  availableTasks,
  allMilestones,
  onClose,
  onCreate,
  onUpdate,
}: Props) {
  const [form, setForm] = useState<MilestoneFormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof MilestoneFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { locked, lockedByName, otherEditors } = useEditLock(
    "milestone",
    editing?.id ?? null,
    open && !!editing
  );
  const originalRef = useRef<MilestoneFormData>(EMPTY);

  const claimedElsewhere = new Map<string, string>();
  for (const m of allMilestones) {
    if (editing && m.id === editing.id) continue; // this milestone's own tasks are fine to keep
    for (const t of m.tasks) {
      claimedElsewhere.set(t.id, m.title);
    }
  }

  const filteredTasks = availableTasks.filter((t) => {
    if (form.phaseId && t.phaseId !== form.phaseId) return false;
    if (!form.phaseId && form.departmentId && t.departmentId !== form.departmentId) return false;
    return true;
  });

  useEffect(() => {
    if (editing) {
      const initial: MilestoneFormData = {
        title: editing.title,
        description: editing.description ?? "",
        dueDate: editing.dueDate ? editing.dueDate.split("T")[0] : "",
        status: editing.status,
        taskIds: editing.tasks.map((t) => t.id),
      };
      setForm(initial);
      originalRef.current = initial;
    } else {
      setForm(EMPTY);
      originalRef.current = EMPTY;
    }
    setErrors({});
  }, [editing, open]);

  function checkDueDateConflict(dueDate: string, taskIds: string[]): string | undefined {
    if (!dueDate || taskIds.length === 0) return undefined;
    const milestoneDate = new Date(dueDate);
    const offender = availableTasks.find(
      (t) => taskIds.includes(t.id) && t.dueDate && new Date(t.dueDate) > milestoneDate
    );
    if (!offender) return undefined;
    return `"${offender.title}" is due ${new Date(offender.dueDate!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, after this milestone's date`;
  }

  // Live check — fires the moment the due date or task selection changes, not on submit
  useEffect(() => {
    const conflict = checkDueDateConflict(form.dueDate ?? "", form.taskIds);
    setErrors((e) => ({ ...e, dueDate: conflict }));
  }, [form.dueDate, form.taskIds]);

  function validate() {
    const e: Partial<Record<keyof MilestoneFormData, string>> = { ...errors };
    if (!form.title.trim()) e.title = "Title is required";
    else e.title = undefined;

    const conflict = checkDueDateConflict(form.dueDate ?? "", form.taskIds);
    e.dueDate = conflict;

    setErrors(e);
    return !e.title && !e.dueDate;
  }

  async function handleSubmit() {
    if (!validate() || locked) return;
    setIsSubmitting(true);

    try {
      if (editing) {
        const orig = originalRef.current;
        const diff: Partial<MilestoneFormData> = {};
        if (form.title.trim() !== orig.title) diff.title = form.title.trim();
        if ((form.description?.trim() || undefined) !== (orig.description || undefined)) {
          diff.description = form.description?.trim() || undefined;
        }
        if ((form.dueDate || undefined) !== (orig.dueDate || undefined)) diff.dueDate = form.dueDate || undefined;
        if (form.status !== orig.status) diff.status = form.status;
        if (form.departmentId !== orig.departmentId) diff.departmentId = form.departmentId || undefined;
        if (form.phaseId !== orig.phaseId) diff.phaseId = form.phaseId || undefined;
        if (JSON.stringify(form.taskIds) !== JSON.stringify(orig.taskIds)) diff.taskIds = form.taskIds;

        await onUpdate(editing.id, diff as MilestoneFormData);
      } else {
        await onCreate({
          title: form.title.trim(),
          description: form.description?.trim() || undefined,
          dueDate: form.dueDate || undefined,
          status: form.status,
          departmentId: form.departmentId || undefined,
          phaseId: form.phaseId || undefined,
          taskIds: form.taskIds,
        });
      }
      onClose();
    } catch (err) {
      console.error("Milestone submit failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  }


  function set<K extends keyof MilestoneFormData>(key: K, val: MilestoneFormData[K]) {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function toggleTask(taskId: string) {
    setForm((f) => ({
      ...f,
      taskIds: f.taskIds.includes(taskId)
        ? f.taskIds.filter((id) => id !== taskId)
        : [...f.taskIds, taskId],
    }));
  }

  // when dept changes, reset phase and tasks
  function handleDeptChange(val: string) {
    setForm((f) => ({
      ...f,
      departmentId: val === "none" ? "" : val,
      phaseId: "",
      taskIds: [],
    }));
  }

  // when phase changes, reset tasks
  function handlePhaseChange(val: string) {
    setForm((f) => ({
      ...f,
      phaseId: val === "none" ? "" : val,
      taskIds: [],
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{editing ? "Edit milestone" : "Add milestone"}</DialogTitle>
            <EditingPresenceIndicator editors={otherEditors} />
          </div>
        </DialogHeader>

        {locked && (
          <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
            Currently being edited by {lockedByName}. You can view this milestone but can't save changes until they're done.
          </div>
        )}

        <div className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              placeholder="e.g. Marketing assets finalized"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>
              Description{" "}
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              placeholder="What needs to happen for this milestone to be achieved?"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Due date + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Due date{" "}
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
                className={errors.dueDate ? "border-destructive" : ""}
              />
              {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as MilestoneStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <Label>
              Department{" "}
              <span className="text-xs font-normal text-muted-foreground">(filter on dept)</span>
            </Label>
            <Select
              value={form.departmentId || "none"}
              onValueChange={handleDeptChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="No department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No department</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Linked tasks */}
          <div className="space-y-1.5">
            <Label>
              Link tasks{" "}
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            {filteredTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                {form.departmentId
                  ? "No tasks found for the selected scope"
                  : "Select a department or phase to filter tasks, or all tasks will show here"}
              </p>
            ) : (
              <div className="rounded-lg border border-border divide-y divide-border max-h-48 overflow-y-auto">
                {filteredTasks.map((task) => {
                  const claimedBy = claimedElsewhere.get(task.id);
                  const disabled = !!claimedBy;
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5",
                        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/30 cursor-pointer"
                      )}
                      onClick={() => !disabled && toggleTask(task.id)}
                    >
                      <Checkbox
                        checked={form.taskIds.includes(task.id)}
                        disabled={disabled}
                        onCheckedChange={() => !disabled && toggleTask(task.id)}
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {disabled
                            ? `Already in "${claimedBy}"`
                            : task.status.toLowerCase().replace("_", " ")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {form.taskIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {form.taskIds.length} task{form.taskIds.length > 1 ? "s" : ""} linked
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="cursor-pointer hover:text-gray-400">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || locked} className="cursor-pointer hover:text-gray-100">
              {isSubmitting
                ? editing ? "Updating..." : "Adding..."
                : editing ? "Update milestone" : "Add milestone"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}