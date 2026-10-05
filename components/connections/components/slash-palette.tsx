"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { matchCommands, parseSlash, type ChatCommand } from "@/lib/chat-commands";
import { buildIndex, searchIndex, type Indexed } from "@/lib/prefix-search";
import type { EntityCardData, EntityType } from "@/lib/chat-types";
import { EntityCard, ENTITY_META } from "@/components/connections/components/entity-card";

interface Args {
  draft: string;
  setDraft: (v: string) => void;
  conversationId: string | null;
  workItemId: string | null; // null = General → palette disabled
  onPick: (entity: EntityCardData) => void;
}

export function useSlashPalette({ draft, setDraft, conversationId, workItemId, onPick }: Args) {
  const slash = useMemo(() => (workItemId ? parseSlash(draft) : null), [draft, workItemId]);

  // commands: "/" or "/ta" or "/tasks"   entities: "/tasks " or "/tasks pay"
  const mode: "commands" | "entities" | null = !slash
    ? null
    : slash.hasSpace
      ? slash.command
        ? "entities"
        : null
      : "commands";
  const open = mode !== null;

  const commands = useMemo(() => (mode === "commands" ? matchCommands(slash!.word) : []), [mode, slash]);

  // ── entity list: one fetch per command, cached, then filtered in memory ──
  const type: EntityType | null = mode === "entities" ? slash!.command!.type : null;
  const cacheRef = useRef<Map<string, Indexed<EntityCardData>[]>>(new Map());
  const [index, setIndex] = useState<Indexed<EntityCardData>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!type || !conversationId || !workItemId) return;
    const key = `${workItemId}:${type}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setIndex(cached);
      return;
    }

    let cancelled = false;
    setIndex([]);
    setLoading(true);
    authClient
      .request(`/api/conversations/${conversationId}/entities`, {
        method: "GET",
        params: { type, limit: 200 },
      })
      .then((res) => {
        if (cancelled) return;
        const idx = buildIndex<EntityCardData>((res.data.data ?? []) as EntityCardData[], (e) => e.title);
        cacheRef.current.set(key, idx);
        setIndex(idx);
      })
      .catch(() => {
        if (!cancelled) setIndex([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [type, conversationId, workItemId]);

  // Fresh data every time the palette is reopened
  useEffect(() => {
    if (!open) cacheRef.current.clear();
  }, [open]);

  const entities = useMemo(
    () => (mode === "entities" ? searchIndex(index, slash!.query, 20) : []),
    [mode, index, slash]
  );

  // ── keyboard selection ──
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    setActiveIndex(0);
  }, [mode, slash?.word, slash?.query]);

  const count = mode === "commands" ? commands.length : entities.length;

  const pickCommand = useCallback((c: ChatCommand) => setDraft(`/${c.name} `), [setDraft]);
  const pickEntity = useCallback(
    (e: EntityCardData) => {
      onPick(e);
      setDraft("");
    },
    [onPick, setDraft]
  );

  /** Returns true when the palette consumed the key (caller should stop). */
  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (!open) return false;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(count - 1, 0)));
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setDraft("");
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault(); // never send "/xyz" as a message while the palette is open
      if (mode === "commands" && commands[activeIndex]) pickCommand(commands[activeIndex]);
      if (mode === "entities" && entities[activeIndex]) pickEntity(entities[activeIndex]);
      return true;
    }
    return false;
  };

  return { open, mode, commands, entities, loading, activeIndex, setActiveIndex, pickCommand, pickEntity, handleKeyDown };
}

export function SlashPalette({ palette }: { palette: ReturnType<typeof useSlashPalette> }) {
  const { open, mode, commands, entities, loading, activeIndex, setActiveIndex, pickCommand, pickEntity } = palette;
  if (!open) return null;

  // Keeps the keyboard-highlighted row visible
  const follow = (active: boolean) => (el: HTMLElement | null) => {
    if (el && active) el.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="absolute inset-x-0 bottom-full z-20 px-3 pb-2 animate-in slide-in-from-bottom-2 fade-in duration-150">
      <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-lg">
        {mode === "commands" &&
          (commands.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">No matching command</p>
          ) : (
            commands.map((c, i) => {
              const Icon = ENTITY_META[c.type].Icon;
              return (
                <div
                  key={c.name}
                  ref={follow(i === activeIndex)}
                  role="option"
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => pickCommand(c)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2",
                    i === activeIndex && "bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium">/{c.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{c.description}</span>
                </div>
              );
            })
          ))}

        {mode === "entities" &&
          (loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : entities.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nothing found</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {entities.map((e, i) => (
                <div
                  key={e.id}
                  ref={follow(i === activeIndex)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn("rounded-xl", i === activeIndex && "ring-2 ring-primary/40")}
                >
                  <EntityCard entity={e} compact onClick={() => pickEntity(e)} />
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}