import type { EntityType } from "@/lib/chat-types";

export interface ChatCommand {
  type: EntityType;
  name: string; // shown in the list
  aliases: string[]; // also accepted when typed
  description: string;
}

// Order = order shown in the palette
export const CHAT_COMMANDS: ChatCommand[] = [
  { type: "milestone", name: "milestones", aliases: ["milestone"], description: "Attach a milestone" },
  { type: "department", name: "depts", aliases: ["dept", "department", "departments"], description: "Attach a department" },
  { type: "task", name: "tasks", aliases: ["task"], description: "Attach a task" },
  { type: "expense", name: "expenses", aliases: ["expense"], description: "Attach an expense" },
  { type: "document", name: "documents", aliases: ["document", "doc", "docs"], description: "Attach a document" },
  { type: "income", name: "incomes", aliases: ["income"], description: "Attach an income entry" },
];

export interface SlashState {
  word: string; // text after "/" up to the first space
  hasSpace: boolean; // user has moved past the command word
  query: string; // search text after the command
  command: ChatCommand | null; // resolved command (exact name/alias match)
}

export function parseSlash(input: string): SlashState | null {
  if (!input.startsWith("/")) return null;
  const m = input.match(/^\/(\S*)(\s+(?:-\s*)?(.*))?$/);
  if (!m) return null;

  const word = m[1].toLowerCase();
  const command = CHAT_COMMANDS.find((c) => c.name === word || c.aliases.includes(word)) ?? null;
  return { word, hasSpace: m[2] !== undefined, query: (m[3] ?? "").trim(), command };
}

export function matchCommands(word: string) {
  return CHAT_COMMANDS.filter((c) => c.name.startsWith(word) || c.aliases.some((a) => a.startsWith(word)));
}