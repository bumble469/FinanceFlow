import { create } from "zustand";

interface Message {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  readAt: string | null;
  sender: { id: string; name: string | null; image: string | null };
}

interface ChatState {
  conversationIdByConnection: Record<string, string>;
  messagesByConversation: Record<string, Message[]>;

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

  clear: () => set({ conversationIdByConnection: {}, messagesByConversation: {} }),
}));