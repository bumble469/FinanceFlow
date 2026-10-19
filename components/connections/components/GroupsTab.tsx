"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { getSocket } from "@/lib/socket-client";
import { useConnectionStore } from "@/lib/connection-store";
import { TabSelector, type ConnectionTab } from "@/components/connections/components/tab-selector";
import { GroupListItem } from "@/components/connections/components/group-list-item";
import { GroupPanel } from "@/components/connections/components/group-panel";
import { EmptyChatState } from "@/components/connections/components/empty-chat-state";

interface GroupSummary {
  workItemId: string;
  name: string;
  type: string;
  status: string;
  imageUrl?: string | null;
  unreadCount: number;
}

interface GroupsTabProps {
  tab: ConnectionTab;
  onTabChange: (t: ConnectionTab) => void;
  isFullscreen?: boolean;
}

export function GroupsTab({ tab, onTabChange, isFullscreen = false }: GroupsTabProps) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const setActiveGroupId = useConnectionStore((s) => s.setActiveGroupId);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    // Let the global notifier know which group is on screen, so it doesn't
    // raise a snackbar for the message you're already looking at.
    setActiveGroupId(selectedId);
  }, [selectedId, setActiveGroupId]);

  const handleRead = useCallback((workItemId: string) => {
    setGroups((prev) => prev.map((g) => (g.workItemId === workItemId ? { ...g, unreadCount: 0 } : g)));
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await authClient.request("/api/groups", { method: "GET" });
      setGroups(res.data.data ?? []);
    } catch (err) {
      console.error("Failed to fetch groups:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const handleNew = (payload: { workItemId: string }) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.workItemId === payload.workItemId && selectedIdRef.current !== payload.workItemId
            ? { ...g, unreadCount: g.unreadCount + 1 }
            : g
        )
      );
    };
    const handleRead = (payload: { workItemId: string }) => {
      setGroups((prev) => prev.map((g) => (g.workItemId === payload.workItemId ? { ...g, unreadCount: 0 } : g)));
    };
    socket.on("group:new-message", handleNew);
    socket.on("group:read", handleRead);
    return () => {
      socket.off("group:new-message", handleNew);
      socket.off("group:read", handleRead);
    };
  }, []);

  const selected = groups.find((g) => g.workItemId === selectedId) ?? null;

  return (
    <div
      className={cn(
        "flex h-full w-full min-w-0 max-w-full min-h-0 overflow-hidden border border-border",
        isFullscreen ? "rounded-none" : "rounded-2xl"
      )}
    >      
      <aside
        className={cn(
          "flex flex-col min-h-0 md:border-r border-border bg-card w-full md:w-[340px] md:shrink-0 min-w-0",
          selected && "hidden md:flex"
        )}
      >
        <TabSelector active={tab} onChange={onTabChange} />

        <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-2 pt-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10 px-4">
              No groups yet. Groups are created automatically for projects/events with the setting turned on.
            </p>
          ) : (
            groups.map((g) => (
              <GroupListItem
                key={g.workItemId}
                name={g.name}
                type={g.type}
                imageUrl={g.imageUrl}
                active={selectedId === g.workItemId}
                unreadCount={g.unreadCount}
                onClick={() => setSelectedId(g.workItemId)}
              />
            ))
          )}
        </div>
      </aside>

      {/* Main panel */}
      <div className={cn("flex-1 min-w-0 w-full flex flex-col min-h-0", !selected && "hidden md:flex")}>
        {selected ? (
          <GroupPanel
            workItemId={selected.workItemId}
            onBack={() => setSelectedId(null)}
            onRead={handleRead}
          />
        ) : (
          <EmptyChatState />
        )}
      </div>
    </div>
  );
}