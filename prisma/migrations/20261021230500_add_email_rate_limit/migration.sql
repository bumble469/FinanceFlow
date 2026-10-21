CREATE TABLE "email_rate_limits" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_rate_limits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_rate_limits_ipAddress_createdAt_idx"
    ON "email_rate_limits"("ipAddress", "createdAt");
