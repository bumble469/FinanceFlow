"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Loader2, UserX, Mail, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { authClient } from "@/lib/auth-client";

interface ConnectionItem {
  connectionId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
  };
  connectedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function OneToOneTab() {
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<ConnectionItem | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authClient.request("/api/connections", {
        method: "GET",
        params: { page, limit: 20, search: search || undefined },
      });
      setConnections(res.data.connections || []);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error("Failed to fetch connections:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Debounce search input -> search state, reset to page 1 on new search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const confirmRemove = async () => {
    if (!pendingRemoval) return;
    const targetUserId = pendingRemoval.user.id;
    try {
      setRemovingId(targetUserId);
      await authClient.request("/api/connections/request", {
        method: "DELETE",
        data: { targetUserId },
      });
      // Refetch current page so pagination/total stays accurate after removal
      await fetchConnections();
    } catch (err) {
      console.error("Failed to remove connection:", err);
    } finally {
      setRemovingId(null);
      setPendingRemoval(null);
    }
  };

  return (
    <>
      <Card className="border border-border/50 bg-card/60 backdrop-blur-sm p-6 md:p-8 rounded-2xl shadow-sm flex flex-col min-h-[400px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border/40">
          <div>
            <h2 className="text-lg font-semibold text-foreground tracking-tight">Your Network</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              People you're connected with across your plans.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search connections..."
                className="h-9 w-48 sm:w-56 pl-8 text-sm"
              />
            </div>
            <span className="inline-flex items-center justify-center bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap">
              {pagination.total} {pagination.total === 1 ? "Connection" : "Connections"}
            </span>
          </div>
        </div>

        <div className="w-full flex flex-col gap-3 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1 py-12">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : connections.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center py-12 px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground mb-4 border border-border/50">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-base font-medium text-foreground mb-1">
                {search ? "No matches found" : "No connections yet"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                {search
                  ? `No connections match "${search}".`
                  : "Accept a request or connect with people in your plans to see them here."}
              </p>
            </div>
          ) : (
            connections.map((c) => {
              const isRemoving = removingId === c.user.id;
              return (
                <div
                  key={c.connectionId}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-all duration-200 shadow-xs"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="relative h-11 w-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-semibold text-primary overflow-hidden border border-primary/20 shrink-0">
                      {c.user.image ? (
                        <img src={c.user.image} alt={c.user.name || "User"} className="h-full w-full object-cover" />
                      ) : (
                        (c.user.name || c.user.email)?.[0]?.toUpperCase() || "U"
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-foreground truncate">{c.user.name || "Unnamed User"}</h4>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {c.user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3.5 text-muted-foreground hover:!bg-red-900 hover:!text-white cursor-pointer"
                      onClick={() => setPendingRemoval(c)}
                      disabled={isRemoving}
                    >
                      {isRemoving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <UserX className="h-4 w-4 mr-1.5" />
                          Remove
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/40">
            <p className="text-xs text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2.5"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2.5"
                disabled={page >= pagination.totalPages || loading}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <AlertDialog open={!!pendingRemoval} onOpenChange={(open) => !open && setPendingRemoval(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove connection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <span className="font-medium text-foreground">{pendingRemoval?.user.name || pendingRemoval?.user.email}</span> from your network. You'll need to send a new request to reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!removingId} className="cursor-pointer hover:text-gray-600">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={!!removingId} className="bg-destructive cursor-pointer text-destructive-foreground hover:bg-destructive/90">
              {removingId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}