import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPlanAccess, type PlanAccess } from "@/lib/get-plan-access";
import { ENTITY_TYPES, humanize, type ChatEntity, type EntityCardData, type EntityType } from "@/lib/chat-types";

interface ListArgs {
  workItemId: string;
  access: PlanAccess;
  currency: string;
  ids?: string[];
  search?: string;
  take?: number;
}
type Lister = (a: ListArgs) => Promise<EntityCardData[]>;

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const byIds = (ids?: string[]) => (ids ? { id: { in: ids } } : {});
const ci = (search: string) => ({ contains: search, mode: "insensitive" as const });

// Decimal → Number before formatting (avoids string-concat bugs)
function money(value: Prisma.Decimal | number | null, currency: string) {
  const n = Number(value ?? 0);
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString("en-IN")}`;
  }
}

// Mirrors GET /api/plan/[id]/expenses: OWNER/ADMIN/CO_ADMIN see all,
// everyone else sees their departments' expenses + ones they requested.
function expenseScope(access: PlanAccess): Prisma.ExpenseWhereInput {
  const unrestricted = access.isOwner || access.role === "ADMIN" || access.role === "CO_ADMIN";
  if (unrestricted) return {};
  return {
    OR: [
      ...(access.departmentIds?.length ? [{ departmentId: { in: access.departmentIds } }] : []),
      { requestedById: access.memberId ?? "__none__" },
    ],
  };
}

// One lister per entity type. Add a new entity = add one entry here.
const listers: Record<EntityType, Lister> = {
  task: async ({ workItemId, ids, search, take }) => {
    const rows = await prisma.task.findMany({
      where: { workItemId, ...byIds(ids), ...(search ? { title: ci(search) } : {}) },
      orderBy: { updatedAt: "desc" },
      take,
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        members: { select: { workItemMember: { select: { user: { select: { name: true } } } } } },
      },
    });
    return rows.map((t): EntityCardData => {
      const names = t.members.map((m) => m.workItemMember.user.name ?? "Unnamed");
      return {
        type: "task",
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: iso(t.dueDate),
        details: names.length ? [`Assigned: ${names.join(", ")}`] : [],
      };
    });
  },

  milestone: async ({ workItemId, ids, search, take }) => {
    const rows = await prisma.milestone.findMany({
      where: { workItemId, ...byIds(ids), ...(search ? { title: ci(search) } : {}) },
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true, title: true, status: true, dueDate: true, _count: { select: { tasks: true } } },
    });
    return rows.map((m): EntityCardData => ({
      type: "milestone",
      id: m.id,
      title: m.title,
      status: m.status,
      dueDate: iso(m.dueDate),
      details: [`${m._count.tasks} tasks`],
    }));
  },

  department: async ({ workItemId, ids, search, take }) => {
    const rows = await prisma.department.findMany({
      where: { workItemId, ...byIds(ids), ...(search ? { name: ci(search) } : {}) },
      orderBy: { name: "asc" },
      take,
      select: { id: true, name: true, _count: { select: { members: true, tasks: true } } },
    });
    return rows.map((d): EntityCardData => ({
      type: "department",
      id: d.id,
      title: d.name,
      status: null,
      dueDate: null,
      details: [`${d._count.members} members`, `${d._count.tasks} tasks`],
    }));
  },

  expense: async ({ workItemId, access, currency, ids, search, take }) => {
    const rows = await prisma.expense.findMany({
      where: {
        workItemId,
        AND: [expenseScope(access), byIds(ids), search ? { description: ci(search) } : {}],
      },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, description: true, category: true, amount: true, status: true },
    });
    return rows.map((e): EntityCardData => ({
      type: "expense",
      id: e.id,
      title: e.description?.trim() || `${humanize(e.category)} expense`,
      status: e.status,
      dueDate: null,
      details: [money(e.amount, currency), humanize(e.category)],
    }));
  },

  document: async ({ workItemId, ids, search, take }) => {
    const rows = await prisma.workItemDocument.findMany({
      where: { workItemId, ...byIds(ids), ...(search ? { title: ci(search) } : {}) },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, title: true, type: true, fileName: true },
    });
    return rows.map((d): EntityCardData => ({
      type: "document",
      id: d.id,
      title: d.title,
      status: null,
      dueDate: null,
      details: [d.type === "FILE" ? d.fileName ?? "File" : "Note"],
    }));
  },

  income: async ({ workItemId, currency, ids, search, take }) => {
    const rows = await prisma.income.findMany({
      where: {
        workItemId,
        ...byIds(ids),
        ...(search ? { OR: [{ source: ci(search) }, { description: ci(search) }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, type: true, source: true, amount: true, receivedAmount: true, status: true },
    });
    return rows.map((i): EntityCardData => ({
      type: "income",
      id: i.id,
      title: i.source?.trim() || `${humanize(i.type)} income`,
      status: i.status,
      dueDate: null,
      details: [
        i.amount != null ? money(i.amount, currency) : "Amount TBD",
        ...(i.status === "PARTIAL" ? [`Received ${money(i.receivedAmount, currency)}`] : []),
      ],
    }));
  },
};

async function currencyOf(workItemId: string) {
  const wi = await prisma.workItem.findUnique({ where: { id: workItemId }, select: { currency: true } });
  return wi?.currency ?? "USD";
}

/** Picker / palette search. `access` must already be verified by the caller. */
export async function searchEntities(
  workItemId: string,
  access: PlanAccess,
  type: EntityType,
  opts: { search?: string; take?: number } = {}
) {
  const currency = await currencyOf(workItemId);
  return listers[type]({ workItemId, access, currency, search: opts.search, take: opts.take ?? 20 });
}

export interface EntityRefInput {
  type: string;
  id: string;
  workItemId: string | null;
}

export const entityKey = (type: string, id: string) => `${type}:${id}`;

const isEntityType = (t: string): t is EntityType => (ENTITY_TYPES as readonly string[]).includes(t);

/**
 * Builds cards for a specific VIEWER. Anything the viewer can't access, or that
 * doesn't belong to the message's work item, stays { unavailable: true }.
 */
export async function resolveEntities(viewerId: string, refs: EntityRefInput[]) {
  const result = new Map<string, ChatEntity>();

  const valid = refs.filter(
    (r): r is EntityRefInput & { type: EntityType; workItemId: string } =>
      !!r.workItemId && isEntityType(r.type)
  );
  for (const r of valid) {
    result.set(entityKey(r.type, r.id), { type: r.type, id: r.id, unavailable: true });
  }

  const byWorkItem = new Map<string, typeof valid>();
  for (const r of valid) byWorkItem.set(r.workItemId, [...(byWorkItem.get(r.workItemId) ?? []), r]);

  await Promise.all(
    Array.from(byWorkItem.entries()).map(async ([workItemId, list]) => {
      const access = await getPlanAccess(workItemId, viewerId);
      if (!access) return;
      const currency = await currencyOf(workItemId);

      for (const type of ENTITY_TYPES) {
        const ids = list.filter((r) => r.type === type).map((r) => r.id);
        if (!ids.length) continue;
        // workItemId is enforced inside each lister's `where`
        const cards = await listers[type]({ workItemId, access, currency, ids });
        for (const c of cards) result.set(entityKey(c.type, c.id), c);
      }
    })
  );

  return result;
}

export async function attachEntities<
  T extends { entityType: string | null; entityId: string | null; workItemId: string | null }
>(viewerId: string, messages: T[]): Promise<(T & { entity: ChatEntity | null })[]> {
  const refs = messages
    .filter((m) => m.entityType && m.entityId)
    .map((m) => ({ type: m.entityType!, id: m.entityId!, workItemId: m.workItemId }));

  const map = refs.length ? await resolveEntities(viewerId, refs) : new Map<string, ChatEntity>();

  return messages.map((m) => {
    if (!m.entityType || !m.entityId) return { ...m, entity: null };
    const found = map.get(entityKey(m.entityType, m.entityId));
    const fallback: ChatEntity = {
      type: isEntityType(m.entityType) ? m.entityType : "task",
      id: m.entityId,
      unavailable: true,
    };
    return { ...m, entity: found ?? fallback };
  });
}