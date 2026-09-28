import { create } from "zustand";
import type { ChatEntity } from "@/lib/chat-types";

export interface Message {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  readAt: string | null;
  workItemId?: string | null;
  workItem?: { id: string; name: string } | null;
  entityType?: string | null;
  entityId?: string | null;
  entity?: ChatEntity | null;
  sender: { id: string; name: string | null; image: string | null };
}

export interface SharedWorkItem {
  id: string;
  name: string;
  type: "PROJECT" | "EVENT" | "PLAN";
  status: string;
}

export interface ConversationContext {
  activeWorkItemId: string | null;
  sharedWorkItems: SharedWorkItem[];
}

interface ChatState {
  conversationIdByConnection: Record<string, string>;
  messagesByConversation: Record<string, Message[]>;
  contextByConversation: Record<string, ConversationContext>;
  setContext: (conversationId: string, ctx: ConversationContext) => void;

  getCachedConversationId: (connectionId: string) => string | undefined;
  getCachedMessages: (conversationId: string) => Message[] | undefined;

  setConversationId: (connectionId: string, conversationId: string) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  appendMessage: (conversationId: string, message: Message) => void;
  markOwnMessagesRead: (conversationId: string, currentUserId: string) => void;
  clear: () => void; 
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversationIdByConnection: {},
  messagesByConversation: {},
  contextByConversation: {},

  setContext: (conversationId, ctx) =>
    set((s) => ({ contextByConversation: { ...s.contextByConversation, [conversationId]: ctx } })),

  getCachedConversationId: (connectionId) => get().conversationIdByConnection[connectionId],
  getCachedMessages: (conversationId) => get().messagesByConversation[conversationId],

  setConversationId: (connectionId, conversationId) =>
    set((s) => ({ conversationIdByConnection: { ...s.conversationIdByConnection, [connectionId]: conversationId } })),

  setMessages: (conversationId, messages) =>
    set((s) => ({ messagesByConversation: { ...s.messagesByConversation, [conversationId]: messages } })),

  appendMessage: (conversationId, message) =>
    set((s) => {
      const existing = s.messagesByConversation[conversationId] ?? [];
      if (existing.some((m) => m.id === message.id)) return s; // dedupe
      return { messagesByConversation: { ...s.messagesByConversation, [conversationId]: [...existing, message] } };
    }),

  markOwnMessagesRead: (conversationId, currentUserId) =>
    set((s) => {
      const existing = s.messagesByConversation[conversationId];
      if (!existing) return s;
      return {
        messagesByConversation: {
          ...s.messagesByConversation,
          [conversationId]: existing.map((m) =>
            m.senderId === currentUserId && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m
          ),
        },
      };
    }),

    clear: () => set({ conversationIdByConnection: {}, messagesByConversation: {}, contextByConversation: {} }),
}));