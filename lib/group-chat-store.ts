import { create } from "zustand";
import type { Message } from "@/lib/chat-store";
import type { GroupMemberView } from "@/lib/group";

export interface GroupHeader {
  workItem: { id: string; name: string; type: string; status: string; imageUrl?: string | null };
  members: GroupMemberView[];
}

interface GroupChatState {
  messagesByGroup: Record<string, Message[]>;
  headerByGroup: Record<string, GroupHeader>;

  getMessages: (workItemId: string) => Message[] | undefined;
  setMessages: (workItemId: string, messages: Message[]) => void;
  appendMessage: (workItemId: string, message: Message) => void;

  getHeader: (workItemId: string) => GroupHeader | undefined;
  setHeader: (workItemId: string, header: GroupHeader) => void;

  clear: () => void;
}

export const useGroupChatStore = create<GroupChatState>((set, get) => ({
  messagesByGroup: {},
  headerByGroup: {},

  getMessages: (workItemId) => get().messagesByGroup[workItemId],
  setMessages: (workItemId, messages) =>
    set((s) => ({ messagesByGroup: { ...s.messagesByGroup, [workItemId]: messages } })),
  appendMessage: (workItemId, message) =>
    set((s) => {
      const existing = s.messagesByGroup[workItemId] ?? [];
      if (existing.some((m) => m.id === message.id)) return s;
      return { messagesByGroup: { ...s.messagesByGroup, [workItemId]: [...existing, message] } };
    }),

  getHeader: (workItemId) => get().headerByGroup[workItemId],
  setHeader: (workItemId, header) =>
    set((s) => ({ headerByGroup: { ...s.headerByGroup, [workItemId]: header } })),

  clear: () => set({ messagesByGroup: {}, headerByGroup: {} }),
}));