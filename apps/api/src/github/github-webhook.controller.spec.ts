import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { GitHubWebhookController } from "./github-webhook.controller";
import { GitHubWebhookService } from "./github-webhook.service";

describe("GitHubWebhookController (Sprint 3 Part 7)", () => {
  let controller: GitHubWebhookController;
  let mockWebhookService: any;

  beforeEach(async () => {
    mockWebhookService = {
      handleWebhookDelivery: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GitHubWebhookController],
      providers: [
        {
          provide: GitHubWebhookService,
          useValue: mockWebhookService,
        },
      ],
    }).compile();

    controller = module.get<GitHubWebhookController>(GitHubWebhookController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should pass headers, rawBody, and payload to webhookService and return result", async () => {
    const rawBuffer = Buffer.from(
      JSON.stringify({ ref: "refs/heads/main" }),
      "utf8",
    );
    const mockRequest = {
      rawBody: rawBuffer,
    } as any;

    const mockResponse = {
      status: "enqueued" as const,
      jobId: "job-101",
      repositoryId: "repo-1",
      deliveryId: "deliv-101",
    };
    mockWebhookService.handleWebhookDelivery.mockResolvedValue(mockResponse);

    const result = await controller.handleWebhook(
      mockRequest,
      "sha256=abcdef123456",
      "push",
      "deliv-101",
      { ref: "refs/heads/main" },
    );

    expect(mockWebhookService.handleWebhookDelivery).toHaveBeenCalledWith(
      {
        event: "push",
        deliveryId: "deliv-101",
        signature: "sha256=abcdef123456",
      },
      rawBuffer,
      { ref: "refs/heads/main" },
    );
    expect(result).toEqual(mockResponse);
  });

  it("should propagate UnauthorizedException on invalid signature", async () => {
    mockWebhookService.handleWebhookDelivery.mockRejectedValue(
      new UnauthorizedException("Invalid signature"),
    );

    const mockRequest = { rawBody: Buffer.from("{}") } as any;

    await expect(
      controller.handleWebhook(
        mockRequest,
        "sha256=invalid",
        "push",
        "deliv-1",
        {},
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
