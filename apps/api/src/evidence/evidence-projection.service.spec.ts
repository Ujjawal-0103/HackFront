import { Test, TestingModule } from "@nestjs/testing";
import { EvidenceProjectionService } from "./evidence-projection.service";
import { PrismaService } from "../prisma/prisma.service";
import { EvidenceSourceType } from "@prisma/client";

describe("EvidenceProjectionService", () => {
  let service: EvidenceProjectionService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      gitCommit: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "commit-1",
            repositoryId: "repo-1",
            sha: "a1b2c3d4e5f67890123456789012345678901234",
            message:
              "feat: add user authentication via JWT\n\nDetailed rationale here.",
            authorName: "Alice",
            authorEmail: "alice@example.com",
            committedAt: new Date("2026-01-01T00:00:00Z"),
            url: "https://github.com/org/repo/commit/a1b2c3d",
            diffs: [
              {
                id: "diff-1",
                filePath: "src/auth/jwt.strategy.ts",
                status: "added",
                additions: 45,
                deletions: 0,
                diffHunk: "@@ -0,0 +1,45 @@\n+export class JwtStrategy {}",
              },
            ],
          },
        ]),
      },
      pullRequest: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "pr-1",
            repositoryId: "repo-1",
            number: 101,
            title: "Support JWT Auth Tokens",
            body: "Resolves #50 by adding token validation.",
            author: "Bob",
            state: "closed",
            isMerged: true,
            mergedAt: new Date("2026-01-02T00:00:00Z"),
            url: "https://github.com/org/repo/pull/101",
            comments: [
              {
                id: "c-1",
                author: "Alice",
                body: "Looks good to me!",
                createdAt: new Date("2026-01-01T12:00:00Z"),
              },
            ],
          },
        ]),
      },
      issue: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "issue-1",
            repositoryId: "repo-1",
            number: 50,
            title: "JWT Authentication Feature Request",
            body: "Need to secure API endpoints with JWT.",
            author: "Charlie",
            state: "closed",
            closedAt: new Date("2026-01-02T01:00:00Z"),
            url: "https://github.com/org/repo/issues/50",
            comments: [],
          },
        ]),
      },
      sourceRecord: {
        upsert: jest.fn().mockResolvedValue({ id: "src-record-1" }),
        count: jest.fn().mockResolvedValue(3),
      },
      repository: {
        findUnique: jest.fn().mockResolvedValue({
          id: "repo-1",
          fullName: "org/repo",
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceProjectionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EvidenceProjectionService>(EvidenceProjectionService);
  });

  it("should project GitCommits and diffs idempotently into SourceRecords", async () => {
    const count = await service.projectCommits("repo-1");
    expect(count).toBe(1);
    expect(prisma.sourceRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          repositoryId_sourceType_externalId: {
            repositoryId: "repo-1",
            sourceType: EvidenceSourceType.COMMIT,
            externalId: "a1b2c3d4e5f67890123456789012345678901234",
          },
        },
        create: expect.objectContaining({
          referenceKey: "a1b2c3d",
          title: "feat: add user authentication via JWT",
          author: "Alice",
          filePath: "src/auth/jwt.strategy.ts",
        }),
      }),
    );
  });

  it("should project PullRequests and comments into SourceRecords", async () => {
    const count = await service.projectPullRequests("repo-1");
    expect(count).toBe(1);
    expect(prisma.sourceRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          repositoryId_sourceType_externalId: {
            repositoryId: "repo-1",
            sourceType: EvidenceSourceType.PULL_REQUEST,
            externalId: "101",
          },
        },
        create: expect.objectContaining({
          referenceKey: "#101",
          title: "Support JWT Auth Tokens",
          author: "Bob",
        }),
      }),
    );
  });

  it("should project Issues into SourceRecords", async () => {
    const count = await service.projectIssues("repo-1");
    expect(count).toBe(1);
    expect(prisma.sourceRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          repositoryId_sourceType_externalId: {
            repositoryId: "repo-1",
            sourceType: EvidenceSourceType.ISSUE,
            externalId: "50",
          },
        },
        create: expect.objectContaining({
          referenceKey: "#50",
          title: "JWT Authentication Feature Request",
          author: "Charlie",
        }),
      }),
    );
  });

  it("should project documentation and ADRs into SourceRecords", async () => {
    const count = await service.projectDocumentation("repo-1", [
      {
        referenceKey: "ADR-001",
        title: "ADR-001: Token Architecture",
        content: "We use standard RS256 JWT signatures.",
        filePath: "docs/ADR-001.md",
        isAdr: true,
      },
    ]);

    expect(count).toBe(1);
    expect(prisma.sourceRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceType: EvidenceSourceType.ADR,
          referenceKey: "ADR-001",
          title: "ADR-001: Token Architecture",
          filePath: "docs/ADR-001.md",
        }),
      }),
    );
  });

  it("should run projectAll and return aggregated counts", async () => {
    const summary = await service.projectAll("repo-1");
    expect(summary.repositoryId).toBe("repo-1");
    expect(summary.commitsProjected).toBe(1);
    expect(summary.pullRequestsProjected).toBe(1);
    expect(summary.issuesProjected).toBe(1);
    expect(summary.totalSourceRecords).toBe(3);
  });
});
