"use client";

import { GlobalSidebar } from "@/components/layout/global-sidebar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { TopNav } from "@/components/layout/top-nav";
import { useEffect } from "react";
import { getSocket } from "@/lib/socket-client";
import { useChatStore } from "@/lib/chat-store";
import { useFinancialStore } from "@/lib/store";
import { useConnectionPrefs } from "@/hooks/use-connection-prefs";
import { ConnectionNotifier } from "@/components/connections/components/connection-notifier";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AppShell({ children, noScroll }: { children: React.ReactNode; noScroll?: boolean }) {
  const pathname = usePathname();
  const isConnections = noScroll || pathname === "/connections";
  const currentUser = useFinancialStore((s) => s.currentUser);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const markOwnMessagesRead = useChatStore((s) => s.markOwnMessagesRead);

  // Loads the Connections preferences and keeps the sidebar badge count fresh.
  useConnectionPrefs();

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

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload(); 
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <GlobalSidebar />
      <div className="flex flex-1 flex-col min-h-0 md:pl-[76px] overflow-x-hidden">
        <div className="md:hidden">
          <TopNav />
        </div>
        <main
          className={cn(
            "flex-1 min-h-0 overflow-x-hidden",
            isConnections ? "overflow-hidden" : "overflow-y-auto"
          )}
        >
          <div
            className={cn(
              "mx-auto w-full max-w-7xl",
              isConnections
                ? "h-full p-3 md:p-6 pb-20 md:pb-6 overflow-hidden"
                : "min-h-full px-6 py-8 pb-24 md:pb-8 lg:px-8"
            )}
          >
            {children}
          </div>
        </main>
      </div>
      <MobileTabBar />
      <ConnectionNotifier />
    </div>
  );
}