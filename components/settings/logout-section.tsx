"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogOut, MonitorX } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useFinancialStore } from "@/lib/store";

type DialogType = "logout" | "logout-all" | null;

export function LogoutSection() {
  const router = useRouter();
  const [openDialog, setOpenDialog] = useState<DialogType>(null);
  const [loading, setLoading] = useState(false);
  const setCurrentUser = useFinancialStore((s) => s.setCurrentUser);

  const handleLogout = async (all: boolean) => {
    setLoading(true);

    try {
      const endpoint = all ? "/api/auth/logout-all" : "/api/auth/logout";

      await authClient.request(endpoint, {
        method: "POST",
      });
      setCurrentUser(null)
      window.location.href = "/";

    } catch (error: any) {
      console.error("Logout failed:", error.response?.data || error);

    } finally {
      setLoading(false);
      setOpenDialog(null);
    }
  };

  return (
    <>
      <Card className="border border-border bg-card p-6">
        <h2 className="text-xl font-semibold text-foreground mb-1">Session</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Manage your active sessions and sign out of your account.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="
                    flex items-center gap-2 cursor-pointer
                    hover:bg-gray-200
                    dark:hover:bg-gray-700
                    hover:text-foreground
                "
            onClick={() => setOpenDialog('logout')}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </Button>

          <Button
            variant="destructive"
            className="
                    flex items-center gap-2 cursor-pointer
                    hover:bg-destructive/90
                    dark:hover:bg-destructive/80
                    hover:text-destructive-foreground
                "
            onClick={() => setOpenDialog('logout-all')}
          >
            <MonitorX className="h-4 w-4" />
            Log out of all devices
          </Button>
        </div>
      </Card>

      {/* Logout Dialog */}
      <Dialog
        open={openDialog === "logout"}
        onOpenChange={(open) => !open && setOpenDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log out</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out of this session?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenDialog(null)}
              disabled={loading}
              className="cursor-pointer hover:text-gray-600"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleLogout(false)}
              disabled={loading}
              className="cursor-pointer hover:!bg-red-900"
            >
              {loading ? "Logging out..." : "Log out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logout All Dialog */}
      <Dialog
        open={openDialog === "logout-all"}
        onOpenChange={(open) => !open && setOpenDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log out of all devices</DialogTitle>
            <DialogDescription>
              This will sign you out of all active sessions across every device.
              You will need to log in again on each device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenDialog(null)}
              disabled={loading}
              className="cursor-pointer hover:text-gray-600"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleLogout(true)}
              disabled={loading}
              className="cursor-pointer hover:!bg-red-900"
            >
              {loading ? "Logging out..." : "Log out of all devices"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}