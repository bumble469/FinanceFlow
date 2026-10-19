"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsSection, SettingsRow } from "@/components/settings/settings-layout";
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
            <SettingsSection
        title="Session"
        description="Manage your active sessions and sign out of your account."
      >
        <SettingsRow action label="Log out" description="Sign out of this device.">
          <Button
            variant="outline"
            className="flex cursor-pointer items-center gap-2 hover:bg-gray-200 hover:text-foreground dark:hover:bg-muted"
            onClick={() => setOpenDialog("logout")}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </SettingsRow>

        <SettingsRow
          action
          label="Log out of all devices"
          description="End every active session. You'll need to log in again everywhere."
        >
          <Button
            variant="destructive"
            className="flex cursor-pointer items-center gap-2 hover:bg-destructive/90 hover:text-destructive-foreground dark:hover:bg-destructive/80"
            onClick={() => setOpenDialog("logout-all")}
          >
            <MonitorX className="h-4 w-4" />
            Log out of all devices
          </Button>
        </SettingsRow>
      </SettingsSection>

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