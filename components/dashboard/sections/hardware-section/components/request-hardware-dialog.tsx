"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Department, Stall, HardwareCategory, HardwareSource } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Department[];
  stalls: Stall[];
  isEvent: boolean;
  onSave: (data: any) => Promise<void>;
}

const EMPTY = {
  name: "",
  category: "" as HardwareCategory | "",
  source: "" as HardwareSource | "",
  quantity: "1",
  vendor: "",
  notes: "",
  departmentId: "",
  stallId: "",
  rentalStart: "",
  rentalEnd: "",
  monthlyRentAmount: "",
  depositAmount: "",
};

const CATEGORY_LABELS: Record<HardwareCategory, string> = {
  AV: "Audio/Visual", FURNITURE: "Furniture", ELECTRICAL: "Electrical",
  STRUCTURAL: "Structural", IT: "IT Equipment", OTHER: "Other",
};

export function RequestHardwareDialog({ open, onOpenChange, departments, stalls, isEvent, onSave }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open) { setForm(EMPTY); setError(""); } }, [open]);

  const set = <K extends keyof typeof EMPTY>(key: K, val: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return setError("Name is required");
    if (!form.category) return setError("Select a category");
    if (!form.source) return setError("Select a source");
    if (form.source === "RENTED" && !form.monthlyRentAmount) return setError("Monthly rent amount is required for rented items");

    setLoading(true);
    setError("");
    try {
      await onSave({
        name: form.name.trim(),
        category: form.category,
        source: form.source,
        quantity: Number(form.quantity) || 1,
        vendor: form.vendor.trim() || undefined,
        notes: form.notes.trim() || undefined,
        departmentId: form.departmentId || undefined,
        stallId: isEvent ? (form.stallId || undefined) : undefined,
        rentalStart: form.rentalStart || undefined,
        rentalEnd: form.rentalEnd || undefined,
        monthlyRentAmount: form.source === "RENTED" ? Number(form.monthlyRentAmount) : undefined,
        depositAmount: form.depositAmount ? Number(form.depositAmount) : undefined,
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle>Request hardware</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input placeholder="e.g. Projector, 20x folding chairs" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v as HardwareCategory)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABELS) as HardwareCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => set("source", v as HardwareSource)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNED">Owned</SelectItem>
                  <SelectItem value="RENTED">Rented</SelectItem>
                  <SelectItem value="BORROWED">Borrowed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={form.vendor} onChange={(e) => set("vendor", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Department <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <Select value={form.departmentId || "none"} onValueChange={(v) => set("departmentId", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="No department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No department</SelectItem>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isEvent && (
            <div className="space-y-1.5">
              <Label>Stall <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={form.stallId || "none"} onValueChange={(v) => set("stallId", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Not tied to a stall" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not tied to a stall</SelectItem>
                  {stalls.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.source === "RENTED" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Rental start</Label>
                  <Input type="date" value={form.rentalStart} onChange={(e) => set("rentalStart", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Return due</Label>
                  <Input type="date" value={form.rentalEnd} onChange={(e) => set("rentalEnd", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Monthly rent</Label>
                  <Input type="number" min={0} value={form.monthlyRentAmount} onChange={(e) => set("monthlyRentAmount", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Deposit <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                  <Input type="number" min={0} value={form.depositAmount} onChange={(e) => set("depositAmount", e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Notes <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea rows={2} className="resize-none" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button className="cursor-pointer hover:text-gray-600" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button className="cursor-pointer" onClick={handleSubmit} disabled={loading}>{loading ? "Submitting..." : "Submit request"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}