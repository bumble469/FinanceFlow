"use client";

import { useState, useEffect } from "react";
import { UserPlus, Check, X, Loader2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

interface RequestItem {
  connectionId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
  };
  createdAt: string;
}

export function RequestsTab() {
  const [incoming, setIncoming] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<{ id: string; type: "accept" | "reject" } | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await authClient.request("/api/connections/request", { method: "GET" });
      setIncoming(res.data.incoming || []);
    } catch (err) {
      console.error("Failed to fetch connection requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (targetUserId: string, action: "accept" | "reject") => {
    try {
      setActionLoading({ id: targetUserId, type: action });
      if (action === "accept") {
        await authClient.request("/api/connections/request", {
          method: "POST",
          data: { targetUserId },
        });
      } else {
        await authClient.request("/api/connections/request", {
          method: "DELETE",
          data: { targetUserId },
        });
      }
      setIncoming((prev) => prev.filter((item) => item.user.id !== targetUserId));
    } catch (err) {
      console.error(`Failed to ${action} request:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Card className="border border-border/50 bg-card p-8 md:p-12 rounded-2xl shadow-sm flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading connection requests...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border border-border/50 bg-card/60 backdrop-blur-sm p-4 md:p-4 rounded-2xl shadow-sm flex flex-col min-h-[400px]">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/40">
        <div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage incoming network connection requests from other users.
          </p>
        </div>
        <span className="inline-flex items-center justify-center bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
          {incoming.length} {incoming.length === 1 ? "Request" : "Requests"}
        </span>
      </div>

      <div className="w-full flex flex-col gap-3 flex-1">
        {incoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center py-12 px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground mb-4 border border-border/50">
              <UserPlus className="h-6 w-6" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">All caught up!</h3>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              You don&apos;t have any pending connection requests at the moment.
            </p>
          </div>
        ) : (
          incoming.map((req) => {
            const isAccepting = actionLoading?.id === req.user.id && actionLoading.type === "accept";
            const isRejecting = actionLoading?.id === req.user.id && actionLoading.type === "reject";
            const isAnyLoading = actionLoading?.id === req.user.id;

            return (
              <div
                key={req.connectionId}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-all duration-200 shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="relative h-11 w-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-semibold text-primary overflow-hidden border border-primary/20 shrink-0">
                    {req.user.image ? (
                      <img src={req.user.image} alt={req.user.name || "User"} className="h-full w-full object-cover" />
                    ) : (
                      (req.user.name || req.user.email)?.[0]?.toUpperCase() || "U"
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-foreground truncate">{req.user.name || "Unnamed User"}</h4>
                    <p className="text-xs text-muted-foreground truncate">{req.user.email}</p>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground/80">
                      <Clock className="h-3 w-3" />
                      <span>Received {new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-9 px-3.5 hover:!bg-red-900 cursor-pointer"
                    onClick={() => handleAction(req.user.id, "reject")}
                    disabled={isAnyLoading}
                  >
                    {isRejecting ? (
                      <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                    ) : (
                      <>
                        <X className="h-4 w-4 mr-1.5" />
                        Decline
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all cursor-pointer"
                    onClick={() => handleAction(req.user.id, "accept")}
                    disabled={isAnyLoading}
                  >
                    {isAccepting ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1.5" />
                        Accept
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}