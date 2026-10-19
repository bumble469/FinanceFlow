"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Home, LayoutGrid, Cable, Settings, Bell, Sparkles } from "lucide-react";   // add Sparkles
import { useWhatsNew } from "@/hooks/use-whats-new";
import { WhatsNewDialog } from "@/components/whats-new-dialog";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth-client";
import { useFinancialStore } from "@/lib/store";
import { useNotifications } from "@/hooks/use-notifications";
import { useConnectionPrefs } from "@/hooks/use-connection-prefs";
import { NotificationsDialog } from "@/components/dashboard/dialogs/notifications-dialog";

const NAV_ITEMS = [
    { href: "/", label: "Home", icon: Home },
    { href: "/plans", label: "Plans", icon: LayoutGrid },
    { href: "/connections", label: "Connections", icon: Cable },
    { href: "/settings", label: "Settings", icon: Settings },
];

export function GlobalSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const currentUser = useFinancialStore((s) => s.currentUser);
    const setCurrentUser = useFinancialStore((s) => s.setCurrentUser);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
    const { hasUnseen, markSeen } = useWhatsNew();
    const { unreadCount, unreadGeneral, unreadPersonal, general, personal, loading, fetchTab, markRead, markAllRead } = useNotifications();
    const { prefs, unreadCount: connectionUnread } = useConnectionPrefs();

    useEffect(() => {
        if (!currentUser?.id) return;
        authClient
            .request("/api/settings/profile")
            .then((res) => {
                const p = res.data.data;
                setCurrentUser({
                    ...currentUser,
                    name: p.name ?? undefined,
                    image: p.image,
                    headline: p.headline,
                });
            })
            .catch(() => { });
    }, [currentUser?.id]);

    const initials =
        currentUser?.name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() ||
        currentUser?.email?.[0]?.toUpperCase() ||
        "U";

    return (
        <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 h-screen w-[76px] shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-5">
            <button
                onClick={() => router.push("/")}
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                title="FinanceFlow"
            >
                <Image src="/web_logo.png" alt="FinanceFlow" width={32} height={32} className="rounded-lg" />
            </button>

            <button
                title="Notifications"
                onClick={() => setIsNotificationsOpen(true)}
                className="relative mt-4 flex h-10 w-10 items-center justify-center rounded-xl text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer transition-colors"
            >
                <Bell className="h-4.5 w-4.5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-sidebar" />
                )}
            </button>

            <button
                title="What's new"
                onClick={() => {
                    setIsWhatsNewOpen(true);
                    markSeen();
                }}
                className="relative mt-4 flex h-10 w-10 items-center justify-center rounded-xl text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer transition-colors"
            >
                <Sparkles className="h-4.5 w-4.5" />
                {hasUnseen && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar" />
                )}
            </button>

            <nav className="flex flex-1 flex-col items-center justify-center gap-2">
                {NAV_ITEMS.map((item) => {
                    const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    const Icon = item.icon;
                    const badge =
                        item.href === "/connections" && prefs?.unreadBadgeEnabled && connectionUnread > 0
                            ? connectionUnread
                            : 0;
                    return (
                        <button
                            key={item.href}
                            title={item.label}
                            onClick={() => router.push(item.href)}
                            className={cn(
                                "relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors cursor-pointer",
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            {badge > 0 && (
                                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                                    {badge > 99 ? "99+" : badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>


            <NotificationsDialog
                open={isNotificationsOpen}
                onOpenChange={setIsNotificationsOpen}
                contextLabel="System Notifications"
                general={general}
                personal={personal}
                unreadGeneral={unreadGeneral}
                unreadPersonal={unreadPersonal}
                loading={loading}
                onLoadTab={fetchTab}
                onMarkRead={markRead}
                onMarkAllRead={markAllRead}
            />

            <WhatsNewDialog open={isWhatsNewOpen} onOpenChange={setIsWhatsNewOpen} />
        </aside>
    );
}