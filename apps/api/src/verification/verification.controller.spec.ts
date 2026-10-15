import { Test, TestingModule } from "@nestjs/testing";
import { VerificationController } from "./verification.controller";
import { VerificationSessionService } from "./verification-session.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { AuthService } from "../auth/auth.service";

describe("VerificationController (Sprint 5 & Sprint 6 Workflows)", () => {
  let controller: VerificationController;
  let sessionService: jest.Mocked<Partial<VerificationSessionService>>;

  const mockSessionResult = {
    sessionId: "sess-abc",
    workspaceId: "ws_alpha",
    repositoryId: "repo-123",
    status: "REVIEWING" as any,
    explanation: "Bug fix explanation",
    claimsCount: 1,
    assessments: [
      {
        claimId: "claim-1",
        claimText: "Atomic lock was implemented",
        status: "SUPPORTED" as any,
        prismaConfidence: "HIGH_SUPPORT" as any,
        confidenceScore: 0.9,
        rationale: "Validated against commit SHA",
        supportingEvidence: [],
        contradictingEvidence: [],
        allValidatedEvidence: [],
        requiresHumanReview: false,
        humanVerdict: null,
      },
    ],
    citationValidityRate: 1.0,
    executionTimeMs: 150,
    estimatedTokensUsed: 60,
  };

  beforeEach(async () => {
    sessionService = {
      verifyExplanation: jest.fn().mockResolvedValue(mockSessionResult),
      getSession: jest.fn().mockResolvedValue(mockSessionResult),
      listSessions: jest.fn().mockResolvedValue([mockSessionResult]),
      recordVerdict: jest.fn().mockResolvedValue({
        id: "vh-record-1",
        claimId: "claim-1",
        verdict: "SUPPORTED",
        reviewNotes: "Looks accurate based on PR",
        reviewerId: "user_1",
        decidedAt: new Date().toISOString(),
      }),
      getClaimVerdictHistory: jest.fn().mockResolvedValue([
        {
          id: "vh-record-1",
          claimId: "claim-1",
          verdict: "SUPPORTED",
          reviewerId: "user_1",
          reviewerName: "Alex Maintainer",
          reviewNotes: "Looks accurate based on PR",
          decidedAt: new Date().toISOString(),
        },
      ]),
      updateClaimText: jest.fn().mockResolvedValue({
        id: "claim-1",
        text: "Updated claim text",
      }),
      exportReport: jest.fn().mockResolvedValue({
        schemaVersion: "traceback.report.v1",
        exportedAt: new Date().toISOString(),
        verificationId: "sess-abc",
        workspace: { id: "ws_alpha", name: "Alpha Corp" },
        repository: { id: "repo-123", fullName: "org/repo" },
        explanation: "Bug fix explanation",
        status: "REVIEWING",
        createdAt: new Date().toISOString(),
        claims: [],
        summary: {
          totalClaims: 1,
          supportedClaims: 1,
          contradictedClaims: 0,
          insufficientClaims: 0,
          mixedClaims: 0,
          humanReviewedClaims: 0,
        },
      } as any),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VerificationController],
      providers: [
        { provide: VerificationSessionService, useValue: sessionService },
        { provide: WorkspacesService, useValue: new WorkspacesService() },
        {
          provide: AuthService,
          useValue: {
            validateToken: jest.fn().mockResolvedValue({ id: "user_1" }),
          },
        },
      ],
    }).compile();

    controller = module.get<VerificationController>(VerificationController);
  });

  it("should process and verify explanation submission", async () => {
    const res = await controller.verifyExplanation(
      "ws_alpha",
      "repo-123",
      { explanation: "Bug fix explanation" },
      { id: "user_1", email: "alex@company.com", name: "Alex Maintainer" },
    );

    expect(res.sessionId).toBe("sess-abc");
    expect(sessionService.verifyExplanation).toHaveBeenCalledWith({
      workspaceId: "ws_alpha",
      repositoryId: "repo-123",
      userId: "user_1",
      explanation: "Bug fix explanation",
      codeSnippet: undefined,
      targetFilePath: undefined,
      targetSymbol: undefined,
      maxClaims: undefined,
    });
  });

  it("should record a persistent human verdict on a claim", async () => {
    const res = await controller.recordVerdict(
      "ws_alpha",
      "repo-123",
      "sess-abc",
      "claim-1",
      { verdict: "SUPPORTED", reviewNotes: "Looks accurate based on PR" },
      { id: "user_1", email: "alex@company.com", name: "Alex Maintainer" },
    );

    expect(res.verdict).toBe("SUPPORTED");
    expect(sessionService.recordVerdict).toHaveBeenCalledWith({
      workspaceId: "ws_alpha",
      repositoryId: "repo-123",
      sessionId: "sess-abc",
      claimId: "claim-1",
      userId: "user_1",
      verdict: "SUPPORTED",
      reviewNotes: "Looks accurate based on PR",
    });
  });

  it("should retrieve verdict revision history for a claim", async () => {
    const history = await controller.getVerdictHistory(
      "ws_alpha",
      "repo-123",
      "sess-abc",
      "claim-1",
    );

    expect(history.length).toBe(1);
    expect(history[0].reviewerName).toBe("Alex Maintainer");
  });

  it("should update claim text", async () => {
    const updated = await controller.updateClaim(
      "ws_alpha",
      "repo-123",
      "sess-abc",
      "claim-1",
      { text: "Updated claim text" },
    );

    expect(updated.text).toBe("Updated claim text");
  });

  it("should export report from repository scope", async () => {
    const report = await controller.exportReport(
      "ws_alpha",
      "repo-123",
      "sess-abc",
    );

    expect(report.schemaVersion).toBe("traceback.report.v1");
    expect(report.verificationId).toBe("sess-abc");
  });
});
