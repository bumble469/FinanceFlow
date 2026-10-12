"use client";
import { useCallback, useEffect, useState } from "react";
import { changelog } from "@/lib/changeLog";

const KEY = "financeflow:changelog-last-seen";
const latestId = changelog[0]?.id;

export function useWhatsNew() {
  const [hasUnseen, setHasUnseen] = useState(false);

  useEffect(() => {
    try {
      setHasUnseen(!!latestId && localStorage.getItem(KEY) !== latestId);
    } catch {}
  }, []);

  const markSeen = useCallback(() => {
    try { if (latestId) localStorage.setItem(KEY, latestId); } catch {}
    setHasUnseen(false);
  }, []);

  return { hasUnseen, markSeen };
}