"use client";

import { GlobalSidebar } from "@/components/layout/global-sidebar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { TopNav } from "@/components/layout/top-nav";
import { useEffect } from "react";
import { getSocket } from "@/lib/socket-client";
import { useChatStore } from "@/lib/chat-store";
import { useFinancialStore } from "@/lib/store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const currentUser = useFinancialStore((s) => s.currentUser);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const markOwnMessagesRead = useChatStore((s) => s.markOwnMessagesRead);

  useEffect(() => {
    const socket = getSocket();

    const handleNewMessage = (payload: { conversationId: string; message: any }) => {
      appendMessage(payload.conversationId, payload.message);
    };
    const handleRead = (payload: { conversationId: string }) => {
      if (currentUser?.id) markOwnMessagesRead(payload.conversationId, currentUser.id);
    };

    socket.on("chat:new-message", handleNewMessage);
    socket.on("chat:read", handleRead);

    return () => {
      socket.off("chat:new-message", handleNewMessage);
      socket.off("chat:read", handleRead);
    };
  }, [appendMessage, markOwnMessagesRead, currentUser?.id]);
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <GlobalSidebar />
      <div className="flex flex-1 flex-col min-h-0 md:pl-[76px]">
        <div className="md:hidden">
          <TopNav />
        </div>
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-6 py-8 pb-24 md:pb-8 lg:px-8 h-full">
            {children}
          </div>
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}