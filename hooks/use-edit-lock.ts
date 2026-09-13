"use client";
import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket-client";
import { useFinancialStore } from "@/lib/store";

type ItemType = "task" | "phase" | "milestone" | "hardware" | "department" | "expense" | "income" | "ticketType" | "member" | "stall" | "note";
export interface Editor {
  userId: string;
  userName: string;
}

export function useEditLock(itemType: ItemType, itemId: string | null, isDialogOpen: boolean) {
  const { currentPlanId, currentPlanMeta, currentUser } = useFinancialStore();
  const allowMultipleEditing = currentPlanMeta?.allowMultipleEditing ?? true;

  const [locked, setLocked] = useState(false);
  const [lockedByName, setLockedByName] = useState<string | null>(null);
  const [otherEditors, setOtherEditors] = useState<Editor[]>([]);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!isDialogOpen || !itemId || !currentPlanId) {
      setLocked(false);
      setLockedByName(null);
      setOtherEditors([]);
      return;
    }

    const socket = getSocket();
    let heartbeat: ReturnType<typeof setInterval>;

    socket.emit(
      "editing:join",
      { planId: currentPlanId, itemType, itemId, userName: currentUser?.name ?? "Someone", allowMultipleEditing },
      (res: { granted: boolean; lockedByName?: string }) => {
        if (res.granted) {
          joinedRef.current = true;
          setLocked(false);
          heartbeat = setInterval(() => {
            socket.emit("editing:heartbeat", { planId: currentPlanId, itemType, itemId });
          }, 30_000);
        } else {
          joinedRef.current = false;
          setLocked(true);
          setLockedByName(res.lockedByName ?? "another user");
        }
      }
    );

    const onPresence = (data: { itemType: string; itemId: string; editors: Editor[] }) => {
      if (data.itemType !== itemType || data.itemId !== itemId) return;

      const others = data.editors.filter((e) => e.userId !== currentUser?.id);
      setOtherEditors(others);

      // If we were locked out and the other editor(s) have since left, clear the lock.
      setLocked((prevLocked) => (prevLocked && others.length === 0 ? false : prevLocked));
      if (others.length === 0) setLockedByName(null);
    };
    socket.on("editing:presence-update", onPresence);

    return () => {
      clearInterval(heartbeat);
      socket.off("editing:presence-update", onPresence);
      if (joinedRef.current) {
        socket.emit("editing:leave", { planId: currentPlanId, itemType, itemId });
        joinedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDialogOpen, itemId, currentPlanId, allowMultipleEditing, itemType]);

  return { locked, lockedByName, allowMultipleEditing, otherEditors };
}
