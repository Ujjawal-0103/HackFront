import { Test, TestingModule } from "@nestjs/testing";
import { Job } from "bullmq";
import { IngestionProcessor } from "./ingestion.processor";
import { IngestionOrchestratorService } from "./ingestion-orchestrator.service";
import { IngestionJobPayload } from "./ingestion.types";

describe("IngestionProcessor (Sprint 3 Part 5)", () => {
  let processor: IngestionProcessor;
  let mockOrchestrator: any;

  const validPayload: IngestionJobPayload = {
    repositoryId: "repo-uuid-111",
    syncJobId: "job-uuid-222",
    installationId: 123456,
    fullName: "Ujjawal-0103/HackFront",
    trigger: "MANUAL",
    enqueuedAt: "2026-10-10T00:00:00Z",
  };

  const mockJob = {
    id: "job-101",
    name: "sync-repository-history",
    data: validPayload,
    attemptsMade: 1,
    opts: { attempts: 3 },
  } as unknown as Job<IngestionJobPayload>;

  beforeEach(async () => {
    mockOrchestrator = {
      orchestrateSync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionProcessor,
        {
          provide: IngestionOrchestratorService,
          useValue: mockOrchestrator,
        },
      ],
    }).compile();

    processor = module.get<IngestionProcessor>(IngestionProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(processor).toBeDefined();
  });

  it("should process job and delegate to IngestionOrchestratorService", async () => {
    const expectedResult = {
      status: "COMPLETED" as const,
      commitsCount: 10,
      pullRequestsCount: 4,
      issuesCount: 2,
    };
    mockOrchestrator.orchestrateSync.mockResolvedValue(expectedResult);

    const result = await processor.process(mockJob);

    expect(mockOrchestrator.orchestrateSync).toHaveBeenCalledTimes(1);
    expect(mockOrchestrator.orchestrateSync).toHaveBeenCalledWith(
      validPayload,
      mockJob,
    );
    expect(result).toEqual(expectedResult);
  });

  it("should propagate errors thrown by the orchestrator", async () => {
    mockOrchestrator.orchestrateSync.mockRejectedValue(
      new Error("Database transaction lock timeout"),
    );

    await expect(processor.process(mockJob)).rejects.toThrow(
      "Database transaction lock timeout",
    );
  });
});
