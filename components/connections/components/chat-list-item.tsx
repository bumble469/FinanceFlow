// components/connections/components/chat-list-item.tsx
import { cn } from "@/lib/utils";

interface ChatListItemProps {
  name: string;
  email: string;
  image?: string | null;
  active?: boolean;
  unreadCount?: number;
  isTyping?: boolean; 
  onClick: () => void;
}

export function ChatListItem({ 
  name, 
  email, 
  image, 
  active, 
  unreadCount = 0, 
  isTyping = false,
  onClick 
}: ChatListItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer group",
        active ? "bg-primary/10" : "hover:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-semibold text-primary overflow-hidden border border-primary/20">
          {image ? (
            <img src={image} alt={name} className="h-full w-full object-cover" />
          ) : (
            (name || email)?.[0]?.toUpperCase() || "U"
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{name || "Unnamed User"}</p>
          {isTyping ? (
            <p className="text-xs text-primary font-medium animate-pulse truncate">
              typing...
            </p>
          ) : (
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          )}
        </div>
      </div>

      {unreadCount > 0 && !isTyping && (
        <span className="flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground shrink-0 shadow-xs">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}