import { Test, TestingModule } from "@nestjs/testing";
import { DelayedError, Job } from "bullmq";
import { IngestionProcessor } from "./ingestion.processor";
import { IngestionOrchestratorService } from "./ingestion-orchestrator.service";
import { IngestionJobPayload } from "./ingestion.types";
import {
  GitHubRateLimitError,
  GitHubTransientError,
} from "../github/github.errors";
import {
  MIN_RATE_LIMIT_DELAY_MS,
  MAX_RATE_LIMIT_DELAY_MS,
  DEFAULT_RATE_LIMIT_FALLBACK_DELAY_MS,
} from "./ingestion.constants";

describe("IngestionProcessor (Sprint 3 Part 4 - Rate Limit Rescheduling)", () => {
  let processor: IngestionProcessor;
  let mockOrchestrator: any;
  let mockJob: any;

  const validPayload: IngestionJobPayload = {
    repositoryId: "repo-uuid-111",
    syncJobId: "job-uuid-222",
    installationId: 123456,
    fullName: "Ujjawal-0103/HackFront",
    trigger: "MANUAL",
    enqueuedAt: "2026-10-10T00:00:00Z",
  };

  beforeEach(async () => {
    mockOrchestrator = {
      orchestrateSync: jest.fn(),
    };

    mockJob = {
      id: "job-101",
      name: "sync-repository-history",
      data: validPayload,
      attemptsMade: 1,
      opts: { attempts: 3 },
      moveToDelayed: jest.fn().mockResolvedValue(undefined),
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
    expect(mockJob.moveToDelayed).not.toHaveBeenCalled();
  });

  describe("Rate-Limit Rescheduling (Requirement 1, 2, 3, 4, 5)", () => {
    it("should reschedule the existing job until resetAt and throw DelayedError", async () => {
      const futureReset = new Date(Date.now() + 180_000); // 3 minutes in future
      const rateLimitError = new GitHubRateLimitError(
        "API rate limit exceeded",
        {
          limit: 5000,
          remaining: 0,
          resetAt: futureReset,
        },
      );
      mockOrchestrator.orchestrateSync.mockRejectedValue(rateLimitError);

      await expect(
        processor.process(mockJob, "worker-token-123"),
      ).rejects.toThrow(DelayedError);

      expect(mockJob.moveToDelayed).toHaveBeenCalledTimes(1);
      expect(mockJob.moveToDelayed).toHaveBeenCalledWith(
        futureReset.getTime(),
        "worker-token-123",
      );
      // Confirms existing job payload is preserved and attemptsMade is not consumed
      expect(mockJob.attemptsMade).toBe(1);
    });

    it("should preserve existing job and not enqueue duplicate jobs", async () => {
      const resetTime = new Date(Date.now() + 60_000);
      const rateLimitError = new GitHubRateLimitError("Rate limited", {
        resetAt: resetTime,
      });
      mockOrchestrator.orchestrateSync.mockRejectedValue(rateLimitError);

      await expect(processor.process(mockJob)).rejects.toThrow(DelayedError);

      // Verify moveToDelayed called on the existing job object
      expect(mockJob.moveToDelayed).toHaveBeenCalledTimes(1);
      expect(mockJob.data).toEqual(validPayload);
      expect(mockJob.id).toBe("job-101");
    });

    it("should use job.token or default token '0' when token argument is omitted", async () => {
      mockJob.token = "internal-job-token-456";
      const resetTime = new Date(Date.now() + 60_000);
      const rateLimitError = new GitHubRateLimitError("Rate limited", {
        resetAt: resetTime,
      });
      mockOrchestrator.orchestrateSync.mockRejectedValue(rateLimitError);

      await expect(processor.process(mockJob)).rejects.toThrow(DelayedError);

      expect(mockJob.moveToDelayed).toHaveBeenCalledWith(
        resetTime.getTime(),
        "internal-job-token-456",
      );
    });

    it("should safely handle missing resetAt using default fallback delay", async () => {
      const before = Date.now();
      const rateLimitError = new GitHubRateLimitError(
        "Rate limited with no metadata",
        {},
      );
      mockOrchestrator.orchestrateSync.mockRejectedValue(rateLimitError);

      await expect(processor.process(mockJob)).rejects.toThrow(DelayedError);

      expect(mockJob.moveToDelayed).toHaveBeenCalledTimes(1);
      const scheduledTimestamp = mockJob.moveToDelayed.mock.calls[0][0];
      const expectedTimestamp = before + DEFAULT_RATE_LIMIT_FALLBACK_DELAY_MS;
      expect(scheduledTimestamp).toBeGreaterThanOrEqual(
        expectedTimestamp - 100,
      );
      expect(scheduledTimestamp).toBeLessThanOrEqual(expectedTimestamp + 1000);
    });

    it("should safely handle retryAfterSeconds when resetAt is absent", async () => {
      const before = Date.now();
      const rateLimitError = new GitHubRateLimitError("Secondary rate limit", {
        retryAfterSeconds: 45,
      });
      mockOrchestrator.orchestrateSync.mockRejectedValue(rateLimitError);

      await expect(processor.process(mockJob)).rejects.toThrow(DelayedError);

      expect(mockJob.moveToDelayed).toHaveBeenCalledTimes(1);
      const scheduledTimestamp = mockJob.moveToDelayed.mock.calls[0][0];
      const expectedTimestamp = before + 45_000;
      expect(scheduledTimestamp).toBeGreaterThanOrEqual(
        expectedTimestamp - 100,
      );
      expect(scheduledTimestamp).toBeLessThanOrEqual(expectedTimestamp + 1000);
    });

    it("should clamp past reset timestamps to minimum 5s delay to avoid tight retry loop", async () => {
      const before = Date.now();
      const pastReset = new Date(before - 10_000); // 10s in the past
      const rateLimitError = new GitHubRateLimitError("Past rate limit reset", {
        resetAt: pastReset,
      });
      mockOrchestrator.orchestrateSync.mockRejectedValue(rateLimitError);

      await expect(processor.process(mockJob)).rejects.toThrow(DelayedError);

      expect(mockJob.moveToDelayed).toHaveBeenCalledTimes(1);
      const scheduledTimestamp = mockJob.moveToDelayed.mock.calls[0][0];
      const minExpected = before + MIN_RATE_LIMIT_DELAY_MS;
      expect(scheduledTimestamp).toBeGreaterThanOrEqual(minExpected - 50);
      expect(scheduledTimestamp).toBeLessThanOrEqual(minExpected + 1000);
    });

    it("should clamp excessive reset timestamps to maximum 1 hour delay to avoid indefinite stalling", async () => {
      const before = Date.now();
      const farFutureReset = new Date(before + 86_400_000); // 24 hours into the future
      const rateLimitError = new GitHubRateLimitError(
        "Excessive rate limit reset",
        {
          resetAt: farFutureReset,
        },
      );
      mockOrchestrator.orchestrateSync.mockRejectedValue(rateLimitError);

      await expect(processor.process(mockJob)).rejects.toThrow(DelayedError);

      expect(mockJob.moveToDelayed).toHaveBeenCalledTimes(1);
      const scheduledTimestamp = mockJob.moveToDelayed.mock.calls[0][0];
      const maxExpected = before + MAX_RATE_LIMIT_DELAY_MS;
      expect(scheduledTimestamp).toBeGreaterThanOrEqual(maxExpected - 50);
      expect(scheduledTimestamp).toBeLessThanOrEqual(maxExpected + 1000);
    });

    it("should gracefully rethrow error if moveToDelayed is not available on job", async () => {
      delete mockJob.moveToDelayed;
      const rateLimitError = new GitHubRateLimitError("Rate limit hit", {
        resetAt: new Date(Date.now() + 60_000),
      });
      mockOrchestrator.orchestrateSync.mockRejectedValue(rateLimitError);

      await expect(processor.process(mockJob)).rejects.toThrow(rateLimitError);
    });
  });

  describe("Non-Rate-Limit Error Propagation (Preserves existing retry behavior)", () => {
    it("should propagate transient 5xx errors directly without moveToDelayed for BullMQ exponential backoff", async () => {
      const transientError = new GitHubTransientError("Gateway timeout", 504);
      mockOrchestrator.orchestrateSync.mockRejectedValue(transientError);

      await expect(processor.process(mockJob)).rejects.toThrow(transientError);
      expect(mockJob.moveToDelayed).not.toHaveBeenCalled();
    });

    it("should propagate generic errors directly without calling moveToDelayed", async () => {
      const genericError = new Error("Database transaction lock timeout");
      mockOrchestrator.orchestrateSync.mockRejectedValue(genericError);

      await expect(processor.process(mockJob)).rejects.toThrow(
        "Database transaction lock timeout",
      );
      expect(mockJob.moveToDelayed).not.toHaveBeenCalled();
    });
  });
});
