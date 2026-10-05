"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useFinancialStore } from "@/lib/store";
import { getSocket } from "@/lib/socket-client";
import { ContextSelector } from "@/components/connections/components/context-selector";
import { ContextSummaryCard } from "@/components/connections/components/context-summary-card";
import { EntityCard } from "@/components/connections/components/entity-card";
import type { ChatEntity } from "@/lib/chat-types";
import { useChatStore } from "@/lib/chat-store";
import { SlashPalette, useSlashPalette } from "@/components/connections/components/slash-palette";
import { entityHref } from "@/lib/entity-links";

interface ChatPanelProps {
  connectionId: string;
  connection: { user: { id: string; name: string | null; email: string; image?: string | null } };
  onBack: () => void;
}

export function ChatPanel({ connectionId, connection, onBack }: ChatPanelProps) {
  const currentUser = useFinancialStore((s) => s.currentUser);
  const { user } = connection;

  const cachedConversationId = useChatStore((s) => s.getCachedConversationId(connectionId));
  const conversationId = cachedConversationId ?? null;
  const messages = useChatStore((s) => (conversationId ? s.messagesByConversation[conversationId] : undefined)) ?? [];
  const setConversationIdCache = useChatStore((s) => s.setConversationId);
  const setMessagesCache = useChatStore((s) => s.setMessages);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const setContextCache = useChatStore((s) => s.setContext);
  const context = useChatStore((s) => (conversationId ? s.contextByConversation[conversationId] : undefined));
  const [contextLoading, setContextLoading] = useState(false);
  const [attachment, setAttachment] = useState<ChatEntity | null>(null);
  const router = useRouter();

  const [loading, setLoading] = useState(!cachedConversationId);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Partner changed the conversation context
  useEffect(() => {
    if (!conversationId) return;
    const socket = getSocket();
    const handleContextChanged = (payload: { conversationId: string; activeWorkItemId: string | null }) => {
      if (payload.conversationId !== conversationId) return;
      setAttachment(null);
      const prev = useChatStore.getState().contextByConversation[conversationId];
      if (prev) setContextCache(conversationId, { ...prev, activeWorkItemId: payload.activeWorkItemId });
    };
    socket.on("chat:context-changed", handleContextChanged);
    return () => {
      socket.off("chat:context-changed", handleContextChanged);
    };
  }, [conversationId, setContextCache]);

  // 1. Emit typing status when draft changes
  useEffect(() => {
    if (!conversationId) return;
    const socket = getSocket();
    const recipientId = user?.id; // Optional chaining just in case

    if (!recipientId) return;

    if (draft.trim().length > 0) {
      socket.emit("chat:typing", { recipientId, conversationId, connectionId, isTyping: true });
      console.log("typing socket emitting")
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("chat:typing", { recipientId, conversationId, connectionId, isTyping: false });
      }, 2000);
    } else {
      socket.emit("chat:typing", { recipientId, conversationId, connectionId, isTyping: false });
    }

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [draft, conversationId, connectionId, user?.id]); // <-- Fixed size, primitive values only!

  // 2. Listen for partner typing events inside the panel
  useEffect(() => {
    const socket = getSocket();

    const handleTypingEvent = (payload: { conversationId: string; isTyping: boolean }) => {
      if (payload.conversationId === conversationId) {
        setIsPartnerTyping(payload.isTyping);
      }
    };

    socket.on("chat:typing", handleTypingEvent);
    return () => {
      socket.off("chat:typing", handleTypingEvent);
    };
  }, [conversationId]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const cachedConvId = useChatStore.getState().getCachedConversationId(connectionId);
      const cachedMsgs = cachedConvId ? useChatStore.getState().getCachedMessages(cachedConvId) : undefined;

      if (cachedConvId && cachedMsgs) {
        setLoading(false);
        authClient.request(`/api/conversations/${cachedConvId}/read`, { method: "PATCH" }).catch(() => { });
        authClient
          .request(`/api/connections/${connectionId}/conversation`, { method: "GET" })
          .then((r) => {
            if (cancelled) return;
            setContextCache(cachedConvId, {
              activeWorkItemId: r.data.data.activeWorkItemId ?? null,
              sharedWorkItems: r.data.sharedWorkItems ?? [],
            });
          })
          .catch(() => { });
        return;
      }

      setLoading(true);
      try {
        const convRes = await authClient.request(`/api/connections/${connectionId}/conversation`, { method: "GET" });
        const convId = convRes.data.data.id;
        if (cancelled) return;
        setConversationIdCache(connectionId, convId);
        setContextCache(convId, {
          activeWorkItemId: convRes.data.data.activeWorkItemId ?? null,
          sharedWorkItems: convRes.data.sharedWorkItems ?? [],
        });

        const msgRes = await authClient.request(`/api/conversations/${convId}/messages`, { method: "GET" });
        if (cancelled) return;
        setMessagesCache(convId, msgRes.data.data);

        authClient.request(`/api/conversations/${convId}/read`, { method: "PATCH" }).catch((err) =>
          console.error("Failed to mark read:", err)
        );
      } catch (err) {
        console.error("Failed to load conversation:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [connectionId, setConversationIdCache, setMessagesCache, setContextCache]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const palette = useSlashPalette({
    draft,
    setDraft,
    conversationId,
    workItemId: context?.activeWorkItemId ?? null,
    onPick: (entity) => setAttachment(entity),
  });

  const handleSend = async () => {
    const body = draft.trim();
    const pending = attachment;
    if ((!body && !pending) || !conversationId || sending || palette.open) return;

    setSending(true);
    setDraft("");
    setAttachment(null);

    const socket = getSocket();
    socket.emit("chat:typing", { recipientId: user.id, conversationId, connectionId, isTyping: false });

    try {
      const res = await authClient.request(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        data: { body, ...(pending ? { entity: { type: pending.type, id: pending.id } } : {}) },
      });
      appendMessage(conversationId, res.data.data);
    } catch (err) {
      console.error("Failed to send message:", err);
      setDraft(body);
      setAttachment(pending);
    } finally {
      setSending(false);
    }
  };

  const handleChangeContext = async (workItemId: string | null) => {
    if (!conversationId || !context) return;
    const previous = context;
    setAttachment(null);
    setContextCache(conversationId, { ...context, activeWorkItemId: workItemId }); // optimistic
    setContextLoading(true);
    try {
      await authClient.request(`/api/connections/${connectionId}/conversation`, {
        method: "PATCH",
        data: { workItemId },
      });
    } catch (err) {
      console.error("Failed to change context:", err);
      setContextCache(conversationId, previous); // rollback
    } finally {
      setContextLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="md:hidden flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="relative h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-semibold text-primary overflow-hidden border border-primary/20">
          {user.image ? (
            <img src={user.image} alt={user.name || "User"} className="h-full w-full object-cover" />
          ) : (
            (user.name || user.email)[0]?.toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{user.name || "Unnamed User"}</p>
          {isPartnerTyping ? (
            <p className="text-xs text-primary font-medium animate-pulse truncate">typing...</p>
          ) : (
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          )}
        </div>
      </div>

      {/* Context selector + summary */}
      {context && (
        <>
          <ContextSelector
            items={context.sharedWorkItems}
            value={context.activeWorkItemId}
            onChange={handleChangeContext}
            loading={contextLoading}
          />
          {context.activeWorkItemId && conversationId && (
            <ContextSummaryCard conversationId={conversationId} workItemId={context.activeWorkItemId} />
          )}
        </>
      )}

      {/* Message area */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 flex flex-col gap-2">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">This is the start of your conversation with {user.name || user.email}.</p>
          </div>
        ) : (
                    messages.map((m, idx) => {
            const isOwn = m.senderId === currentUser?.id;
            const prevCtx = idx === 0 ? null : messages[idx - 1].workItemId ?? null;
            const curCtx = m.workItemId ?? null;
            const showDivider = curCtx !== prevCtx;
            const canOpen = !!m.workItemId && !!m.entity && !("unavailable" in m.entity);

            return (
              <Fragment key={m.id}>
                {showDivider && (
                  <div className="flex items-center gap-3 py-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Context: {curCtx ? m.workItem?.name ?? "Work item" : "General"}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${isOwn ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"
                      }`}
                  >
                    {m.entity && (
                      <div className="mb-1.5">
                        <EntityCard
                          entity={m.entity}
                          isOwn={isOwn}
                          onGoTo={
                            canOpen
                              ? () => router.push(entityHref(m.workItemId!, m.entity!.type, m.entity!.id))
                              : undefined
                          }
                        />
                      </div>
                    )}
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
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
            disabled={!context?.activeWorkItemId || loading}
            title={context?.activeWorkItemId ? "Attach with /" : "Select a work item to attach items"}
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
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (palette.handleKeyDown(e)) return;
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              attachment
                ? "Add a message..."
                : context?.activeWorkItemId
                  ? "Type a message or / to attach..."
                  : "Type a message..."
            }
            disabled={loading}
            className="flex-1 min-w-0 rounded-full border border-border bg-secondary/40 px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={handleSend}
            disabled={(!draft.trim() && !attachment) || sending || loading || palette.open}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}