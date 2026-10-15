import { Test } from "@nestjs/testing";
import { PrismaService } from "./prisma.service";

describe("PrismaService Live Database & Health Integration", () => {
  let prismaService: PrismaService;

  beforeAll(async () => {
    prismaService = new PrismaService();
    await prismaService.onModuleInit();
  });

  afterAll(async () => {
    await prismaService.onModuleDestroy();
  });

  it("should connect to the live PostgreSQL instance and report healthy", async () => {
    const health = await prismaService.isHealthy();
    expect(health.healthy).toBe(true);
    expect(health.message).toContain("PostgreSQL database responsive");
  });

  it("should execute a read query against the migrated schema safely", async () => {
    const workspaces = await prismaService.workspace.findMany();
    expect(Array.isArray(workspaces)).toBe(true);
  });

  it("should never expose connection strings, passwords, or secrets in health checks", async () => {
    const health = await prismaService.isHealthy();
    expect(JSON.stringify(health)).not.toContain("password");
    expect(JSON.stringify(health)).not.toContain("postgrespassword");
    expect(JSON.stringify(health)).not.toContain("5434");
    expect(JSON.stringify(health)).not.toContain("postgresql://");
  });

  it("should gracefully handle and report failure when a query fails without crashing", async () => {
    const brokenPrisma = new PrismaService({
      datasources: {
        db: {
          url: "postgresql://postgres:wrongpassword@127.0.0.1:5434/nonexistent?connect_timeout=2",
        },
      },
    });

    const brokenHealth = await brokenPrisma.isHealthy();
    expect(brokenHealth.healthy).toBe(false);
    expect(brokenHealth.message).toBeDefined();
    await brokenPrisma.onModuleDestroy();
  });

  it("should be resolvable within a NestJS testing module without constructor injection error", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    const service = moduleRef.get(PrismaService);
    expect(service).toBeDefined();
    expect(typeof service.$connect).toBe("function");
    await service.$disconnect();
  });
});
