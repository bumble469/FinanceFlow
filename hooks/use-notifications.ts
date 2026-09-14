"use client";

import { useState, useEffect, useCallback } from "react";
import { getSocket } from "@/lib/socket-client";
import { authClient } from "@/lib/auth-client";

export interface NotificationItem {
  id: string;
  scope: "GENERAL" | "PERSONAL";
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications(planId?: string) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadGeneral, setUnreadGeneral] = useState(0);
  const [unreadPersonal, setUnreadPersonal] = useState(0);
  const [general, setGeneral] = useState<NotificationItem[]>([]);
  const [personal, setPersonal] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const baseUrl = planId ? `/api/plan/${planId}/notifications` : `/api/notifications`;

  const fetchTab = useCallback(async (scope: "GENERAL" | "PERSONAL") => {
    setLoading(true);
    try {
      const res = await authClient.request(baseUrl, {
        method: "GET",
        params: { scope },
      });
      if (scope === "GENERAL") setGeneral(res.data.data.items);
      else setPersonal(res.data.data.items);
      
      setUnreadCount(res.data.data.unreadCount);
      setUnreadGeneral(res.data.data.unreadGeneral);
      setUnreadPersonal(res.data.data.unreadPersonal);
    } catch (err) {
      console.error(`Failed to fetch ${planId ? 'plan' : 'global'} notifications:`, err);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, planId]);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await authClient.request(baseUrl, {
        method: "GET",
        params: { scope: "GENERAL" },
      });
      setUnreadCount(res.data.data.unreadCount);
      setUnreadGeneral(res.data.data.unreadGeneral);
      setUnreadPersonal(res.data.data.unreadPersonal);
    } catch (err) {
      console.error("Failed to refresh unread count:", err);
    }
  }, [baseUrl]);

  useEffect(() => {
    refreshUnreadCount();
    const socket = getSocket();

    function handleNew(payload: { workItemId?: string; scope: "GENERAL" | "PERSONAL" }) {
      // If we are in a Plan context, ignore global notifications or notifications for other plans
      if (planId && payload.workItemId !== planId) return;
      
      // If we are in a Global context, ignore plan-specific notifications
      if (!planId && payload.workItemId) return;

      setUnreadCount((c) => c + 1);
      if (payload.scope === "GENERAL") setUnreadGeneral((c) => c + 1);
      else setUnreadPersonal((c) => c + 1);
      
      // prepend into whichever tab it belongs to, if already loaded
      if (payload.scope === "GENERAL") setGeneral((prev) => (prev.length ? [payload as any, ...prev] : prev));
      else setPersonal((prev) => (prev.length ? [payload as any, ...prev] : prev));
    }

    socket.on("notification:new", handleNew);
    return () => {
      socket.off("notification:new", handleNew);
    };
  }, [planId, refreshUnreadCount]);

  const markRead = async (id: string) => {
    try {
      await authClient.request(`${baseUrl}/${id}`, { method: "PATCH" });
      const wasUnread = general.find((n) => n.id === id && !n.isRead) || personal.find((n) => n.id === id && !n.isRead);
      const scope = general.some((n) => n.id === id) ? "GENERAL" : "PERSONAL";

      setGeneral((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setPersonal((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));

      if (wasUnread) {
        setUnreadCount((c) => Math.max(0, c - 1));
        if (scope === "GENERAL") setUnreadGeneral((c) => Math.max(0, c - 1));
        else setUnreadPersonal((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const markAllRead = async (scope?: "GENERAL" | "PERSONAL") => {
    try {
      await authClient.request(`${baseUrl}/read-all`, {
        method: "PATCH",
        data: { scope },
      });
      if (!scope || scope === "GENERAL") setGeneral((prev) => prev.map((n) => ({ ...n, isRead: true })));
      if (!scope || scope === "PERSONAL") setPersonal((prev) => prev.map((n) => ({ ...n, isRead: true })));
      if (!scope || scope === "GENERAL") setUnreadGeneral(0);
      if (!scope || scope === "PERSONAL") setUnreadPersonal(0);
      await refreshUnreadCount();
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  };

  return { unreadCount, unreadGeneral, unreadPersonal, general, personal, loading, fetchTab, markRead, markAllRead };
}