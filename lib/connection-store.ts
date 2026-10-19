"use client";

import { create } from "zustand";
import { authClient } from "@/lib/auth-client";
import {
  DEFAULT_CONNECTION_PREFS,
  type ConnectionPrefs,
} from "@/lib/types";

export interface ConnectionToast {
  id: string;
  senderName: string;
  body: string;
  /** Connection id for 1-to-1 messages, work item id for group messages. */
  targetId: string;
  kind: "direct" | "group";
}

interface ConnectionState {
  prefs: ConnectionPrefs;
  prefsLoaded: boolean;
  unreadCount: number;
  toasts: ConnectionToast[];
  /** Connection currently open on screen (matches the socket payload's connectionId). */
  activeConnectionId: string | null;
  /** Group work item currently open on screen. */
  activeGroupId: string | null;

  setPrefs: (prefs: ConnectionPrefs) => void;
  setUnreadCount: (count: number) => void;
  bumpUnreadCount: (delta: number) => void;
  refreshUnread: () => Promise<void>;
  addToast: (toast: ConnectionToast) => void;
  removeToast: (id: string) => void;
  setActiveConnectionId: (id: string | null) => void;
  setActiveGroupId: (id: string | null) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  prefs: DEFAULT_CONNECTION_PREFS,
  prefsLoaded: false,
  unreadCount: 0,
  toasts: [],
  activeConnectionId: null,
  activeGroupId: null,

  setPrefs: (prefs) => set({ prefs, prefsLoaded: true }),
  setUnreadCount: (unreadCount) => set({ unreadCount: Math.max(0, unreadCount) }),
  bumpUnreadCount: (delta) =>
    set((s) => ({ unreadCount: Math.max(0, s.unreadCount + delta) })),

  refreshUnread: async () => {
    try {
      const res = await authClient.request("/api/connections/unread", { method: "GET" });
      const count = res.data?.data?.unreadCount;
      if (typeof count === "number") {
        set({ unreadCount: Math.max(0, count) });
      }
    } catch {
      // Network hiccup — keep the last known count rather than flashing 0.
    }
  },

  addToast: (toast) =>
    set((s) => ({
      // Cap the stack so a burst of messages can't cover the screen.
      toasts: [...s.toasts, toast].slice(-3),
    })),
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setActiveConnectionId: (activeConnectionId) => set({ activeConnectionId }),
  setActiveGroupId: (activeGroupId) => set({ activeGroupId }),
}));
