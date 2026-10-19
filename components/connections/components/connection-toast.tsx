"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Users, X } from "lucide-react";
import { useConnectionStore } from "@/lib/connection-store";
import { cn } from "@/lib/utils";

const TOAST_LIFETIME_MS = 5000;

function ToastItem({
  id,
  senderName,
  body,
  targetId,
  kind,
  onDismiss,
  onOpen,
}: {
  id: string;
  senderName: string;
  body: string;
  targetId: string;
  kind: "direct" | "group";
  onDismiss: () => void;
  onOpen: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, TOAST_LIFETIME_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const Icon = kind === "group" ? Users : MessageCircle;

  return (
    <button
      onClick={onOpen}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-border bg-popover px-4 py-3 text-left shadow-lg backdrop-blur-sm transition-colors hover:bg-accent cursor-pointer animate-in fade-in slide-in-from-left-2 duration-200"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{senderName}</span>
        <span className="block truncate text-sm text-muted-foreground">{body}</span>
      </span>
      <span
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="opacity-50 transition-opacity hover:opacity-100 cursor-pointer"
        role="button"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

/**
 * Stacked snackbars for incoming connection messages.
 *
 * Anchored top-left, each new toast slides in from the left.
 */
export function ConnectionToastStack() {
  const toasts = useConnectionStore((s) => s.toasts);
  const removeToast = useConnectionStore((s) => s.removeToast);
  const router = useRouter();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed left-4 top-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem
          key={t.id}
          id={t.id}
          senderName={t.senderName}
          body={t.body}
          targetId={t.targetId}
          kind={t.kind}
          onDismiss={() => removeToast(t.id)}
          onOpen={() => {
            removeToast(t.id);
            router.push("/connections");
          }}
        />
      ))}
    </div>
  );
}
