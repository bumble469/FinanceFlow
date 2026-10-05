"use client";

import { Fragment, useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Loader2, Plus, BarChart2, Flag, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useFinancialStore } from "@/lib/store";
import { getSocket } from "@/lib/socket-client";
import { EntityCard } from "@/components/connections/components/entity-card";
import { SlashPalette, useSlashPalette } from "@/components/connections/components/slash-palette";
import { entityHref } from "@/lib/entity-links";
import { humanize, getRoleColor } from "@/lib/chat-types";
import type { ChatEntity } from "@/lib/chat-types";
import { useGroupChatStore } from "@/lib/group-chat-store";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface GroupPanelProps {
  workItemId: string;
  onBack: () => void;
  onRead: (workItemId: string) => void;
}

/** Renders highlighted @mentions in message body text */
function MessageBody({ body }: { body: string }) {
  const parts = body.split(/(@\w[\w\s]*)/g);
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="font-semibold text-primary/90 bg-primary/10 rounded px-0.5">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </p>
  );
}

/** Inline context summary card built from group header data */
function GroupContextCard({ workItemId, name, type }: { workItemId: string; name: string; type: string }) {
  const [stats, setStats] = useState<{ tasks: number; milestones: number } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authClient
      .request(`/api/plan/${workItemId}`, { method: "GET" })
      .then((res) => {
        if (cancelled) return;
        const data = res.data.data;
        setStats({
          tasks: data.tasks?.length ?? 0,
          milestones: data.milestones?.length ?? 0,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [workItemId]);

  return (
    <div className="px-4 py-2 border-b border-border shrink-0">
      <div className="rounded-xl border border-border bg-card/80 px-3 py-2">
        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="md:hidden flex w-full items-center justify-between gap-2 text-left cursor-pointer"
        >
          <span className="text-xs font-medium truncate text-muted-foreground">
            {name} · {type.toLowerCase()}
          </span>
          <BarChart2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>

        {/* Always visible on md+ */}
        <div className={cn("md:flex items-center gap-4", expanded ? "flex mt-2" : "hidden")}>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{name}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{type.toLowerCase()}</p>
          </div>
          {stats ? (
            <div className="flex items-center gap-3 shrink-0">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <CheckSquare className="h-3 w-3" /> {stats.tasks} tasks
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Flag className="h-3 w-3" /> {stats.milestones} milestones
              </span>
            </div>
          ) : (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
          <Link
            href={`/plans/${workItemId}`}
            className="shrink-0 text-[11px] font-medium text-primary hover:underline"
          >
            Open →
          </Link>
        </div>
      </div>
    </div>
  );
}

/** @ mention picker */
interface MentionPickerProps {
  query: string;
  members: { id: string; name: string | null; email: string; image?: string | null }[];
  onPick: (name: string) => void;
  onDismiss: () => void;
}

function MentionPicker({ query, members, onPick, onDismiss }: MentionPickerProps) {
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return members.filter(
      (m) =>
        (m.name?.toLowerCase() ?? "").includes(q) ||
        m.email.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [query, members]);

  useEffect(() => {
    if (filtered.length === 0) onDismiss();
  }, [filtered.length, onDismiss]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-3 right-3 mb-1 rounded-xl border border-border bg-popover shadow-lg overflow-hidden z-50">
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
        Mention a member
      </p>
      {filtered.map((m) => (
        <button
          key={m.id}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onPick(m.name || m.email.split("@")[0]); }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted cursor-pointer transition-colors"
        >
          <div className="h-6 w-6 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary overflow-hidden">
            {m.image ? (
              <img src={m.image} alt={m.name ?? m.email} className="h-full w-full object-cover" />
            ) : (
              (m.name || m.email)[0]?.toUpperCase()
            )}
          </div>
          <span className="truncate flex-1">{m.name || m.email}</span>
          {m.name && <span className="text-[10px] text-muted-foreground truncate">{m.email}</span>}
        </button>
      ))}
    </div>
  );
}

export function GroupPanel({ workItemId, onBack, onRead }: GroupPanelProps) {
  const currentUser = useFinancialStore((s) => s.currentUser);
  const router = useRouter();

  const header = useGroupChatStore((s) => s.getHeader(workItemId));
  const messages = useGroupChatStore((s) => s.getMessages(workItemId)) ?? [];
  const setHeader = useGroupChatStore((s) => s.setHeader);
  const setMessages = useGroupChatStore((s) => s.setMessages);
  const appendMessage = useGroupChatStore((s) => s.appendMessage);

  const [loading, setLoading] = useState(!header);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<ChatEntity | null>(null);
  const [isViewingDetails, setIsViewingDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // @ mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = picker closed

  const isReadOnly = header?.workItem.status === "ARCHIVED" || header?.workItem.status === "CANCELLED";

  // Load header + messages, mark read
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [headerRes, msgRes] = await Promise.all([
          authClient.request(`/api/groups/${workItemId}`, { method: "GET" }),
          authClient.request(`/api/groups/${workItemId}/messages`, { method: "GET" }),
        ]);
        if (cancelled) return;
        setHeader(workItemId, headerRes.data.data);
        setMessages(workItemId, msgRes.data.data);

        await authClient.request(`/api/groups/${workItemId}/read`, { method: "PATCH" });
        onRead(workItemId);
      } catch (err) {
        console.error("Failed to load group:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [workItemId, setHeader, setMessages, onRead]);

  // New messages from other members
  useEffect(() => {
    const socket = getSocket();
    const handleNew = (payload: { workItemId: string; message: any }) => {
      if (payload.workItemId !== workItemId) return;
      appendMessage(workItemId, payload.message);
      authClient.request(`/api/groups/${workItemId}/read`, { method: "PATCH" }).catch(() => { });
    };
    socket.on("group:new-message", handleNew);
    return () => { socket.off("group:new-message", handleNew); };
  }, [workItemId, appendMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const palette = useSlashPalette({
    draft,
    setDraft,
    conversationId: workItemId,
    workItemId,
    onPick: (entity) => setAttachment(entity),
  });

  // Detect @ in draft
  const handleDraftChange = (value: string) => {
    setDraft(value);
    // Find last @ and extract query after it
    const cursorPos = value.length;
    const lastAt = value.lastIndexOf("@");
    if (lastAt !== -1 && lastAt < cursorPos) {
      const afterAt = value.slice(lastAt + 1);
      // Only show picker if no space since the @ (still in middle of mention)
      if (!afterAt.includes(" ") && afterAt.length <= 20) {
        setMentionQuery(afterAt);
        return;
      }
    }
    setMentionQuery(null);
  };

  const handleMentionPick = (name: string) => {
    // Replace from the last @ to end with @name + space
    const lastAt = draft.lastIndexOf("@");
    const newDraft = draft.slice(0, lastAt) + `@${name} `;
    setDraft(newDraft);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    const body = draft.trim();
    const pending = attachment;
    if ((!body && !pending) || sending || palette.open || isReadOnly) return;

    setSending(true);
    setDraft("");
    setAttachment(null);
    setMentionQuery(null);

    try {
      const res = await authClient.request(`/api/groups/${workItemId}/messages`, {
        method: "POST",
        data: { body, ...(pending ? { entity: { type: pending.type, id: pending.id } } : {}) },
      });
      appendMessage(workItemId, res.data.data);
    } catch (err) {
      console.error("Failed to send message:", err);
      setDraft(body);
      setAttachment(pending);
    } finally {
      setSending(false);
    }
  };

  if (loading || !header) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (isViewingDetails) {
    const filteredMembers = header.members.filter(m =>
      (m.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.email || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="flex-1 flex flex-col h-full min-h-0 bg-background">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <button onClick={() => setIsViewingDetails(false)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold text-foreground">Group Info</p>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col items-center">
          <div className="py-8 flex flex-col items-center border-b border-border w-full">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-semibold text-3xl text-primary border border-primary/20 mb-4">
              {header.workItem.name[0]?.toUpperCase()}
            </div>
            <h2 className="text-xl font-semibold">{header.workItem.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Group • {header.members.length} members
            </p>
          </div>

          <div className="w-full max-w-2xl px-4 py-6">
            <div className="flex flex-col mb-4">
              <h3 className="text-sm font-semibold mb-3">{header.members.length} members</h3>
              <input
                type="text"
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>

            <div className="flex flex-col gap-1">
              {filteredMembers.map(m => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-semibold text-primary overflow-hidden border border-primary/20">
                    {m.image ? (
                      <img src={m.image} alt={m.name ?? m.email} className="h-full w-full object-cover" />
                    ) : (
                      (m.name || m.email)[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{m.name || m.email}</p>
                    <span className={`inline-flex mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full border font-medium uppercase tracking-wider ${getRoleColor(m.role)}`}>
                      {humanize(m.role)}
                    </span>
                  </div>
                </div>
              ))}
              {filteredMembers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No members found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => setIsViewingDetails(true)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onBack(); }}
          className="md:hidden flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-semibold text-primary border border-primary/20">
          {header.workItem.name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{header.workItem.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {header.members.map(m => m.name?.split(" ")[0] || m.email.split("@")[0]).join(", ")}
          </p>
        </div>
      </div>

      {/* Context summary card */}
      <GroupContextCard
        workItemId={workItemId}
        name={header.workItem.name}
        type={header.workItem.type}
      />

      {isReadOnly && (
        <div className="px-4 py-2 text-center text-xs text-muted-foreground bg-muted/40 border-b border-border">
          This {header.workItem.type === "PROJECT" ? "project" : "event"} is {header.workItem.status.toLowerCase()} — the group is read-only.
        </div>
      )}

      {/* Message area */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 flex flex-col gap-2">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">This is the start of {header.workItem.name}'s group chat.</p>
          </div>
        ) : (
          messages.map((m) => {
            const isOwn = m.senderId === currentUser?.id;
            const canOpen = !!m.entity && !("unavailable" in m.entity);
            return (
              <Fragment key={m.id}>
                <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                      isOwn ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"
                    }`}
                  >
                    {!isOwn && (() => {
                      const senderMember = header.members.find((member) => member.userId === m.senderId);
                      const role = senderMember?.role || "MEMBER";
                      return (
                        <div className="flex items-center gap-1.5 mb-1">
                          <p className="text-[11px] font-semibold text-primary">{m.sender.name ?? "Unnamed"}</p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium uppercase tracking-wider ${getRoleColor(role)}`}>
                            {humanize(role)}
                          </span>
                        </div>
                      );
                    })()}
                    {m.entity && (
                      <div className="mb-1.5">
                        <EntityCard
                          entity={m.entity}
                          onGoTo={canOpen ? () => router.push(entityHref(workItemId, m.entity!.type, m.entity!.id)) : undefined}
                        />
                      </div>
                    )}
                    {m.body && <MessageBody body={m.body} />}
                    <p className={`text-[10px] mt-0.5 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="relative border-t border-border shrink-0">
        <SlashPalette palette={palette} />

        {/* @ mention picker */}
        {mentionQuery !== null && header.members.length > 0 && (
          <MentionPicker
            query={mentionQuery}
            members={header.members}
            onPick={handleMentionPick}
            onDismiss={() => setMentionQuery(null)}
          />
        )}

        {attachment && (
          <div className="px-3 pt-3 pb-2 border-b border-border/60">
            <EntityCard entity={attachment} compact onRemove={() => setAttachment(null)} />
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-3">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0 rounded-full"
            disabled={isReadOnly}
            title="Attach with /"
            onClick={() => {
              if (!draft) setDraft("/");
              inputRef.current?.focus();
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              if (palette.handleKeyDown) {
                handleDraftChange(e.target.value);
              } else {
                handleDraftChange(e.target.value);
              }
            }}
            onKeyDown={(e) => {
              if (palette.handleKeyDown(e)) return;
              if (e.key === "Escape" && mentionQuery !== null) {
                setMentionQuery(null);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isReadOnly
                ? "This group is read-only"
                : attachment
                ? "Add a message..."
                : "Type a message, / to attach, @ to mention..."
            }
            disabled={isReadOnly}
            className="flex-1 min-w-0 rounded-full border border-border bg-secondary/40 px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={handleSend}
            disabled={(!draft.trim() && !attachment) || sending || palette.open || isReadOnly}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}