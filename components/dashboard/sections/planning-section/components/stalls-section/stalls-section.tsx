"use client";
import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useFinancialStore } from "@/lib/store";
import { useSnackbar } from "@/lib/useSnackbar";
import { Button } from "@/components/ui/button";
import { Store, Plus, Pencil, Trash2, Users, IndianRupee } from "lucide-react";
import { getCurrencySymbol } from "@/lib/currency";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { AddStallDialog } from "./components/add-stall-dialog";
import { StallMembersDialog } from "./components/stall-members-dialog";
import type { PlanPermissions } from "@/lib/permissions";
import type { Stall } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fetchTicketingAndStalls } from "@/lib/fetch-ticketing-stalls";

interface Props {
  planId: string;
  permissions: PlanPermissions;
  /** When true, hides the big page title/description — used when this component is
   *  embedded inside another block (e.g. Planning section) that already shows a header. */
  embedded?: boolean;
  /** When set, caps the height of just the list/grid (not the Add button) and makes it
   *  independently scrollable. Pass undefined/null for full, unconstrained height. */
  maxHeight?: number | null;
}

export function StallsSection({ planId, permissions, embedded = false, maxHeight = null }: Props) {
  const { currency, stalls } = useFinancialStore();
  const { show } = useSnackbar();

  const loading = false;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStall, setEditingStall] = useState<Stall | null>(null);
  const [membersFor, setMembersFor] = useState<Stall | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchStalls = async () => {
    if (!planId) return;
    try {
      await fetchTicketingAndStalls(planId, { hasStalls: true });
    } catch (err) {
      console.error("Fetch stalls failed:", err);
      show("Failed to fetch stalls", "error");
    }
  };

  useEffect(() => { fetchStalls(); }, [planId]);

  const saveStall = async (data: { name: string; description?: string }) => {
    if (editingStall) {
      await authClient.request(`/api/plan/${planId}/stalls/${editingStall.id}`, { method: "PATCH", data });
      show("Stall updated", "success");
    } else {
      await authClient.request(`/api/plan/${planId}/stalls`, { method: "POST", data });
      show("Stall created", "success");
    }
    fetchStalls();
  };

  const deleteStall = async (id: string) => {
    try {
      await authClient.request(`/api/plan/${planId}/stalls/${id}`, { method: "DELETE" });
      await fetchStalls();
      show("Stall deleted", "success");
    } catch (err) {
      console.error("Delete stall failed:", err);
      show("Failed to delete stall", "error");
    }
  };

  const AddButton = permissions.canManageStalls ? (
    <Button
      size="sm"
      className="gap-1.5 cursor-pointer"
      onClick={() => { setEditingStall(null); setDialogOpen(true); }}
    >
      <Plus className="h-3.5 w-3.5" />
      Add stall
    </Button>
  ) : null;

  return (
    <div className="space-y-4">
      {/* Header row — always visible, never scrolled away */}
      {!embedded ? (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Stalls</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Track stall teams and their income/expenses — tagged directly onto your existing ledger
            </p>
          </div>
          {AddButton}
        </div>
      ) : (
        AddButton && <div className="flex justify-end">{AddButton}</div>
      )}

      {loading ? (
        <div className="py-14 text-center text-sm text-muted-foreground">Loading stalls...</div>
      ) : stalls.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Store className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No stalls yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">Add a stall to start tracking its team and finances</p>
          </div>
          {permissions.canManageStalls && (
            <Button variant="outline" size="sm" className="text-xs mt-1" onClick={() => { setEditingStall(null); setDialogOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add stall
            </Button>
          )}
        </div>
      ) : (
        <div
          className={cn("grid grid-cols-1 gap-3 md:grid-cols-2", maxHeight && "custom-scrollbar")}
          style={maxHeight ? { maxHeight, overflowY: "auto", paddingRight: 4 } : undefined}
        >
          {stalls.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{s.name}</p>
                  {s.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.description}</p>}
                </div>
                {permissions.canManageStalls && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer" onClick={() => { setEditingStall(s); setDialogOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive cursor-pointer" onClick={() => { setDeleteId(s.id); setConfirmOpen(true); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <IndianRupee className="h-3 w-3" />
                  {s._count?.income ?? 0} income · {s._count?.expenses ?? 0} expense entries
                </span>
              </div>

              <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setMembersFor(s)}
              >
                <Users className="h-3.5 w-3.5" />
                {s.members.length} member{s.members.length !== 1 ? "s" : ""} · Manage
              </button>
            </div>
          ))}
        </div>
      )}

      <AddStallDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingStall(null); }}
        editing={editingStall}
        onSave={saveStall}
      />

      {membersFor && (
        <StallMembersDialog
          open={!!membersFor}
          onOpenChange={(v) => { if (!v) setMembersFor(null); }}
          planId={planId}
          stall={stalls.find((s) => s.id === membersFor.id) ?? membersFor}
          onChanged={fetchStalls}
        />
      )}

      <ConfirmDeleteDialog
        open={confirmOpen}
        type="stall"
        setOpen={setConfirmOpen}
        onConfirm={() => { if (deleteId) { deleteStall(deleteId); setDeleteId(null); } }}
      />
    </div>
  );
}