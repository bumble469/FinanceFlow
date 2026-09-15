"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TabSelector, type ConnectionTab } from "@/components/connections/components/tab-selector";
import { ChatListItem } from "@/components/connections/components/chat-list-item";
import { ChatPanel } from "@/components/connections/components/chat-panel";
import { EmptyChatState } from "@/components/connections/components/empty-chat-state";
import { GroupsTab } from "@/components/connections/components/GroupsTab";
import { RequestsTab } from "@/components/connections/components/RequestsTab";
import { getSocket } from "@/lib/socket-client";
import { connection } from "next/server";

interface ConnectionItem {
  connectionId: string;
  user: { id: string; name: string | null; email: string; image?: string | null };
  connectedAt: string;
  unreadCount?: number; // 1. Added unreadCount to the interface
}
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function ConnectionsPage() {
  const [tab, setTab] = useState<ConnectionTab>("direct");
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ConnectionItem | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [typingConnections, setTypingConnections] = useState<Record<string, boolean>>({});
  const isChatTab = tab === "all" || tab === "direct";
  const selectedConnectionIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedConnectionIdRef.current = selected?.connectionId || null;
  }, [selected]);

  useEffect(() => {
    const socket = getSocket();

    const handleNewMessage = (payload: { conversationId: string; connectionId: string; message: any }) => {
      setConnections((prev) =>
        prev.map((conn) => {
          // Find the specific connection that received the message
          if (conn.connectionId === payload.connectionId) {
            // If the user is currently looking at THIS chat, do not increment the badge
            if (selectedConnectionIdRef.current === conn.connectionId) {
              return conn;
            }
            // Otherwise, increment the unread count
            return {
              ...conn,
              unreadCount: (conn.unreadCount || 0) + 1,
            };
          }
          return conn;
        })
      );
    };

    const handleChatRead = (payload: { connectionId: string }) => {
      setConnections((prev) =>
        prev.map((conn) =>
          conn.connectionId === payload.connectionId
            ? { ...conn, unreadCount: 0 } // Force badge to 0
            : conn
        )
      );
    };

    const handleTyping = (payload: { connectionId: string; isTyping: boolean }) => {
      setTypingConnections((prev) => ({
        ...prev,
        [payload.connectionId]: payload.isTyping,
      }));
      console.log("typing event received: "+ payload.connectionId + payload.isTyping)
    };

    socket.on("chat:new-message", handleNewMessage);
    socket.on("chat:read", handleChatRead);
    socket.on("chat:typing", handleTyping);
    return () => {
      socket.off("chat:new-message", handleNewMessage);
      socket.off("chat:read", handleChatRead);
      socket.off("chat:typing", handleTyping);
    };
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authClient.request("/api/connections", {
        method: "GET",
        params: { page, limit: 20, search: search || undefined },
      });
      // The API now returns unreadCount inside each connection object
      setConnections(res.data.connections || []);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error("Failed to fetch connections:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    if (isChatTab) fetchConnections();
  }, [isChatTab, fetchConnections]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  if (tab === "groups") {
    return (
      <div className="flex flex-col h-full min-h-0">
        <TabSelector active={tab} onChange={setTab} />
        <div className="flex-1 overflow-y-auto min-h-0 p-4">
          <GroupsTab />
        </div>
      </div>
    );
  }

  if (tab === "requests") {
    return (
      <div className="flex flex-col h-full min-h-0">
        <TabSelector active={tab} onChange={setTab} />
        <div className="flex-1 overflow-y-auto min-h-0 p-4">
          <RequestsTab />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-2xl border border-border">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col min-h-0 border-r border-border bg-card w-full md:w-[340px] shrink-0",
          selected && "hidden md:flex"
        )}
      >
        <TabSelector active={tab} onChange={setTab} />

        <div className="px-3 pb-2 shrink-0">
          <div className="relative my-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search connections..."
              className="h-9 w-full pl-8 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : connections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10 px-4">
              {search ? `No matches for "${search}"` : "No connections yet. Accept a request to start chatting."}
            </p>
          ) : (
            connections.map((c) => (
              <ChatListItem
                key={c.connectionId}
                name={c.user.name || ""}
                email={c.user.email}
                image={c.user.image}
                active={selected?.connectionId === c.connectionId}
                unreadCount={c.unreadCount}
                isTyping={typingConnections[c.connectionId] || false}
                onClick={() => setSelected(c)}
              />
            ))
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border shrink-0">
            <p className="text-[11px] text-muted-foreground">
              Page {pagination.page}/{pagination.totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-6 w-6" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </aside>

      {/* Main panel */}
      <div className={cn("flex-1 flex flex-col min-h-0", !selected && "hidden md:flex")}>
        {selected ? (
          <ChatPanel connectionId={selected.connectionId} connection={selected} onBack={() => setSelected(null)} />
        ) : (
          <EmptyChatState />
        )}
      </div>
    </div>
  );
}