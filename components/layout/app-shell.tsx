"use client";

import { GlobalSidebar } from "@/components/layout/global-sidebar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { TopNav } from "@/components/layout/top-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <GlobalSidebar />
      <div className="flex flex-1 flex-col md:pl-[76px]">
        <TopNav />
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 pb-24 md:pb-8 lg:px-8">
          {children}
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}