"use client";

import { create } from "zustand";
import type { TabDataPayload } from "./types";

export interface TabSlice {
  status: "pending" | "success" | "error";
  data: TabDataPayload | null;
  error: Error | null;
}

/**
 * Cache shape: byPlan[planId][tabId] -> slice.
 *
 * NOTE: intentionally a plain Record, not a Map. This store is NOT wrapped in
 * zustand's `persist` middleware — JSON.stringify() turns a Map into `{}` and
 * zustand's default shallow `merge` would then replace the Map with a plain
 * object on rehydrate, breaking every `.get()` call site.
 */
export interface AnalyticsStore {
  byPlan: Record<string, Record<string, TabSlice>>;
  set: (planId: string, tabId: string, payload: TabDataPayload) => void;
  setError: (planId: string, tabId: string, error: Error) => void;
  clear: (planId: string, tabId: string) => void;
  clearPlan: (planId: string) => void;
}

const PENDING: TabSlice = { status: "pending", data: null, error: null };

export const useAnalyticsStore = create<AnalyticsStore>()((set) => ({
  byPlan: {},

  set: (planId, tabId, payload) =>
    set((state) => ({
      byPlan: {
        ...state.byPlan,
        [planId]: {
          ...(state.byPlan[planId] ?? {}),
          [tabId]: { status: "success", data: payload, error: null },
        },
      },
    })),

  setError: (planId, tabId, error) =>
    set((state) => ({
      byPlan: {
        ...state.byPlan,
        [planId]: {
          ...(state.byPlan[planId] ?? {}),
          [tabId]: { status: "error", data: null, error },
        },
      },
    })),

  // Marks a single tab as pending (keeps other tabs' cached data intact).
  clear: (planId, tabId) =>
    set((state) => ({
      byPlan: {
        ...state.byPlan,
        [planId]: {
          ...(state.byPlan[planId] ?? {}),
          [tabId]: PENDING,
        },
      },
    })),

  clearPlan: (planId) =>
    set((state) => {
      const next = { ...state.byPlan };
      delete next[planId];
      return { byPlan: next };
    }),
}));
