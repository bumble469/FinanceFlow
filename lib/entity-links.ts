import type { EntityType } from "@/lib/chat-types";

// Which dashboard section (ids from navItems in sidebar.tsx) each entity lives in.
// Adjust here if any of these land on the wrong tab.
export const ENTITY_SECTION: Record<EntityType, string> = {
  task: "workspace",
  milestone: "event", // "Planning"
  department: "team",
  expense: "expenses",
  income: "expenses",
  document: "reports",
};

export function entityHref(workItemId: string, type: EntityType, id: string) {
  // `focus` isn't consumed yet; sections will read it later to open the exact item
  return `/plans/${workItemId}?section=${ENTITY_SECTION[type]}&focus=${type}:${id}`;
}