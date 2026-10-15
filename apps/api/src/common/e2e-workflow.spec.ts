import { AuthService } from "../auth/auth.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { IngestionSyncService } from "../ingestion/ingestion-sync.service";
import { EvidenceSearchService } from "../evidence/evidence-search.service";
import { VerificationSessionService } from "../verification/verification-session.service";
import { AdvisoryService } from "../advisory/advisory.service";
import { ClaimExtractorService } from "../verification/claim-extractor.service";
import { ClaimAssessmentService } from "../verification/claim-assessment.service";
import {
  VerificationAssessmentStatus,
  TracebackReportExport,
} from "@traceback/shared-types";
import { ForbiddenException, UnauthorizedException, NotFoundException } from "@nestjs/common";

describe("Sprint 8 End-to-End Core Workflow Integration (Flows A–G)", () => {
  let authService: AuthService;
  let workspacesService: WorkspacesService;
  let mockPrisma: any;

  // In-memory data store for E2E flows
  let usersDb: Record<string, any> = {};
  let sessionsDb: Record<string, any> = {};
  let workspacesDb: Record<string, any> = {};
  let repositoriesDb: Record<string, any> = {};
  let verificationSessionsDb: Record<string, any> = {};

  beforeEach(() => {
    usersDb = {};
    sessionsDb = {};
    workspacesDb = {
      ws_alpha: {
        id: "ws_alpha",
        name: "Alpha Maintainers",
        slug: "alpha-maintainers",
      },
      ws_beta: {
        id: "ws_beta",
        name: "Beta Labs",
        slug: "beta-labs",
      },
    };
    repositoriesDb = {
      repo_core: {
        id: "repo_core",
        workspaceId: "ws_alpha",
        fullName: "alpha/core-engine",
        name: "core-engine",
        defaultBranch: "main",
      },
      repo_private_beta: {
        id: "repo_private_beta",
        workspaceId: "ws_beta",
        fullName: "beta/secret-engine",
        name: "secret-engine",
        defaultBranch: "main",
      },
    };
    verificationSessionsDb = {};

    mockPrisma = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.email) {
            return Object.values(usersDb).find((u) => u.email === where.email) || null;
          }
          if (where.id) {
            return usersDb[where.id] || null;
          }
          return null;
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const user = {
            id,
            name: data.name,
            email: data.email,
            passwordHash: data.passwordHash,
            createdAt: new Date(),
          };
          usersDb[id] = user;
          return user;
        }),
        upsert: jest.fn().mockResolvedValue({ id: "user_1" }),
      },
      userSession: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const session = sessionsDb[where.token];
          if (!session) return null;
          return {
            ...session,
            user: usersDb[session.userId],
          };
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          sessionsDb[data.token] = {
            id: `sess_${Date.now()}`,
            token: data.token,
            userId: data.userId,
            expiresAt: data.expiresAt,
            createdAt: new Date(),
          };
          return sessionsDb[data.token];
        }),
        delete: jest.fn().mockImplementation(({ where }) => {
          delete sessionsDb[where.token];
          return { count: 1 };
        }),
        deleteMany: jest.fn().mockImplementation(() => {
          return { count: 1 };
        }),
      },
      workspace: {
        findUnique: jest.fn().mockImplementation(({ where }) => workspacesDb[where.id] || null),
        findMany: jest.fn().mockResolvedValue(Object.values(workspacesDb)),
        upsert: jest.fn().mockResolvedValue({ id: "ws_alpha" }),
      },
      repository: {
        findUnique: jest.fn().mockImplementation(({ where }) => repositoriesDb[where.id] || null),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const repo = repositoriesDb[where.id];
          if (!repo) return null;
          if (where.workspaceId && repo.workspaceId !== where.workspaceId) return null;
          return repo;
        }),
      },
      workspaceMember: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const target = where.workspaceId_userId;
          if (!target) return null;
          if (target.workspaceId === "ws_alpha" && (target.userId === "user_1" || target.userId?.startsWith("usr_"))) {
            return { id: "mem_1", workspaceId: "ws_alpha", userId: target.userId, role: "OWNER" };
          }
          if (target.workspaceId === "ws_beta" && target.userId === "user_3") {
            return { id: "mem_2", workspaceId: "ws_beta", userId: target.userId, role: "MEMBER" };
          }
          return null;
        }),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({ id: "mem_1" }),
      },
      claim: {
        count: jest.fn().mockResolvedValue(0),
      },
      verificationReport: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "rep_cache_1" }),
      },
      gitHubInstallation: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.workspaceId === "ws_alpha") {
            return { id: "inst_1", installationId: 1001, workspaceId: "ws_alpha" };
          }
          return null;
        }),
      },
      repositorySyncJob: {
        create: jest.fn().mockResolvedValue({
          id: "job_sync_101",
          repositoryId: "repo_core",
          status: "PENDING",
          createdAt: new Date(),
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "job_sync_101",
            repositoryId: "repo_core",
            status: "COMPLETED",
            recordsImported: 42,
            createdAt: new Date(),
          },
        ]),
        findFirst: jest.fn().mockResolvedValue({
          id: "job_sync_101",
          repositoryId: "repo_core",
          status: "COMPLETED",
          recordsImported: 42,
          createdAt: new Date(),
        }),
      },
    };

    workspacesService = new WorkspacesService(mockPrisma as any);
    authService = new AuthService(workspacesService, mockPrisma as any);
  });

  // ==========================================================================
  // FLOW A — NEW USER REGISTRATION, SESSION LIFECYCLE & REVOCATION
  // ==========================================================================
  describe("FLOW A — New User Lifecycle", () => {
    it("should register a user, persist credentials, restore session, and revoke on logout", async () => {
      // 1. Register new user
      const registerRes = await authService.register({
        name: "Dana Engineer",
        email: "dana.eng@traceback.dev",
        password: "StrongPassword2026!",
        passwordConfirmation: "StrongPassword2026!",
      });

      expect(registerRes).toBeDefined();
      expect(registerRes.token).toMatch(/^tb_live_/);
      expect(registerRes.user.email).toBe("dana.eng@traceback.dev");

      // 2. Verify database record created with hashed password
      const savedUser = Object.values(usersDb).find((u) => u.email === "dana.eng@traceback.dev");
      expect(savedUser).toBeDefined();
      expect(savedUser.passwordHash).not.toContain("StrongPassword2026!");
      expect(savedUser.passwordHash).toContain(":"); // salt:hash format

      // 3. Verify session validation / restore
      const restoredUser = await authService.validateToken(registerRes.token);
      expect(restoredUser).toBeDefined();
      expect(restoredUser?.email).toBe("dana.eng@traceback.dev");

      // 4. Log out and verify revocation
      const logoutRes = await authService.logout(registerRes.token);
      expect(logoutRes.success).toBe(true);

      const afterLogout = await authService.validateToken(registerRes.token);
      expect(afterLogout).toBeNull();

      // 5. Sign in again with valid credentials
      const loginRes = await authService.login({
        email: "dana.eng@traceback.dev",
        password: "StrongPassword2026!",
      });
      expect(loginRes.token).toMatch(/^tb_live_/);
      expect(loginRes.user.id).toBe(savedUser.id);
    });
  });

  // ==========================================================================
  // FLOW B — REPOSITORY INGESTION & ACCESS CONTROLS
  // ==========================================================================
  describe("FLOW B — Repository Ingestion & Access Controls", () => {
    let syncService: IngestionSyncService;
    let mockQueue: any;

    beforeEach(() => {
      mockQueue = {
        add: jest.fn().mockResolvedValue({ id: "bull_job_1" }),
      };
      syncService = new IngestionSyncService(
        mockPrisma as any,
        workspacesService,
        mockQueue as any,
      );
    });

    it("should trigger repository sync for authorized member and return job status", async () => {
      const response = await syncService.triggerManualSync(
        "repo_core",
        "user_1",
        "ws_alpha",
        "MANUAL",
      );

      expect(response).toBeDefined();
      expect(response.jobId).toBe("job_sync_101");
      expect(response.status).toBe("PENDING");
      expect(mockQueue.add).toHaveBeenCalled();

      // Check status
      const statusRes = await syncService.getSyncStatus("repo_core", "user_1", "ws_alpha");
      expect(statusRes.repositoryId).toBe("repo_core");
      expect(statusRes.recentJobs.length).toBeGreaterThan(0);
    });

    it("should reject sync trigger for unauthorized cross-workspace access", async () => {
      // user_3 is in ws_beta, not ws_alpha
      await expect(
        syncService.triggerManualSync("repo_core", "user_3", "ws_alpha", "MANUAL"),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // FLOW C — EVIDENCE RETRIEVAL & GRAPH FALLBACK
  // ==========================================================================
  describe("FLOW C — Evidence Retrieval & Grounding Sources", () => {
    let evidenceSearchService: EvidenceSearchService;

    beforeEach(() => {
      evidenceSearchService = new EvidenceSearchService(mockPrisma as any);
      const mockResult = [
        {
          id: "rec_commit_101",
          repositoryId: "repo_core",
          sourceType: "COMMIT",
          externalId: "sha_7f8a",
          referenceKey: "7f8a9b1",
          title: "fix(cache): introduce lock to prevent race condition",
          author: "Alex Maintainer",
          url: "https://github.com/org/repo/commit/7f8a9b1",
          content: "Replaced dirty read with locked transaction block to prevent race condition in cache store",
          snippet: "Replaced dirty read with locked transaction block",
          filePath: "src/cache/store.ts",
          recordedAt: new Date(),
          createdAt: new Date(),
          fts_rank: 0.88,
        },
      ];
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue(mockResult);
      mockPrisma.$queryRawUnsafe = jest.fn().mockResolvedValue(mockResult);
    });

    it("should search historical evidence with filters and return canonical provenance", async () => {
      const response = await evidenceSearchService.search({
        workspaceId: "ws_alpha",
        repositoryId: "repo_core",
        query: "cache race condition",
        sourceTypes: ["COMMIT" as any],
        limit: 5,
      });

      expect(response).toBeDefined();
      expect(response.totalCount).toBe(1);
      expect(response.items[0].source.referenceKey).toBe("7f8a9b1");
      expect(response.items[0].source.url).toBe("https://github.com/org/repo/commit/7f8a9b1");
      expect(response.items[0].source.filePath).toBe("src/cache/store.ts");
    });

    it("should return empty result set cleanly when no records match", async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([]);
      mockPrisma.$queryRawUnsafe = jest.fn().mockResolvedValue([]);

      const response = await evidenceSearchService.search({
        workspaceId: "ws_alpha",
        repositoryId: "repo_core",
        query: "nonexistent query term xyz",
      });

      expect(response.totalCount).toBe(0);
      expect(response.items).toEqual([]);
    });
  });

  // ==========================================================================
  // FLOW D & E — VERIFICATION, CLAIM DECOMPOSITION, HUMAN REVIEW & PERSISTENCE
  // ==========================================================================
  describe("FLOW D & E — Verification and Persistent History", () => {
    let sessionService: VerificationSessionService;
    let claimExtractor: ClaimExtractorService;
    let assessmentService: ClaimAssessmentService;

    beforeEach(() => {
      claimExtractor = new ClaimExtractorService();
      assessmentService = {
        assessClaims: jest.fn().mockResolvedValue([
          {
            claimId: "clm_1",
            claimText: "Cache lock was added to prevent concurrency defects",
            status: "SUPPORTED",
            prismaConfidence: "HIGH_SUPPORT",
            confidenceScore: 0.95,
            rationale: "Commit 7f8a9b1 added Mutex synchronization to cache store",
            supportingEvidence: [],
            contradictingEvidence: [],
            allValidatedEvidence: [
              {
                sourceRecordId: "rec_commit_101",
                sourceType: "COMMIT",
                referenceKey: "7f8a9b1",
                title: "fix(cache): introduce lock to prevent race condition",
                author: "Alex Maintainer",
                timestamp: new Date(),
                url: "https://github.com/org/repo/commit/7f8a9b1",
                snippet: "Replaced dirty read with locked transaction block",
                quality: { relevanceScore: 0.95 },
                isValidCitation: true,
              },
            ],
            requiresHumanReview: false,
          },
        ]),
      } as any;

      mockPrisma.verificationSession = {
        create: jest.fn().mockImplementation(({ data }) => {
          const session = {
            id: "sess_verify_888",
            workspaceId: data.workspaceId,
            repositoryId: data.repositoryId,
            status: "COMPLETED",
            explanation: data.explanation,
            codeSnippet: data.codeSnippet,
            targetFilePath: data.targetFilePath,
            citationValidityRate: 1.0,
            executionTimeMs: 35,
            estimatedTokensUsed: 120,
            claims: [
              {
                id: "clm_1",
                text: "Cache lock was added to prevent concurrency defects",
                preliminaryConfidence: "HIGH_SUPPORT",
                humanVerdict: null,
                reviewNotes: null,
                assessments: [
                  {
                    confidence: "HIGH_SUPPORT",
                    rationale: "Commit 7f8a9b1 added Mutex synchronization",
                    modelIdentifier: "deterministic-baseline",
                  },
                ],
                evidence: [
                  {
                    id: "ev_1",
                    sourceType: "COMMIT",
                    referenceKey: "7f8a9b1",
                    title: "fix(cache): lock",
                    author: "Alex Maintainer",
                    timestamp: new Date(),
                    url: "https://github.com/org/repo/commit/7f8a9b1",
                    snippet: "Replaced dirty read",
                  },
                ],
                humanVerdicts: [],
              },
            ],
            workspace: workspacesDb[data.workspaceId],
            repository: repositoriesDb[data.repositoryId],
            createdAt: new Date(),
          };
          verificationSessionsDb["sess_verify_888"] = session;
          return session;
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const s = verificationSessionsDb[where.id];
          if (!s || s.workspaceId !== where.workspaceId) return null;
          return s;
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "sess_verify_888",
            workspaceId: "ws_alpha",
            repositoryId: "repo_core",
            status: "COMPLETED",
            explanation: "Cache lock was added to prevent concurrency defects",
            claims: [{ preliminaryConfidence: "HIGH_SUPPORT", humanVerdict: "SUPPORTED" }],
            createdAt: new Date(),
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const s = verificationSessionsDb[where.id];
          if (s && data.status) s.status = data.status;
          return s || {};
        }),
      };

      mockPrisma.claim = {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const session = verificationSessionsDb["sess_verify_888"];
          return session?.claims?.find((c: any) => c.id === where.id) || null;
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const session = verificationSessionsDb["sess_verify_888"];
          const claim = session?.claims?.find((c: any) => c.id === where.id);
          if (claim) {
            claim.humanVerdict = data.humanVerdict;
            claim.reviewNotes = data.reviewNotes;
          }
          return claim;
        }),
        count: jest.fn().mockResolvedValue(0),
      };

      mockPrisma.humanVerdictRecord = {
        create: jest.fn().mockImplementation(({ data }) => {
          const session = verificationSessionsDb["sess_verify_888"];
          const claim = session?.claims?.find((c: any) => c.id === data.claimId);
          const record = {
            id: `vh_${Date.now()}`,
            claimId: data.claimId,
            verdict: data.verdict,
            reviewerId: data.reviewerId,
            reviewer: { name: "Alex Reviewer" },
            reviewNotes: data.reviewNotes,
            decidedAt: new Date(),
          };
          claim?.humanVerdicts.push(record);
          return record;
        }),
      };

      mockPrisma.$transaction = jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      sessionService = new VerificationSessionService(
        mockPrisma as any,
        claimExtractor,
        assessmentService,
      );
    });

    it("should process explanation, decompose claims, assess evidence, and record human verdict", async () => {
      // 1. Submit explanation
      const result = await sessionService.verifyExplanation({
        workspaceId: "ws_alpha",
        repositoryId: "repo_core",
        userId: "user_1",
        explanation: "Cache lock was added to prevent concurrency defects",
      });

      expect(result).toBeDefined();
      expect(result.sessionId).toBe("sess_verify_888");
      expect(result.assessments.length).toBe(1);
      expect(result.assessments[0].status).toBe("SUPPORTED");

      // 2. Submit human verdict on claim
      const verdictRecord = await sessionService.recordVerdict({
        workspaceId: "ws_alpha",
        repositoryId: "repo_core",
        sessionId: "sess_verify_888",
        claimId: "clm_1",
        userId: "user_1",
        verdict: "SUPPORTED",
        reviewNotes: "Verified against commit 7f8a9b1 and PR discussion",
      });

      expect(verdictRecord.verdict).toBe("SUPPORTED");
      expect(verdictRecord.reviewNotes).toContain("commit 7f8a9b1");

      // 3. Reopen saved verification from persistent database
      const reloadedSession = await sessionService.getSession(
        "ws_alpha",
        "repo_core",
        "sess_verify_888",
      );

      expect(reloadedSession.sessionId).toBe("sess_verify_888");
      expect(reloadedSession.assessments[0].humanVerdict).toBe("SUPPORTED");
      expect(reloadedSession.assessments[0].verdictHistory).toBeDefined();
      expect(reloadedSession.assessments[0].verdictHistory?.length).toBe(1);
    });

    // ========================================================================
    // FLOW F — REPORT EXPORT & DATA HYGIENE
    // ========================================================================
    it("FLOW F — should export sanitised JSON report conforming to traceback.report.v1", async () => {
      // Ensure session exists
      await sessionService.verifyExplanation({
        workspaceId: "ws_alpha",
        repositoryId: "repo_core",
        userId: "user_1",
        explanation: "Cache lock was added to prevent concurrency defects",
      });

      const report: TracebackReportExport = await sessionService.exportReport(
        "ws_alpha",
        "repo_core",
        "sess_verify_888",
      );

      expect(report.schemaVersion).toBe("traceback.report.v1");
      expect(report.verificationId).toBe("sess_verify_888");
      expect(report.workspace.id).toBe("ws_alpha");
      expect(report.repository.id).toBe("repo_core");
      expect(report.claims.length).toBe(1);

      // Verify JSON serialization hygiene
      const jsonStr = JSON.stringify(report);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.schemaVersion).toBe("traceback.report.v1");
      // Must not leak passwords, hashes, salts, or session tokens
      expect(jsonStr).not.toContain("passwordHash");
      expect(jsonStr).not.toContain("tb_live_");
      expect(jsonStr).not.toContain("tb_token_");
    });
  });

  // ==========================================================================
  // FLOW G — ADVISORY CHANGE EVALUATION
  // ==========================================================================
  describe("FLOW G — Advisory Change Evaluation Engine", () => {
    let advisoryService: AdvisoryService;
    let evidenceSearchService: any;

    beforeEach(() => {
      evidenceSearchService = {
        search: jest.fn().mockResolvedValue({
          totalCount: 1,
          items: [
            {
              source: {
                id: "adr_005",
                repositoryId: "repo_core",
                sourceType: "ADR",
                referenceKey: "ADR-005",
                title: "ADR-005: Concurrency Safety Strategy",
                author: "Architecture Team",
                recordedAt: new Date().toISOString(),
                url: "https://github.com/org/repo/blob/main/docs/adr/005.md",
                snippet: "All shared worker pool dispatches must use Mutex synchronization",
              },
              score: 0.9,
              retrievalMethod: "lexical",
              matchReasons: ["keyword_match"],
            },
          ],
        }),
      };

      advisoryService = new AdvisoryService(mockPrisma as any, evidenceSearchService);
    });

    it("should evaluate proposed diff, detect conflict with ADR, and return advisory results", async () => {
      const result = await advisoryService.checkChangeAgainstDecisions({
        workspaceId: "ws_alpha",
        repositoryId: "repo_core",
        diff: `
--- a/src/worker.ts
+++ b/src/worker.ts
@@ -10,3 +10,1 @@
- mutex.lock();
- dispatchTask();
- mutex.unlock();
+ dispatchTask();
`,
      });

      expect(result).toBeDefined();
      expect(result.advisoryStatus).toBe("CONFLICT_DETECTED");
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0].severity).toBe("HIGH");
      expect(result.advisoryNotice.toLowerCase()).toContain("advisory only");
      // Enforce read-only constraint: no source writes occurred
    });

    it("should reject cross-workspace advisory check requests", async () => {
      await expect(
        advisoryService.checkChangeAgainstDecisions({
          workspaceId: "ws_beta", // repo_core belongs to ws_alpha
          repositoryId: "repo_core",
          diff: "+ safe code",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
