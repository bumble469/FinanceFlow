import { MessageCircleMore } from "lucide-react";

export function EmptyChatState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground border border-border/50">
        <MessageCircleMore className="h-7 w-7" />
      </div>
      <div>
        <p className="text-base font-medium text-foreground">Select a connection</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Choose someone from your network to start a conversation.
        </p>
      </div>
    </div>
  );
}