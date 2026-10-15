import { Test, TestingModule } from "@nestjs/testing";
import { VerificationHistoryController } from "./verification-history.controller";
import { VerificationSessionService } from "./verification-session.service";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { AuthService } from "../auth/auth.service";
import { NotFoundException } from "@nestjs/common";

describe("VerificationHistoryController & JSON Export (Sprint 6)", () => {
  let controller: VerificationHistoryController;
  let sessionService: jest.Mocked<Partial<VerificationSessionService>>;
  let prismaService: jest.Mocked<Partial<PrismaService>>;

  const mockExportReport = {
    schemaVersion: "traceback.report.v1" as const,
    exportedAt: new Date().toISOString(),
    verificationId: "sess-123",
    workspace: { id: "ws_alpha", name: "Alpha Corp" },
    repository: { id: "repo-456", fullName: "org/repo" },
    explanation: "Fix cache concurrency bug",
    status: "COMPLETED",
    createdAt: new Date().toISOString(),
    claims: [
      {
        id: "claim-1",
        text: "Atomic locks were added in commit 7f8a9b",
        preliminaryConfidence: "HIGH_SUPPORT" as const,
        structuredStatus: "SUPPORTED" as const,
        humanVerdict: "SUPPORTED" as const,
        reviewNotes: "Confirmed against PR #42",
        assessment: {
          confidence: "HIGH_SUPPORT" as const,
          rationale: "Evidence directly confirms atomic lock implementation",
          modelIdentifier: "traceback-sprint-5-assessor",
        },
        evidence: [
          {
            id: "ev-1",
            sourceType: "COMMIT" as const,
            referenceKey: "7f8a9b",
            title: "fix: use mutex lock for cache operations",
            author: "dev@company.com",
            timestamp: new Date().toISOString(),
            url: "https://github.com/org/repo/commit/7f8a9b",
          },
        ],
        verdictHistory: [
          {
            id: "vh-1",
            claimId: "claim-1",
            verdict: "SUPPORTED" as const,
            reviewerId: "user_1",
            reviewerName: "Alex Maintainer",
            reviewNotes: "Confirmed against PR #42",
            decidedAt: new Date().toISOString(),
          },
        ],
      },
    ],
    summary: {
      totalClaims: 1,
      supportedClaims: 1,
      contradictedClaims: 0,
      insufficientClaims: 0,
      mixedClaims: 0,
      humanReviewedClaims: 1,
    },
  };

  beforeEach(async () => {
    sessionService = {
      getWorkspaceHistory: jest.fn().mockResolvedValue({
        items: [
          {
            id: "sess-123",
            workspaceId: "ws_alpha",
            repositoryId: "repo-456",
            repositoryFullName: "org/repo",
            explanation: "Fix cache concurrency bug",
            status: "COMPLETED",
            claimsCount: 1,
            assessedCount: 1,
            humanReviewedCount: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      }),
      getSession: jest.fn().mockResolvedValue({
        sessionId: "sess-123",
        workspaceId: "ws_alpha",
        repositoryId: "repo-456",
        status: "COMPLETED" as any,
        explanation: "Fix cache concurrency bug",
        claimsCount: 1,
        assessments: [],
        citationValidityRate: 1.0,
        executionTimeMs: 120,
        estimatedTokensUsed: 50,
      }),
      exportReport: jest.fn().mockResolvedValue(mockExportReport),
    };

    prismaService = {
      verificationSession: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.id === "sess-123" && where.workspaceId === "ws_alpha") {
            return Promise.resolve({ repositoryId: "repo-456" });
          }
          return Promise.resolve(null);
        }),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VerificationHistoryController],
      providers: [
        { provide: VerificationSessionService, useValue: sessionService },
        { provide: PrismaService, useValue: prismaService },
        { provide: WorkspacesService, useValue: new WorkspacesService() },
        {
          provide: AuthService,
          useValue: { validateToken: jest.fn().mockResolvedValue({ id: "user_1" }) },
        },
      ],
    }).compile();

    controller = module.get<VerificationHistoryController>(
      VerificationHistoryController,
    );
  });

  it("should return paginated workspace verification history", async () => {
    const result = await controller.getWorkspaceHistory("ws_alpha", "1", "20");
    expect(result.items.length).toBe(1);
    expect(result.items[0].id).toBe("sess-123");
    expect(result.items[0].repositoryFullName).toBe("org/repo");
    expect(sessionService.getWorkspaceHistory).toHaveBeenCalledWith("ws_alpha", {
      page: 1,
      limit: 20,
      repositoryId: undefined,
    });
  });

  it("should fetch session details for a session in the workspace", async () => {
    const result = await controller.getSessionDetails("ws_alpha", "sess-123");
    expect(result.sessionId).toBe("sess-123");
    expect(sessionService.getSession).toHaveBeenCalledWith(
      "ws_alpha",
      "repo-456",
      "sess-123",
    );
  });

  it("should throw NotFoundException if session does not exist in workspace", async () => {
    await expect(
      controller.getSessionDetails("ws_alpha", "non-existent-sess"),
    ).rejects.toThrow(NotFoundException);
  });

  it("should export structured JSON report conforming to traceback.report.v1 schema", async () => {
    const report = await controller.exportReport("ws_alpha", "sess-123");
    expect(report.schemaVersion).toBe("traceback.report.v1");
    expect(report.verificationId).toBe("sess-123");
    expect(report.claims.length).toBe(1);
    expect(report.claims[0].humanVerdict).toBe("SUPPORTED");
    expect(report.claims[0].verdictHistory.length).toBe(1);
    expect(report.summary.totalClaims).toBe(1);
    expect(report.summary.humanReviewedClaims).toBe(1);
  });
});
