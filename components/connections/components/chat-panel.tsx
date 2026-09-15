"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useFinancialStore } from "@/lib/store";
import { getSocket } from "@/lib/socket-client";
import { useChatStore } from "@/lib/chat-store";

interface Message {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  readAt: string | null;
  sender: { id: string; name: string | null; image: string | null };
}

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

  const [loading, setLoading] = useState(!cachedConversationId);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        return;
      }

      setLoading(true);
      try {
        const convRes = await authClient.request(`/api/connections/${connectionId}/conversation`, { method: "GET" });
        const convId = convRes.data.data.id;
        if (cancelled) return;
        setConversationIdCache(connectionId, convId);

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
  }, [connectionId, setConversationIdCache, setMessagesCache]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !conversationId || sending) return;

    setSending(true);
    setDraft("");

    // Immediately stop typing indicator on send
    const socket = getSocket();
    socket.emit("chat:typing", { recipientId: user.id, conversationId, connectionId, isTyping: false });

    try {
      const res = await authClient.request(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        data: { body },
      });
      appendMessage(conversationId, res.data.data);
    } catch (err) {
      console.error("Failed to send message:", err);
      setDraft(body);
    } finally {
      setSending(false);
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
          messages.map((m) => {
            const isOwn = m.senderId === currentUser?.id;
            return (
              <div key={m.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${isOwn ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"
                    }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-[10px] mt-0.5 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-3 border-t border-border shrink-0">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
          placeholder="Type a message..."
          disabled={loading}
          className="flex-1 rounded-full border border-border bg-secondary/40 px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
        />
        <Button size="icon" className="h-9 w-9 shrink-0 rounded-full" onClick={handleSend} disabled={!draft.trim() || sending || loading}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}