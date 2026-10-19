"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useConnectionStore } from "@/lib/connection-store";
import type { ConnectionPrefs } from "@/lib/types";

/**
 * Loads the user's Connections preferences once and keeps the store in sync.
 *
 * Also refreshes the unread count on mount and whenever the window regains
 * focus, so the sidebar badge reflects the server truth (the `readAt` flags
 * in the DB) and not just what arrived over the socket while the page was open.
 */
export function useConnectionPrefs() {
  const prefs = useConnectionStore((s) => s.prefs);
  const prefsLoaded = useConnectionStore((s) => s.prefsLoaded);
  const unreadCount = useConnectionStore((s) => s.unreadCount);
  const setPrefs = useConnectionStore((s) => s.setPrefs);
  const refreshUnread = useConnectionStore((s) => s.refreshUnread);

  useEffect(() => {
    if (prefsLoaded) return;

    let cancelled = false;

    authClient
      .request("/api/settings/connections", { method: "GET" })
      .then((res) => {
        if (cancelled) return;
        if (res.data?.data) setPrefs(res.data.data as ConnectionPrefs);
      })
      .catch((err) => console.error("Failed to load connection preferences:", err));

    return () => {
      cancelled = true;
    };
  }, [prefsLoaded, setPrefs]);

  useEffect(() => {
    refreshUnread();

    const onFocus = () => refreshUnread();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshUnread]);

  return { prefs, prefsLoaded, unreadCount, refreshUnread };
}
