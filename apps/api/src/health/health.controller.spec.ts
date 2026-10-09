import { Test, TestingModule } from "@nestjs/testing";
import { HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { ReadinessService } from "./readiness.service";

describe("HealthController", () => {
  let controller: HealthController;
  let readinessService: ReadinessService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: ReadinessService,
          useValue: {
            checkReadiness: jest.fn().mockResolvedValue({
              statusCode: HttpStatus.OK,
              response: {
                status: "ready",
                service: "@traceback/api",
                timestamp: new Date().toISOString(),
                checks: {
                  config: { ready: true },
                  database: { ready: true },
                },
              },
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    readinessService = module.get<ReadinessService>(ReadinessService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("GET /api/health", () => {
    it("should return health status ok with valid metadata", () => {
      const response = controller.getHealth();
      expect(response).toBeDefined();
      expect(response.status).toBe("ok");
      expect(response.service).toBe("@traceback/api");
      expect(response.version).toBe("0.1.0");
      expect(typeof response.uptimeSeconds).toBe("number");
      expect(Date.parse(response.timestamp)).not.toBeNaN();
    });
  });

  describe("GET /api/ready", () => {
    it("should invoke readiness service and set appropriate HTTP status code", async () => {
      const mockStatus = jest.fn();
      const mockRes = { status: mockStatus } as unknown as Response;

      const result = await controller.getReadiness(mockRes);

      expect(readinessService.checkReadiness).toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.OK);
      expect(result.status).toBe("ready");
    });
  });
});
