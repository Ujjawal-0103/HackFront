-- AlterTable
ALTER TABLE "evidence_records" ADD COLUMN     "sourceRecordId" TEXT;

-- CreateTable
CREATE TABLE "source_records" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "sourceType" "EvidenceSourceType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "referenceKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "snippet" TEXT,
    "filePath" TEXT,
    "lineStart" INTEGER,
    "lineEnd" INTEGER,
    "metadata" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_assessments" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "confidence" "AIAssessmentConfidence" NOT NULL,
    "rationale" TEXT NOT NULL,
    "modelIdentifier" TEXT NOT NULL DEFAULT 'heuristics-v1',
    "evidenceRecordIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claim_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "human_verdict_records" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "verdict" "HumanVerdict" NOT NULL,
    "reviewerId" TEXT,
    "reviewNotes" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "human_verdict_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_reports" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "markdownContent" TEXT NOT NULL,
    "jsonPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "source_records_repositoryId_sourceType_idx" ON "source_records"("repositoryId", "sourceType");

-- CreateIndex
CREATE INDEX "source_records_repositoryId_recordedAt_idx" ON "source_records"("repositoryId", "recordedAt");

-- CreateIndex
CREATE INDEX "source_records_referenceKey_idx" ON "source_records"("referenceKey");

-- CreateIndex
CREATE UNIQUE INDEX "source_records_repositoryId_sourceType_externalId_key" ON "source_records"("repositoryId", "sourceType", "externalId");

-- CreateIndex
CREATE INDEX "claim_assessments_claimId_idx" ON "claim_assessments"("claimId");

-- CreateIndex
CREATE INDEX "human_verdict_records_claimId_idx" ON "human_verdict_records"("claimId");

-- CreateIndex
CREATE INDEX "verification_reports_sessionId_idx" ON "verification_reports"("sessionId");

-- CreateIndex
CREATE INDEX "verification_reports_workspaceId_idx" ON "verification_reports"("workspaceId");

-- CreateIndex
CREATE INDEX "evidence_records_sourceRecordId_idx" ON "evidence_records"("sourceRecordId");

-- AddForeignKey
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "source_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_assessments" ADD CONSTRAINT "claim_assessments_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_verdict_records" ADD CONSTRAINT "human_verdict_records_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_verdict_records" ADD CONSTRAINT "human_verdict_records_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_reports" ADD CONSTRAINT "verification_reports_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "verification_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_reports" ADD CONSTRAINT "verification_reports_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex: GIN Full-Text Search on SourceRecord (title + content)
CREATE INDEX IF NOT EXISTS "source_records_fts_idx" ON "source_records" USING gin(to_tsvector('english', "title" || ' ' || "content"));
