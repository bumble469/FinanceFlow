"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TicketType } from "@/lib/types";
import { useEditLock } from "@/hooks/use-edit-lock";
import { EditingPresenceIndicator } from "@/components/shared/editing-presence-indicator";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: TicketType | null;
  onSave: (data: { name: string; price: number; capacity?: number | null; description?: string }) => Promise<void>;
}

export function TicketTypeDialog({ open, onOpenChange, editing, onSave }: Props) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { locked, lockedByName, otherEditors } = useEditLock("ticketType", editing?.id ?? null, open && !!editing);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setPrice(editing?.price?.toString() ?? "");
      setCapacity(editing?.capacity?.toString() ?? "");
      setDescription(editing?.description ?? "");
      setError("");
    }
  }, [open, editing]);

  const handleSubmit = async () => {
    if (!name.trim()) return setError("Name is required");
    if (!price || isNaN(Number(price)) || Number(price) < 0) return setError("Enter a valid price");
    if (locked) return;
    setLoading(true);
    try {
      await onSave({
        name: name.trim(),
        price: Number(price),
        capacity: capacity ? Number(capacity) : null,
        description: description.trim() || undefined,
      });
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{editing ? "Edit ticket type" : "Add ticket type"}</DialogTitle>
            <EditingPresenceIndicator editors={otherEditors} />
          </div>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input autoFocus placeholder="e.g. General Admission" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Price</Label>
              <Input type="number" min={0} placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
              <Input type="number" min={0} placeholder="Unlimited" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="resize-none" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {locked && (
            <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
              Currently being edited by {lockedByName}.
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="cursor-pointer hover:text-gray-600">Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading || locked} className="cursor-pointer">
              {loading ? "Saving..." : editing ? "Save changes" : "Add ticket type"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}