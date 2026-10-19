-- CreateEnum
CREATE TYPE "PreferenceModule" AS ENUM ('CONNECTIONS', 'NOTIFICATIONS', 'APPEARANCE', 'GENERAL');

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" "PreferenceModule" NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_module_key" ON "user_preferences"("userId", "module");

-- CreateIndex
CREATE INDEX "user_preferences_userId_idx" ON "user_preferences"("userId");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ensure the legacy column exists on the users table (it may have been added
-- outside of a migration; this is a no-op on live DBs that already have it).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "autoConnectWithCoworkers" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: seed a CONNECTIONS preference row for every existing user, carrying
-- over the legacy flat `autoConnectWithCoworkers` column as the starting value.
INSERT INTO "user_preferences" ("id", "userId", "module", "settings", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    u."id",
    'CONNECTIONS'::"PreferenceModule",
    jsonb_build_object(
        'autoConnectWithCoworkers', u."autoConnectWithCoworkers",
        'messageSnackbarEnabled', true,
        'emailNotificationsEnabled', true,
        'unreadBadgeEnabled', true
    ),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "users" u;
