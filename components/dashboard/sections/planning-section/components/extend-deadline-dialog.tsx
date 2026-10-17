"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ExtendDeadlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabel: string; // e.g. the milestone or task title, shown in the prompt
  currentDueDate?: string;
  onConfirm: (newDueDate: string, reason: string) => Promise<void>;
}

export function ExtendDeadlineDialog({
  open,
  onOpenChange,
  itemLabel,
  currentDueDate,
  onConfirm,
}: ExtendDeadlineDialogProps) {
  const [newDueDate, setNewDueDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNewDueDate(currentDueDate ? currentDueDate.split("T")[0] : "");
      setReason("");
      setError(null);
    }
  }, [open, currentDueDate]);

  const handleConfirm = async () => {
    if (!newDueDate) {
      setError("A new due date is required");
      return;
    }
    if (!reason.trim()) {
      setError("Please explain why the deadline is being extended");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(newDueDate, reason.trim());
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to extend deadline");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Extend deadline</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Extending the deadline for <span className="font-medium text-foreground">"{itemLabel}"</span>.
            {currentDueDate && (
              <> Current due date: <span className="font-medium text-foreground">
                {new Date(currentDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>.</>
            )}
          </p>

          <div className="space-y-1.5">
            <Label>New due date</Label>
            <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Reason for extension</Label>
            <Textarea
              placeholder="e.g. Waiting on client feedback, scope increased..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button className="cursor-pointer hover:text-gray-600" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button className="cursor-pointer hover:text-foreground" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Extending..." : "Extend deadline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}