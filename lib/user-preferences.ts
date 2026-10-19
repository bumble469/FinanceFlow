import { prisma } from "@/lib/prisma";
import {
  DEFAULT_CONNECTION_PREFS,
  type ConnectionPrefs,
} from "@/lib/types";

export type { ConnectionPrefs };
export { DEFAULT_CONNECTION_PREFS };

/**
 * Read the CONNECTIONS preference row for a user.
 *
 * Falls back to the legacy flat `users.autoConnectWithCoworkers` column when
 * the user has no preference row yet, so behaviour is unchanged for users who
 * existed before the normalized model.
 */
export async function getConnectionPrefs(userId: string): Promise<ConnectionPrefs> {
  const row = await prisma.userPreference.findUnique({
    where: { userId_module: { userId, module: "CONNECTIONS" } },
    select: { settings: true },
  });

  if (!row) {
    const legacy = await prisma.user.findUnique({
      where: { id: userId },
      select: { autoConnectWithCoworkers: true },
    });
    return {
      ...DEFAULT_CONNECTION_PREFS,
      autoConnectWithCoworkers: legacy?.autoConnectWithCoworkers ?? true,
    };
  }

  const settings = (row.settings ?? {}) as Partial<ConnectionPrefs>;
  return { ...DEFAULT_CONNECTION_PREFS, ...settings };
}

/**
 * Merge a patch into the user's CONNECTIONS preference row.
 */
export async function setConnectionPrefs(
  userId: string,
  patch: Partial<ConnectionPrefs>
): Promise<ConnectionPrefs> {
  const current = await getConnectionPrefs(userId);
  const next = { ...current, ...patch };

  await prisma.userPreference.upsert({
    where: { userId_module: { userId, module: "CONNECTIONS" } },
    create: {
      userId,
      module: "CONNECTIONS",
      settings: next as object,
    },
    update: { settings: next as object },
  });

  // Keep the legacy column in sync so existing code paths (lib/auto-connect.ts)
  // still read the right value.
  if (patch.autoConnectWithCoworkers !== undefined) {
    await prisma.user.update({
      where: { id: userId },
      data: { autoConnectWithCoworkers: patch.autoConnectWithCoworkers },
    });
  }

  return next;
}

/**
 * Read the CONNECTIONS preference rows for many users at once.
 *
 * Used by lib/notify.ts, which needs one lookup for a whole recipient list
 * rather than a query per recipient.
 */
export async function getConnectionPrefsForUsers(
  userIds: string[]
): Promise<Map<string, ConnectionPrefs>> {
  const unique = Array.from(new Set(userIds)).filter(Boolean);
  const result = new Map<string, ConnectionPrefs>();

  if (unique.length === 0) return result;

  const [rows, legacyUsers] = await Promise.all([
    prisma.userPreference.findMany({
      where: { userId: { in: unique }, module: "CONNECTIONS" },
      select: { userId: true, settings: true },
    }),
    // Only needed for users that have no preference row yet.
    prisma.user.findMany({
      where: { id: { in: unique }, preferences: { none: { module: "CONNECTIONS" } } },
      select: { id: true, autoConnectWithCoworkers: true },
    }),
  ]);

  const rowByUser = new Map(rows.map((r) => [r.userId, r]));
  const legacyByUser = new Map(legacyUsers.map((u) => [u.id, u]));

  for (const userId of unique) {
    const row = rowByUser.get(userId);
    if (row) {
      const settings = (row.settings ?? {}) as Partial<ConnectionPrefs>;
      result.set(userId, { ...DEFAULT_CONNECTION_PREFS, ...settings });
    } else {
      const legacy = legacyByUser.get(userId);
      result.set(userId, {
        ...DEFAULT_CONNECTION_PREFS,
        autoConnectWithCoworkers: legacy?.autoConnectWithCoworkers ?? true,
      });
    }
  }

  return result;
}
