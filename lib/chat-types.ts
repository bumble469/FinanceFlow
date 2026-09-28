export const ENTITY_TYPES = ["task", "milestone", "department", "expense", "document", "income"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export interface EntityCardData {
  type: EntityType;
  id: string;
  title: string;
  status: string | null;
  dueDate: string | null;
  details: string[];
}

// Viewer has no access, or the entity was deleted / moved
export interface UnavailableEntity {
  type: EntityType;
  id: string;
  unavailable: true;
}

export type ChatEntity = EntityCardData | UnavailableEntity;

export const humanize = (s: string) =>
  s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");