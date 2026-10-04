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

export const getRoleColor = (role: string) => {
  return (
    {
      ADMIN: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
      CO_ADMIN: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20",
      MANAGER: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
      CO_MANAGER: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
      MEMBER: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20",
    }[role] || "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20"
  );
};