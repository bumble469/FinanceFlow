"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "../lib/relative-time";
import { CardPrimitive } from "../lib/card-primitive";
import { Package, Building2, Store } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface HardwareItem {
  id: string;
  name: string;
  category: string;
  source: string;
  quantity: number;
  monthlyRentAmount: number;
  depositAmount: number;
  depositReturned: boolean;
  condition: string | null;
  requestStatus: string;
  departmentName?: string;
  stallName?: string;
  requestedByName?: string;
}

interface HardwareData {
  items?: HardwareItem[];
  totalItems?: number;
  totalQuantity?: number;
  totalMonthlyRent?: number;
  totalDeposits?: number;
  categoryCounts?: Record<string, number>;
  conditionCounts?: Record<string, number>;
  sourceCounts?: Record<string, number>;
  currency?: string;
  hasHardware?: boolean;
}

export function HardwareTab({ data }: { data: Record<string, unknown> }) {
  const d = data as HardwareData;
  const currency = d.currency || "USD";
  const items = d.items ?? [];
  const totalItems = d.totalItems ?? items.length;
  const totalQuantity = d.totalQuantity ?? items.reduce((s, i) => s + i.quantity, 0);
  const totalMonthlyRent = d.totalMonthlyRent ?? 0;
  const totalDeposits = d.totalDeposits ?? 0;

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.category) set.add(item.category);
    }
    return Array.from(set);
  }, [items]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.source) set.add(item.source);
    }
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCat = categoryFilter === "all" || item.category === categoryFilter;
      const matchSource = sourceFilter === "all" || item.source === sourceFilter;
      return matchCat && matchSource;
    });
  }, [items, categoryFilter, sourceFilter]);

  const pendingRequests = useMemo(() => {
    return items.filter((i) => i.requestStatus === "PENDING").length;
  }, [items]);

  if (items.length === 0 && !d.hasHardware) {
    return (
      <CardPrimitive title="Hardware Inventory">
        <p className="text-sm text-muted-foreground text-center py-10">
          Hardware tracking is not enabled or no equipment has been catalogued yet.
        </p>
      </CardPrimitive>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hardware KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Units</p>
          <p className="text-2xl font-bold text-foreground mt-1">{totalQuantity}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{totalItems} distinct items</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Pending Requests</p>
          <p className={cn("text-2xl font-bold mt-1", pendingRequests > 0 ? "text-warning" : "text-foreground")}>
            {pendingRequests}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting approval</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Monthly Rentals</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totalMonthlyRent, currency)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Recurring cost</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Outstanding Deposits</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totalDeposits, currency)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Refundable security</p>
        </div>
      </div>

      {/* Filter Row */}
      {(categories.length > 1 || sources.length > 1) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Filter equipment inventory</p>
          <div className="flex flex-wrap items-center gap-2">
            {categories.length > 1 && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger size="sm" className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {sources.length > 1 && (
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger size="sm" className="w-[140px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {sources.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      )}

      {/* Hardware Items List */}
      <CardPrimitive
        title="Hardware Catalog"
        subtitle={`${filteredItems.length} items listed`}
      >
        {filteredItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No items match your filter criteria.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-card p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="h-4 w-4 text-primary shrink-0" />
                    <h4 className="font-semibold text-foreground text-sm truncate">{item.name}</h4>
                  </div>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-foreground shrink-0">
                    ×{item.quantity}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    {item.category}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                    {item.source}
                  </span>
                  {item.condition && (
                    <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                      {item.condition.replace("_", " ")}
                    </span>
                  )}
                </div>

                {(item.departmentName || item.stallName) && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border">
                    {item.departmentName ? (
                      <>
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="truncate">{item.departmentName}</span>
                      </>
                    ) : (
                      <>
                        <Store className="h-3.5 w-3.5" />
                        <span className="truncate">{item.stallName}</span>
                      </>
                    )}
                  </div>
                )}

                {(item.monthlyRentAmount > 0 || item.depositAmount > 0) && (
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-muted-foreground">
                    {item.monthlyRentAmount > 0 && (
                      <div>
                        <span>Rent: </span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(item.monthlyRentAmount, currency)}/mo
                        </span>
                      </div>
                    )}
                    {item.depositAmount > 0 && (
                      <div>
                        <span>Deposit: </span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(item.depositAmount, currency)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardPrimitive>
    </div>
  );
}
