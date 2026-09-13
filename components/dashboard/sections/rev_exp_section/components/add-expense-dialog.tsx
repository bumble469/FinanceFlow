"use client";

import { useEffect, useState } from "react";
import { useFinancialStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { Expense, ExpenseCategory, Stall } from "@/lib/types";
import { authClient } from "@/lib/auth-client";
import { useEditLock } from "@/hooks/use-edit-lock";
import { EditingPresenceIndicator } from "@/components/shared/editing-presence-indicator";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Expense | null;
  onClose: () => void;
  workItemId: string;
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  SALARY:     "Salary",
  MARKETING:  "Marketing",
  TOOLS:      "Tools",
  OPERATIONS: "Operations",
  EVENT:      "Event",
  EQUIPMENT:  "Equipment",
  OTHER:      "Other",
};

const EXPENSE_CATEGORIES = Object.keys(CATEGORY_LABELS) as ExpenseCategory[];

const EMPTY = {
  category: "" as ExpenseCategory | "",
  amount: "",
  description: "",
  phaseId: "",
  departmentId: "",
  stallId: "",
  hardwareItemId: "",
  occurredAt: new Date().toISOString().split("T")[0],
};

export function AddExpenseDialog({ open, onOpenChange, editing, onClose, workItemId }: Props) {
  const { addExpense, updateExpense, modules, departments, currentPlanMeta } = useFinancialStore();
  const isEvent = currentPlanMeta?.type === "event";

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY, string>>>({});
  const [loading, setLoading] = useState(false);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [hardwareItems, setHardwareItems] = useState<{ id: string; name: string }[]>([]);
  const { locked, lockedByName, otherEditors } = useEditLock("expense", editing?.id ?? null, open && !!editing);

  useEffect(() => {
    if (!open || !isEvent) return;
    authClient.request(`/api/plan/${workItemId}/stalls`)
      .then((res) => setStalls(res.data.data ?? []))
      .catch((err) => console.error("Failed to fetch stalls:", err));
  }, [open, isEvent, workItemId]);

  useEffect(() => {
    if (!open) return;
    authClient.request(`/api/plan/${workItemId}/hardware`)
      .then((res) => setHardwareItems((res.data.data ?? []).filter((h: any) => h.requestStatus === "APPROVED")))
      .catch((err) => console.error("Failed to fetch hardware items:", err));
  }, [open, workItemId]);

  useEffect(() => {
    if (editing) {
      setForm({
        category: editing.category,
        amount: editing.amount.toString(),
        description: editing.description ?? "",
        phaseId: editing.phaseId ?? "",
        departmentId: editing.departmentId ?? "",
        stallId: editing.stallId ?? "",
        hardwareItemId: editing.hardwareItemId ?? "",
        occurredAt: new Date(editing.occurredAt ?? Date.now())
          .toISOString()
          .split("T")[0],
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [editing, open]);

  function validate() {
    const e: typeof errors = {};
    if (!form.category)
      e.category = "Select a category";
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      e.amount = "Enter a valid amount";
    if (!form.occurredAt)
      e.occurredAt = "Date is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate() || locked) return;
    setLoading(true);
    const payload = {
      workItemId,
      category: form.category as ExpenseCategory,
      amount: Number(form.amount),
      description: form.description.trim() || undefined,
      phaseId: isEvent ? undefined : (form.phaseId || undefined),
      departmentId: form.departmentId || undefined,
      stallId: isEvent ? (form.stallId || undefined) : undefined,
      hardwareItemId: form.hardwareItemId || undefined,
      occurredAt: new Date(form.occurredAt).toISOString(),
    };

    try {
      if (editing) {
        const res = await authClient.request(
          `/api/plan/${workItemId}/expenses/${editing.id}`,
          { method: "PATCH", data: payload }
        );
        updateExpense(editing.id, res.data.data);
      } else {
        const res = await authClient.request(
          `/api/plan/${workItemId}/expenses`,
          { method: "POST", data: payload }
        );
        addExpense(res.data.data);
      }
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Something went wrong";
      setErrors((prev) => ({ ...prev, category: msg }));
      console.error("Expense submit error:", err);
    } finally {
      setLoading(false);
    }
  }

  function set<K extends keyof typeof EMPTY>(key: K, val: (typeof EMPTY)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
            <EditingPresenceIndicator editors={otherEditors} />
          </div>
        </DialogHeader>

        {locked && (
          <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
            Currently being edited by {lockedByName}.
          </div>
        )}

        <div className="space-y-4 pt-2">
          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) => set("category", v as ExpenseCategory)}
            >
              <SelectTrigger className={errors.category ? "border-destructive" : ""}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-xs text-destructive">{errors.category}</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input
              type="number"
              placeholder="0"
              min={0}
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              className={errors.amount ? "border-destructive" : ""}
            />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount}</p>
            )}
          </div>

          {/* Department (optional) */}
          <div className="space-y-1.5">
            <Label>
              Department{" "}
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Select
              value={form.departmentId || "none"}
              onValueChange={(v) => set("departmentId", v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No department</SelectItem>
                {departments?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Module (optional, Project-only — events have no phases/modules) */}
          {!isEvent && (
            <div className="space-y-1.5">
              <Label>
                Module{" "}
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Select
                value={form.phaseId || "none"}
                onValueChange={(v) => set("phaseId", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No module</SelectItem>
                  {modules?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Stall (event-only, optional) */}
          {isEvent && (
            <div className="space-y-1.5">
              <Label>
                Stall{" "}
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Select
                value={form.stallId || "none"}
                onValueChange={(v) => set("stallId", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not tied to a stall" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not tied to a stall</SelectItem>
                  {stalls.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Hardware item — only relevant when category is Equipment */}
          {form.category === "EQUIPMENT" && (
            <div className="space-y-1.5">
              <Label>
                Hardware item{" "}
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Select
                value={form.hardwareItemId || "none"}
                onValueChange={(v) => set("hardwareItemId", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not tied to a specific item" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not tied to a specific item</SelectItem>
                  {hardwareItems.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hardwareItems.length === 0 && (
                <p className="text-xs text-muted-foreground">No approved hardware items yet</p>
              )}
            </div>
          )}

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={form.occurredAt}
              onChange={(e) => set("occurredAt", e.target.value)}
              className={errors.occurredAt ? "border-destructive" : ""}
            />
            {errors.occurredAt && (
              <p className="text-xs text-destructive">{errors.occurredAt}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>
              Description{" "}
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              placeholder="What was this expense for?"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={loading} className="cursor-pointer hover:text-gray-600">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || locked} className="cursor-pointer">
              {loading ? "Saving..." : editing ? "Update" : "Add"} expense
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}