"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { Home, LayoutGrid, Cable } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
    { href: "/", label: "Home", icon: Home },
    { href: "/plans", label: "Plans", icon: LayoutGrid },
    { href: "/connections", label: "Connections", icon: Cable },
    // add more here later — same shape: { href, label, icon }
];

export function GlobalSidebar() {
    const pathname = usePathname();
    const router = useRouter();

    return (
                <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 h-screen w-[76px] shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-5">
            <button
                onClick={() => router.push("/")}
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                title="FinanceFlow"
            >
                <Image src="/web_logo.png" alt="FinanceFlow" width={32} height={32} className="rounded-lg" />
            </button>

            <nav className="flex flex-1 flex-col items-center justify-center gap-2">
                {NAV_ITEMS.map((item) => {
                    const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.href}
                            title={item.label}
                            onClick={() => router.push(item.href)}
                            className={cn(
                                "flex h-11 w-11 items-center justify-center rounded-xl transition-colors cursor-pointer",
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            )}
                        >
                            <Icon className="h-5 w-5" />
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
}