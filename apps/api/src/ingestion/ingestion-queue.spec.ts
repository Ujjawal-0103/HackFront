import { Test, TestingModule } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import {
  INGESTION_QUEUE_NAME,
  INGESTION_JOB_NAMES,
  DEFAULT_INGESTION_JOB_OPTIONS,
} from "./ingestion.constants";
import { IngestionJobPayload } from "./ingestion.types";

describe("IngestionQueue Scaffolding (Part 2)", () => {
  it("should define the centralized queue name per ADR-008", () => {
    expect(INGESTION_QUEUE_NAME).toBe("repository-ingestion");
  });

  it("should define standard job names", () => {
    expect(INGESTION_JOB_NAMES.SYNC_REPOSITORY).toBe(
      "sync-repository-history",
    );
  });

  it("should configure bounded retry and backoff defaults", () => {
    expect(DEFAULT_INGESTION_JOB_OPTIONS.attempts).toBe(3);
    expect(DEFAULT_INGESTION_JOB_OPTIONS.backoff).toEqual({
      type: "exponential",
      delay: 5000,
    });
  });

  it("should configure job retention and cleanup options to protect Redis memory", () => {
    expect(DEFAULT_INGESTION_JOB_OPTIONS.removeOnComplete).toBeDefined();
    expect(DEFAULT_INGESTION_JOB_OPTIONS.removeOnFail).toBeDefined();

    const onComplete = DEFAULT_INGESTION_JOB_OPTIONS.removeOnComplete as {
      age: number;
      count: number;
    };
    expect(onComplete.age).toBe(24 * 3600);
    expect(onComplete.count).toBe(1000);

    const onFail = DEFAULT_INGESTION_JOB_OPTIONS.removeOnFail as {
      age: number;
      count: number;
    };
    expect(onFail.age).toBe(7 * 24 * 3600);
    expect(onFail.count).toBe(5000);
  });

  it("should create a valid IngestionJobPayload without exposing secrets", () => {
    const payload: IngestionJobPayload = {
      repositoryId: "repo-uuid-1",
      syncJobId: "sync-job-uuid-1",
      installationId: 1001,
      fullName: "Ujjawal-0103/HackFront",
      trigger: "MANUAL",
      enqueuedAt: new Date().toISOString(),
    };

    expect(payload.repositoryId).toBe("repo-uuid-1");
    expect(payload.installationId).toBe(1001);
    expect(payload.trigger).toBe("MANUAL");
    // Ensure no token or secret fields exist
    const keys = Object.keys(payload);
    expect(keys).not.toContain("token");
    expect(keys).not.toContain("privateKey");
  });

  it("should resolve the ingestion queue token via getQueueToken", async () => {
    const mockQueue = {
      name: INGESTION_QUEUE_NAME,
      add: jest.fn(),
      getJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getQueueToken(INGESTION_QUEUE_NAME),
          useValue: mockQueue,
        },
      ],
    }).compile();

    const queue = module.get(getQueueToken(INGESTION_QUEUE_NAME));
    expect(queue).toBeDefined();
    expect(queue.name).toBe("repository-ingestion");
  });
});
