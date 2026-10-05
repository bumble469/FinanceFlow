"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plan } from "@/lib/types";
import { useFinancialStore } from "@/lib/store";
import type { PlanType } from "@/lib/types";
import { authClient } from "@/lib/auth-client";

interface CreatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlanCreate: () => void;
  initialData?: Plan;
  isEditMode?: boolean;
  atProjectLimit?: boolean;
  atEventLimit?: boolean;
  planName?: string;
  maxProjects?: number;
  maxEvents?: number;
}

export function CreatePlanDialog({
  open,
  onOpenChange,
  onPlanCreate,
  initialData,
  isEditMode = false,
  atProjectLimit = false,
  atEventLimit = false,
  planName,
  maxProjects,
  maxEvents,
}: CreatePlanDialogProps) {
  const { addPlan } = useFinancialStore();

  const [name, setName] = useState("");
  const [type, setType] = useState<PlanType>("project");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [isActive, setIsActive] = useState(true);
  const [hasTicketing, setHasTicketing] = useState(false);
  const [hasStalls, setHasStalls] = useState(false);
  const [hasHardware, setHasHardware] = useState(false);
  const [allowConnectionsGroup, setAllowConnectionsGroup] = useState(true);

  // project-specific
  const [startDate, setStartDate] = useState("");
  const [endDate, setDeadline] = useState("");
  const [methodology, setMethodology] = useState("");

  // event-specific
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setType(initialData.type);
      setBudget(String(initialData.budget));
      setDescription(initialData.description || "");
      setCurrency(initialData.currency);
      setIsActive(initialData.status === "active");
      setHasHardware(!!initialData.hasHardware);
      setAllowConnectionsGroup(initialData.allowConnectionsGroup ?? true);

      if (initialData.project) {
        setStartDate(initialData.project.startDate?.split("T")[0] ?? "");
        setDeadline(initialData.project.deadline?.split("T")[0] ?? "");
        setMethodology(initialData.project.methodology ?? "");
      }

      if (initialData.event) {
        setEventDate(initialData.event.eventDate?.split("T")[0] ?? "");
        setVenue(initialData.event.venue ?? "");
        setHasTicketing(!!initialData.event.hasTicketing);
        setHasStalls(!!initialData.event.hasStalls);
      }
    } else {
      setName("");
      setType("project");
      setBudget("");
      setDescription("");
      setCurrency("USD");
      setIsActive(true);
      setStartDate("");
      setDeadline("");
      setMethodology("");
      setEventDate("");
      setVenue("");
      setHasTicketing(false);
      setHasStalls(false);
      setHasHardware(false);
      setAllowConnectionsGroup(true);
    }
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const budgetAmount = parseFloat(budget);
    if (!name.trim() || !budget.trim() || budgetAmount <= 0) return;

    setIsLoading(true);

    try {
      const url = isEditMode ? `/api/plan/${initialData?.id}` : "/api/plan";
      const method = isEditMode ? "PATCH" : "POST";

      const { data } = await authClient.request(url, {
        method,
        data: {
          name: name.trim(),
          type: type.toUpperCase(),
          budget: budgetAmount,
          description: description.trim(),
          currency,
          status: isActive ? "ACTIVE" : "INACTIVE",
          hasHardware,
          allowConnectionsGroup,
          // type-specific
          ...(type === "project" && {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            methodology: methodology.trim() || undefined,
          }),
          ...(type === "event" && {
            eventDate: eventDate || undefined,
            venue: venue.trim() || undefined,
            hasTicketing,
            hasStalls,
          }),
        },
      });

      if (!isEditMode) {
        addPlan(data.data);
      }

      onPlanCreate();
      onOpenChange(false);
    } catch (err) {
      setError(
        `Failed to ${isEditMode ? "update" : "create"} plan: ${(err as Error).message
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Plan" : "Create New Plan"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update your plan details"
              : "Set up a new project or event to track finances"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          {/* PLAN NAME */}
          <div className="space-y-2">
            <Label>Plan Name</Label>
            <Input
              placeholder="e.g., Q2 Marketing, Summer Event"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* PLAN TYPE */}
          <div className="space-y-3">
            <Label>Plan Type</Label>

                        <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as PlanType)}
              className="space-y-2"
            >
              <Label
                htmlFor="project"
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  isEditMode ? "" : atProjectLimit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                } ${
                  type === "project" ? "border-foreground bg-muted/40" : "border-border"
                }`}
              >
                <RadioGroupItem value="project" id="project" disabled={!isEditMode && atProjectLimit} />
                <span className="flex-1">
                  Project
                  {!isEditMode && atProjectLimit && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      Limit reached ({maxProjects} on {planName}) — upgrade to add more
                    </span>
                  )}
                </span>
              </Label>

              <Label
                htmlFor="event"
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  isEditMode ? "" : atEventLimit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                } ${
                  type === "event" ? "border-foreground bg-muted/40" : "border-border"
                }`}
              >
                <RadioGroupItem value="event" id="event" disabled={!isEditMode && atEventLimit} />
                <span className="flex-1">
                  Event
                  {!isEditMode && atEventLimit && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      Limit reached ({maxEvents} on {planName}) — upgrade to add more
                    </span>
                  )}
                </span>
              </Label>
            </RadioGroup>
          </div>

          {/* PROJECT-SPECIFIC FIELDS */}
          {type === "project" && (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Project details
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>
                    Start date{" "}
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Est. end date{" "}
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setDeadline(e.target.value)}
                    disabled={isLoading}
                    min={startDate || undefined}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  Methodology{" "}
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  placeholder="e.g., Agile, Waterfall, Scrum"
                  value={methodology}
                  onChange={(e) => setMethodology(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* EVENT-SPECIFIC FIELDS */}
          {type === "event" && (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Event details
              </p>

              <div className="space-y-2">
                <Label>
                  Event date{" "}
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Venue{" "}
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  placeholder="e.g., NSCI Dome, Mumbai"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Ticketing</Label>
                    <p className="text-xs text-muted-foreground">Track ticket types, bookings, and check-in</p>
                  </div>
                  <Switch
                    className="cursor-pointer"
                    checked={hasTicketing}
                    onCheckedChange={setHasTicketing}
                    disabled={isLoading}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Stalls</Label>
                    <p className="text-xs text-muted-foreground">Track stall teams and their income/expenses</p>
                  </div>
                  <Switch
                    className="cursor-pointer"
                    checked={hasStalls}
                    onCheckedChange={setHasStalls}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
          )}

          {/* BUDGET */}
          <div className="space-y-2">
            <Label>Budget</Label>
            <Input
              type="number"
              placeholder="50000"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              disabled={isLoading}
              min="1"
            />
          </div>

          {/* CURRENCY */}
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="INR">INR (₹)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
              </SelectContent>
            </Select>
          </div>

                    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <Label>Hardware Logistics</Label>
              <p className="text-xs text-muted-foreground">Track equipment requests, rentals, and inventory</p>
            </div>
            <Switch
              checked={hasHardware}
              onCheckedChange={setHasHardware}
              disabled={isLoading}
            />
          </div>

          {/* Always show, but handle edit mode behavior */}
          <div className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Connections Group</Label>
                <p className="text-xs text-muted-foreground">
                  Creates a group chat for everyone added to this {type}
                </p>
              </div>
              <Switch
                className="cursor-pointer"
                checked={allowConnectionsGroup}
                onCheckedChange={setAllowConnectionsGroup}
                disabled={isLoading}
              />
            </div>
            {isEditMode && initialData?.allowConnectionsGroup && !allowConnectionsGroup && (
              <p className="text-xs text-destructive mt-1">
                Warning: Turning this off will permanently delete the group chat and all its messages.
              </p>
            )}
          </div>

          {/* DESCRIPTION */}
          <div className="space-y-2">
            <Label>
              Description{" "}
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              placeholder="Add details about this plan..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              className="resize-none"
              rows={2}
            />
          </div>

          {/* STATUS */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Status</Label>
              <p className="text-xs text-muted-foreground">
                {isActive ? "Active plan" : "Inactive plan"}
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isLoading}
            />
          </div>

          {/* ACTIONS */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1 cursor-pointer hover:text-gray-600"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading ||
                !name.trim() ||
                !budget.trim() ||
                (!isEditMode && type === "project" && atProjectLimit) ||
                (!isEditMode && type === "event" && atEventLimit)
              }
              className="flex-1 cursor-pointer"
            >
              {isLoading
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                  ? "Update Plan"
                  : "Create Plan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}