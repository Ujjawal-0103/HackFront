import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { Neo4jService } from "./neo4j.service";

describe("Neo4jService", () => {
  let service: Neo4jService;

  describe("Offline / Unconfigured Mode", () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          Neo4jService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      service = module.get<Neo4jService>(Neo4jService);
      await service.onModuleInit();
    });

    afterEach(async () => {
      await service.onModuleDestroy();
    });

    it("should report isAvailable() as false when unconfigured", () => {
      expect(service.isAvailable()).toBe(false);
    });

    it("should report isHealthy() as false with clear message", async () => {
      const health = await service.isHealthy();
      expect(health.healthy).toBe(false);
      expect(health.message).toContain("Neo4j graph driver is not connected");
    });

    it("should throw descriptive error when attempting to run queries while offline", async () => {
      await expect(service.runQuery("RETURN 1")).rejects.toThrow(
        "Neo4j driver is not available",
      );
    });
  });

  describe("Simulated Error on Connection", () => {
    it("should handle unreachable URI gracefully without crashing process", async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          Neo4jService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockImplementation((key) => {
                if (key === "app.neo4jUri") return "bolt://127.0.0.1:9999";
                if (key === "app.neo4jUsername") return "neo4j";
                if (key === "app.neo4jPassword") return "password";
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      const errorService = module.get<Neo4jService>(Neo4jService);
      await errorService.onModuleInit();

      expect(errorService.isAvailable()).toBe(false);
      const health = await errorService.isHealthy();
      expect(health.healthy).toBe(false);
      await errorService.onModuleDestroy();
    });
  });
});
