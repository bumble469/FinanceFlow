import { cn } from "@/lib/utils";

interface GroupListItemProps {
  name: string;
  type: string;
  imageUrl?: string | null;
  active?: boolean;
  unreadCount?: number;
  onClick: () => void;
}

export function GroupListItem({ name, type, imageUrl, active, unreadCount = 0, onClick }: GroupListItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer",
        active ? "bg-primary/10" : "hover:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-semibold text-primary border border-primary/20">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            name?.[0]?.toUpperCase() || "G"
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{type === "PROJECT" ? "Project" : "Event"} group</p>
        </div>
      </div>

      {unreadCount > 0 && (
        <span className="flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground shrink-0">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}