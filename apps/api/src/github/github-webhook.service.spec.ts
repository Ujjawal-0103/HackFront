import { Test, TestingModule } from "@nestjs/testing";
import {
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getQueueToken } from "@nestjs/bullmq";
import * as crypto from "crypto";
import {
  GitHubWebhookService,
  verifyGitHubWebhookSignature,
} from "./github-webhook.service";
import { PrismaService } from "../prisma/prisma.service";
import { INGESTION_QUEUE_NAME } from "../ingestion/ingestion.constants";

describe("GitHubWebhookService (Sprint 3 Part 7)", () => {
  let service: GitHubWebhookService;
  let mockPrisma: any;
  let mockQueue: any;
  let mockConfigService: any;

  const testSecret = "test-webhook-secret-987654";

  function createSignature(
    payload: string | Buffer,
    secret = testSecret,
  ): string {
    const buf = Buffer.isBuffer(payload)
      ? payload
      : Buffer.from(payload, "utf8");
    const hmac = crypto.createHmac("sha256", secret).update(buf).digest("hex");
    return `sha256=${hmac}`;
  }

  const mockRepoRecord = {
    id: "repo-uuid-111",
    workspaceId: "ws-uuid-1",
    githubRepoId: 1234567,
    fullName: "Ujjawal-0103/HackFront",
  };

  const samplePushPayload = {
    ref: "refs/heads/main",
    repository: {
      id: 1234567,
      full_name: "Ujjawal-0103/HackFront",
    },
    installation: {
      id: 998877,
    },
  };

  beforeEach(async () => {
    mockPrisma = {
      repository: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      repositorySyncJob: {
        create: jest.fn(),
        update: jest.fn(),
      },
      gitHubInstallation: {
        findUnique: jest.fn().mockResolvedValue({
          id: "inst-1",
          installationId: 998877,
          workspaceId: "ws-uuid-1",
        }),
        delete: jest.fn(),
      },
    };

    mockQueue = {
      add: jest.fn(),
      getJob: jest.fn().mockResolvedValue(null),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === "app.nodeEnv") {
          return "test";
        }
        if (
          key === "app.githubWebhookSecret" ||
          key === "GITHUB_WEBHOOK_SECRET"
        ) {
          return testSecret;
        }
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitHubWebhookService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken(INGESTION_QUEUE_NAME), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<GitHubWebhookService>(GitHubWebhookService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("HMAC-SHA256 Signature Verification", () => {
    it("should verify valid signature with constant-time comparison", () => {
      const rawBody = Buffer.from(JSON.stringify(samplePushPayload), "utf8");
      const signature = createSignature(rawBody, testSecret);

      expect(verifyGitHubWebhookSignature(rawBody, signature, testSecret)).toBe(
        true,
      );
    });

    it("should reject tampered or invalid signature", () => {
      const rawBody = Buffer.from(JSON.stringify(samplePushPayload), "utf8");
      const validSig = createSignature(rawBody, testSecret);
      const invalidSig = `sha256=${"0".repeat(64)}`;

      expect(
        verifyGitHubWebhookSignature(rawBody, invalidSig, testSecret),
      ).toBe(false);
      expect(
        verifyGitHubWebhookSignature(rawBody, "invalid-format", testSecret),
      ).toBe(false);
      expect(verifyGitHubWebhookSignature(rawBody, undefined, testSecret)).toBe(
        false,
      );
      expect(
        verifyGitHubWebhookSignature(rawBody, validSig, "wrong-secret"),
      ).toBe(false);
    });

    it("should throw UnauthorizedException when signature header is missing or invalid", () => {
      const rawBody = Buffer.from("{}", "utf8");

      expect(() => service.verifySignature(rawBody, undefined)).toThrow(
        UnauthorizedException,
      );

      expect(() => service.verifySignature(rawBody, "sha256=wrong")).toThrow(
        UnauthorizedException,
      );
    });

    it("should fail closed in production when GITHUB_WEBHOOK_SECRET is missing or empty", () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "app.nodeEnv") return "production";
        return undefined;
      });
      delete process.env.GITHUB_WEBHOOK_SECRET;

      expect(() =>
        service.verifySignature(Buffer.from("{}"), "sha256=123"),
      ).toThrow("GitHub webhook secret is unconfigured in production");
    });

    it("should fail closed in production when secret is set to the predictable development fallback", () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "app.nodeEnv") return "production";
        if (key === "app.githubWebhookSecret")
          return "development-webhook-secret";
        return undefined;
      });

      expect(() =>
        service.verifySignature(Buffer.from("{}"), "sha256=123"),
      ).toThrow("GitHub webhook secret is unconfigured in production");
    });

    it("should verify successfully in production with a valid configured secret", () => {
      const prodSecret = "prod-super-secret-key-123456789";
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "app.nodeEnv") return "production";
        if (key === "app.githubWebhookSecret") return prodSecret;
        return undefined;
      });

      const rawBody = Buffer.from("{}", "utf8");
      const signature = createSignature(rawBody, prodSecret);

      expect(() => service.verifySignature(rawBody, signature)).not.toThrow();
    });

    it("should preserve local development usability with development secret fallback", () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "app.nodeEnv") return "development";
        if (key === "app.githubWebhookSecret")
          return "development-webhook-secret";
        return undefined;
      });

      const rawBody = Buffer.from("{}", "utf8");
      const signature = createSignature(rawBody, "development-webhook-secret");

      expect(() => service.verifySignature(rawBody, signature)).not.toThrow();
    });
  });

  describe("Header Validation", () => {
    it("should throw BadRequestException on missing X-GitHub-Event header", async () => {
      const rawBody = Buffer.from(JSON.stringify(samplePushPayload), "utf8");
      const signature = createSignature(rawBody);

      await expect(
        service.handleWebhookDelivery(
          { event: "", deliveryId: "deliv-1", signature },
          rawBody,
          samplePushPayload,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException on missing X-GitHub-Delivery header", async () => {
      const rawBody = Buffer.from(JSON.stringify(samplePushPayload), "utf8");
      const signature = createSignature(rawBody);

      await expect(
        service.handleWebhookDelivery(
          { event: "push", deliveryId: "", signature },
          rawBody,
          samplePushPayload,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("Ping & Unsupported Events", () => {
    it("should return pong for ping event without database queries or queueing", async () => {
      const rawBody = Buffer.from(JSON.stringify({ hook_id: 12345 }), "utf8");
      const signature = createSignature(rawBody);

      const result = await service.handleWebhookDelivery(
        { event: "ping", deliveryId: "deliv-ping", signature },
        rawBody,
        { hook_id: 12345 },
      );

      expect(result).toEqual({ status: "ok", message: "pong" });
      expect(mockPrisma.repositorySyncJob.create).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("should safely ignore unsupported events (e.g. star, fork)", async () => {
      const rawBody = Buffer.from(
        JSON.stringify({ action: "created" }),
        "utf8",
      );
      const signature = createSignature(rawBody);

      const result = await service.handleWebhookDelivery(
        { event: "star", deliveryId: "deliv-star", signature },
        rawBody,
        { action: "created" },
      );

      expect(result).toEqual({
        status: "ignored",
        message: 'Event "star" is not handled for ingestion',
      });
      expect(mockPrisma.repositorySyncJob.create).not.toHaveBeenCalled();
    });
  });

  describe("Repository Resolution & Ingestion Enqueue", () => {
    it("should resolve repository by githubRepoId, create sync job, and enqueue", async () => {
      const rawBody = Buffer.from(JSON.stringify(samplePushPayload), "utf8");
      const signature = createSignature(rawBody);
      const deliveryId = "deliv-push-101";

      mockPrisma.repository.findUnique.mockResolvedValue(mockRepoRecord);
      mockPrisma.repositorySyncJob.create.mockResolvedValue({
        id: "job-sync-uuid-1",
        repositoryId: mockRepoRecord.id,
        status: "PENDING",
        trigger: "WEBHOOK",
      });
      mockQueue.add.mockResolvedValue({ id: "bullmq-1" });

      const result = await service.handleWebhookDelivery(
        { event: "push", deliveryId, signature },
        rawBody,
        samplePushPayload,
      );

      expect(result).toEqual({
        status: "enqueued",
        jobId: "job-sync-uuid-1",
        repositoryId: mockRepoRecord.id,
        deliveryId,
      });

      // Verification: created job with WEBHOOK trigger
      expect(mockPrisma.repositorySyncJob.create).toHaveBeenCalledWith({
        data: {
          repositoryId: mockRepoRecord.id,
          status: "PENDING",
          trigger: "WEBHOOK",
          commitsCount: 0,
          pullRequestsCount: 0,
          issuesCount: 0,
        },
      });

      // Verification: enqueued payload has NO credentials
      expect(mockQueue.add).toHaveBeenCalledWith(
        "sync-repository-history",
        expect.objectContaining({
          repositoryId: mockRepoRecord.id,
          syncJobId: "job-sync-uuid-1",
          installationId: 998877,
          fullName: "Ujjawal-0103/HackFront",
          trigger: "WEBHOOK",
        }),
        expect.objectContaining({
          jobId: `delivery_${deliveryId}`,
        }),
      );
    });

    it("should safely ignore webhook when repository is not registered in database", async () => {
      const rawBody = Buffer.from(JSON.stringify(samplePushPayload), "utf8");
      const signature = createSignature(rawBody);

      mockPrisma.repository.findUnique.mockResolvedValue(null);
      mockPrisma.repository.findFirst.mockResolvedValue(null);

      const result = await service.handleWebhookDelivery(
        { event: "push", deliveryId: "deliv-push-unknown", signature },
        rawBody,
        samplePushPayload,
      );

      expect(result).toEqual({
        status: "ignored",
        message:
          'Repository "Ujjawal-0103/HackFront" is not registered in Traceback',
      });
      expect(mockPrisma.repositorySyncJob.create).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("should mark job as FAILED and throw ServiceUnavailableException if queue fails", async () => {
      const rawBody = Buffer.from(JSON.stringify(samplePushPayload), "utf8");
      const signature = createSignature(rawBody);

      mockPrisma.repository.findUnique.mockResolvedValue(mockRepoRecord);
      mockPrisma.repositorySyncJob.create.mockResolvedValue({
        id: "job-sync-failed-1",
        repositoryId: mockRepoRecord.id,
      });
      mockQueue.add.mockRejectedValue(new Error("Redis queue down"));

      await expect(
        service.handleWebhookDelivery(
          { event: "push", deliveryId: "deliv-queue-err", signature },
          rawBody,
          samplePushPayload,
        ),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(mockPrisma.repositorySyncJob.update).toHaveBeenCalledWith({
        where: { id: "job-sync-failed-1" },
        data: {
          status: "FAILED",
          errorMessage: expect.stringContaining("Redis queue down"),
          completedAt: expect.any(Date),
        },
      });
    });

    it("should safely ignore webhook when installation ID is missing from payload", async () => {
      const payloadWithoutInst = {
        ...samplePushPayload,
        installation: undefined,
      };
      const rawBody = Buffer.from(JSON.stringify(payloadWithoutInst), "utf8");
      const signature = createSignature(rawBody);

      mockPrisma.repository.findUnique.mockResolvedValue(mockRepoRecord);

      const result = await service.handleWebhookDelivery(
        { event: "push", deliveryId: "deliv-push-no-inst", signature },
        rawBody,
        payloadWithoutInst,
      );

      expect(result).toEqual({
        status: "ignored",
        message: "Webhook payload missing valid installation identification",
      });
      expect(mockPrisma.repositorySyncJob.create).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("should safely ignore webhook when installation does not exist in database", async () => {
      const rawBody = Buffer.from(JSON.stringify(samplePushPayload), "utf8");
      const signature = createSignature(rawBody);

      mockPrisma.repository.findUnique.mockResolvedValue(mockRepoRecord);
      mockPrisma.gitHubInstallation.findUnique.mockResolvedValue(null);

      const result = await service.handleWebhookDelivery(
        { event: "push", deliveryId: "deliv-push-unknown-inst", signature },
        rawBody,
        samplePushPayload,
      );

      expect(result).toEqual({
        status: "ignored",
        message: "Installation 998877 is not registered in Traceback",
      });
      expect(mockPrisma.repositorySyncJob.create).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("should safely ignore webhook when installation belongs to a different workspace", async () => {
      const rawBody = Buffer.from(JSON.stringify(samplePushPayload), "utf8");
      const signature = createSignature(rawBody);

      mockPrisma.repository.findUnique.mockResolvedValue(mockRepoRecord);
      mockPrisma.gitHubInstallation.findUnique.mockResolvedValue({
        id: "inst-other",
        installationId: 998877,
        workspaceId: "other-workspace-uuid",
      });

      const result = await service.handleWebhookDelivery(
        { event: "push", deliveryId: "deliv-push-wrong-ws", signature },
        rawBody,
        samplePushPayload,
      );

      expect(result).toEqual({
        status: "ignored",
        message:
          "Installation 998877 does not belong to repository's workspace",
      });
      expect(mockPrisma.repositorySyncJob.create).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe("Delivery Deduplication", () => {
    it("should detect duplicate delivery ID and ignore duplicate enqueue", async () => {
      const rawBody = Buffer.from(JSON.stringify(samplePushPayload), "utf8");
      const signature = createSignature(rawBody);
      const deliveryId = "deliv-duplicate-test";

      mockPrisma.repository.findUnique.mockResolvedValue(mockRepoRecord);
      mockPrisma.repositorySyncJob.create.mockResolvedValue({
        id: "job-1",
        repositoryId: mockRepoRecord.id,
      });

      // First delivery: enqueued
      const res1 = await service.handleWebhookDelivery(
        { event: "push", deliveryId, signature },
        rawBody,
        samplePushPayload,
      );
      expect(res1.status).toBe("enqueued");

      // Duplicate delivery with same delivery ID: skipped
      const res2 = await service.handleWebhookDelivery(
        { event: "push", deliveryId, signature },
        rawBody,
        samplePushPayload,
      );
      expect(res2).toEqual({
        status: "duplicate",
        message: `Delivery ${deliveryId} already processed`,
        deliveryId,
      });

      // Queue was called only once
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
    });

    it("should detect duplicate delivery ID from BullMQ queue state across API restarts", async () => {
      const rawBody = Buffer.from(JSON.stringify(samplePushPayload), "utf8");
      const signature = createSignature(rawBody);
      const deliveryId = "deliv-queue-dedup-restart";

      // BullMQ already has this job retained in Redis
      mockQueue.getJob.mockResolvedValue({ id: `delivery_${deliveryId}` });

      const result = await service.handleWebhookDelivery(
        { event: "push", deliveryId, signature },
        rawBody,
        samplePushPayload,
      );

      expect(result).toEqual({
        status: "duplicate",
        message: `Delivery ${deliveryId} already enqueued or processed in queue`,
        deliveryId,
      });

      // No database sync job created or re-added to queue
      expect(mockPrisma.repositorySyncJob.create).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe("Installation Revocation", () => {
    it("should handle installation.deleted by removing GitHubInstallation from database", async () => {
      const payload = {
        action: "deleted",
        installation: { id: 778899 },
      };
      const rawBody = Buffer.from(JSON.stringify(payload), "utf8");
      const signature = createSignature(rawBody);

      mockPrisma.gitHubInstallation.findUnique.mockResolvedValue({
        id: "inst-1",
        installationId: 778899,
      });
      mockPrisma.gitHubInstallation.delete.mockResolvedValue({});

      const result = await service.handleWebhookDelivery(
        { event: "installation", deliveryId: "deliv-inst-del", signature },
        rawBody,
        payload,
      );

      expect(result).toEqual({
        status: "revoked",
        action: "deleted",
        installationId: 778899,
        message: "Installation 778899 removed from persisted state",
      });
      expect(mockPrisma.gitHubInstallation.delete).toHaveBeenCalledWith({
        where: { installationId: 778899 },
      });
    });

    it("should handle installation.suspend by reporting schema gap without claiming revocation persisted", async () => {
      const payload = {
        action: "suspend",
        installation: { id: 778899 },
      };
      const rawBody = Buffer.from(JSON.stringify(payload), "utf8");
      const signature = createSignature(rawBody);

      const result = await service.handleWebhookDelivery(
        { event: "installation", deliveryId: "deliv-inst-suspend", signature },
        rawBody,
        payload,
      );

      expect(result).toEqual({
        status: "unsupported_revocation_state",
        action: "suspend",
        installationId: 778899,
        message:
          "Installation suspension cannot be explicitly persisted without schema status field",
      });
      // Does not delete or invent fields
      expect(mockPrisma.gitHubInstallation.delete).not.toHaveBeenCalled();
    });
  });
});
