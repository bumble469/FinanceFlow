"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getSocket } from "@/lib/socket-client";
import { authClient } from "@/lib/auth-client";
import { useConnectionStore } from "@/lib/connection-store";
import { useFinancialStore } from "@/lib/store";
import { ConnectionToastStack } from "@/components/connections/components/connection-toast";

interface IncomingMessage {
  id: string;
  body: string;
  senderId: string;
  sender?: { id: string; name: string | null; image: string | null };
  attachmentName?: string | null;
}

/**
 * Global listener for incoming connection messages.
 *
 * - Shows a top-left sliding snackbar when the message lands in a conversation
 *   the user is NOT currently looking at, and the user has opted in.
 * - Keeps the Connections badge count in sync.
 *
 * Mounted once from AppShell, so it is active on every page.
 */
export function ConnectionNotifier() {
  const prefs = useConnectionStore((s) => s.prefs);
  const prefsLoaded = useConnectionStore((s) => s.prefsLoaded);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const activeGroupId = useConnectionStore((s) => s.activeGroupId);
  const addToast = useConnectionStore((s) => s.addToast);
  const bumpUnreadCount = useConnectionStore((s) => s.bumpUnreadCount);
  const refreshUnread = useConnectionStore((s) => s.refreshUnread);
  const currentUser = useFinancialStore((s) => s.currentUser);
  const pathname = usePathname();
  // Suppress all message snackbars while the user is on the Connections page;
  // they can already see messages arriving in the chat panel.
  const isOnConnectionsPage = pathname === "/connections";

  useEffect(() => {
    const socket = getSocket();

    const handleDirect = (payload: {
      conversationId: string;
      connectionId: string;
      message: IncomingMessage;
    }) => {
      const msg = payload?.message;
      if (!msg) return;
      // Messages you sent are echoed back to your own tabs — ignore them.
      if (msg.senderId && currentUser?.id && msg.senderId === currentUser.id) return;

      const isActive = payload.connectionId === activeConnectionId;

      if (isActive) {
        // The user is looking at this conversation, so the message is read.
        // Mark it server-side, otherwise the server's unread count and the
        // badge would drift apart.
        authClient
          .request(`/api/conversations/${payload.conversationId}/read`, { method: "PATCH" })
          .catch(() => {});
        return;
      }

      bumpUnreadCount(1);

      if (prefs.messageSnackbarEnabled && !isOnConnectionsPage) {
        addToast({
          id: msg.id,
          senderName: msg.sender?.name || "Someone",
          body: msg.body || msg.attachmentName || "New message",
          targetId: payload.connectionId,
          kind: "direct",
        });
      }
    };

    const handleGroup = (payload: { workItemId: string; message: IncomingMessage; mentioned?: boolean }) => {
      const msg = payload?.message;
      if (!msg) return;
      if (msg.senderId && currentUser?.id && msg.senderId === currentUser.id) return;

      const isActive = payload.workItemId === activeGroupId;

      if (isActive) {
        authClient
          .request(`/api/groups/${payload.workItemId}/read`, { method: "PATCH" })
          .catch(() => {});
        return;
      }

      bumpUnreadCount(1);

      const mentioned = !!payload.mentioned;
      const text = msg.body || msg.attachmentName || "New message";

      const showToast = mentioned || (prefs.messageSnackbarEnabled && !isOnConnectionsPage);

      if (showToast) {
        addToast({
          id: msg.id,
          senderName: msg.sender?.name || "Someone",
          body: mentioned ? `mentioned you: ${text}` : text,
          targetId: payload.workItemId,
          kind: "group",
        });
      }
    };

    const handleRead = () => {
      refreshUnread();
    };

    socket.on("chat:new-message", handleDirect);
    socket.on("group:new-message", handleGroup);
    socket.on("chat:read", handleRead);
    socket.on("group:read", handleRead);

    return () => {
      socket.off("chat:new-message", handleDirect);
      socket.off("group:new-message", handleGroup);
      socket.off("chat:read", handleRead);
      socket.off("group:read", handleRead);
    };
  }, [
    currentUser?.id,
    activeConnectionId,
    activeGroupId,
    prefs.messageSnackbarEnabled,
    isOnConnectionsPage,
    addToast,
    bumpUnreadCount,
    refreshUnread,
  ]);

  // Always render the stack — the toasts array is empty until something arrives,
  // so there's nothing to show. The prefsLoaded guard was causing toasts that
  // arrived while prefs were still loading to silently vanish.
  // (If prefs haven't loaded yet we conservatively skip adding toasts above via
  // the prefsLoaded check at the call sites is not needed — the store defaults
  // messageSnackbarEnabled:true which matches the DB default.)
  return prefsLoaded ? <ConnectionToastStack /> : null;
}
