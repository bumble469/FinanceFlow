"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Overview", segment: "/" },
  { href: "/plans", label: "Plans", segment: "/plans" },
  { href: "/settings", label: "Settings", segment: "/settings" },
  { href: "/connections", label: "Connections", segment: "/connections" },
];

export function TopNav() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (pathname.startsWith("/plans/") && !pathname.endsWith("/plans")) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          
          {/* ✅ Updated Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/web_logo.png"   
              alt="FinanceFlow Logo"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-semibold text-foreground hidden sm:inline">
              FinanceFlow
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "text-muted-foreground hover:text-foreground",
                    pathname === item.segment &&
                      "bg-muted text-foreground"
                  )}
                >
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="border-t border-border bg-card md:hidden py-3 space-y-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-muted-foreground hover:text-foreground",
                    pathname === item.segment &&
                      "bg-muted text-foreground"
                  )}
                >
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}