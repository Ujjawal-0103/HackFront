-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "verification_sessions" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_tokenHash_key" ON "user_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");

-- CreateIndex
CREATE INDEX "user_sessions_tokenHash_idx" ON "user_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "human_verdict_records_reviewerId_idx" ON "human_verdict_records"("reviewerId");

-- CreateIndex
CREATE INDEX "verification_sessions_workspaceId_repositoryId_idx" ON "verification_sessions"("workspaceId", "repositoryId");

-- CreateIndex
CREATE INDEX "verification_sessions_userId_idx" ON "verification_sessions"("userId");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_sessions" ADD CONSTRAINT "verification_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
