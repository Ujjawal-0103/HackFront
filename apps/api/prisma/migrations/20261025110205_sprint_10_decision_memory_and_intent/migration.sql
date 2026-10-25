-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('CANDIDATE', 'IN_REVIEW', 'ACCEPTED', 'SUPERSEDED', 'DISPUTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DecisionSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'ADVISORY');

-- CreateTable
CREATE TABLE "engineering_decisions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "targetFilePath" TEXT,
    "targetSymbol" TEXT,
    "status" "DecisionStatus" NOT NULL DEFAULT 'CANDIDATE',
    "severity" "DecisionSeverity" NOT NULL DEFAULT 'MEDIUM',
    "supportingEvidence" JSONB NOT NULL DEFAULT '[]',
    "relatedCommitSha" TEXT,
    "relatedPrNumber" INTEGER,
    "reviewerId" TEXT,
    "reviewerName" TEXT,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "supersedesId" TEXT,
    "supersededById" TEXT,
    "createdFromClaimId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engineering_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intent_check_sessions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "diff" TEXT NOT NULL,
    "filePath" TEXT,
    "changeDescription" TEXT,
    "status" TEXT NOT NULL,
    "conflicts" JSONB NOT NULL DEFAULT '[]',
    "humanDisposition" TEXT,
    "dispositionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intent_check_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "engineering_decisions_workspaceId_repositoryId_idx" ON "engineering_decisions"("workspaceId", "repositoryId");

-- CreateIndex
CREATE INDEX "engineering_decisions_repositoryId_status_idx" ON "engineering_decisions"("repositoryId", "status");

-- CreateIndex
CREATE INDEX "intent_check_sessions_workspaceId_repositoryId_idx" ON "intent_check_sessions"("workspaceId", "repositoryId");

-- AddForeignKey
ALTER TABLE "engineering_decisions" ADD CONSTRAINT "engineering_decisions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engineering_decisions" ADD CONSTRAINT "engineering_decisions_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engineering_decisions" ADD CONSTRAINT "engineering_decisions_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intent_check_sessions" ADD CONSTRAINT "intent_check_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intent_check_sessions" ADD CONSTRAINT "intent_check_sessions_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
