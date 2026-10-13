import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { EvidenceController } from "./evidence.controller";
import { GraphRetrieverService } from "./graph-retriever.service";
import { EvidenceSearchService } from "./evidence-search.service";
import { EvidenceProjectionService } from "./evidence-projection.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { EvidenceSourceType } from "@prisma/client";

describe("EvidenceController", () => {
  let controller: EvidenceController;
  let retriever: any;
  let searchService: any;
  let projectionService: any;

  beforeEach(async () => {
    retriever = {
      retrieve: jest.fn().mockResolvedValue({
        query: "socket",
        totalCount: 1,
        items: [],
        graphAvailable: true,
        executionTimeMs: 15,
      }),
    };

    searchService = {
      getSourceRecordById: jest.fn().mockImplementation((ws, repo, id) => {
        if (id === "valid-id") {
          return Promise.resolve({
            id: "valid-id",
            repositoryId: repo,
            sourceType: EvidenceSourceType.COMMIT,
            externalId: "sha-1",
            referenceKey: "sha-1",
            title: "Commit 1",
            author: "Alice",
            url: "https://github.com",
            recordedAt: new Date().toISOString(),
          });
        }
        return Promise.resolve(null);
      }),
    };

    projectionService = {
      projectAll: jest.fn().mockResolvedValue({
        repositoryId: "repo-1",
        commitsProjected: 5,
        pullRequestsProjected: 2,
        issuesProjected: 1,
        documentationProjected: 0,
        totalSourceRecords: 8,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvidenceController],
      providers: [
        { provide: GraphRetrieverService, useValue: retriever },
        { provide: EvidenceSearchService, useValue: searchService },
        { provide: EvidenceProjectionService, useValue: projectionService },
        {
          provide: WorkspacesService,
          useValue: {
            getMembership: jest.fn().mockResolvedValue({ role: "ADMIN" }),
          },
        },
      ],
    }).compile();

    controller = module.get<EvidenceController>(EvidenceController);
  });

  it("should forward search requests to GraphRetrieverService", async () => {
    const result = await controller.search("ws-1", "repo-1", {
      query: "socket reconnection",
      limit: 10,
      includeGraph: true,
    });

    expect(result.query).toBe("socket");
    expect(retriever.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        repositoryId: "repo-1",
        query: "socket reconnection",
      }),
    );
  });

  it("should trigger projection via EvidenceProjectionService", async () => {
    const summary = await controller.project("ws-1", "repo-1");
    expect(summary.totalSourceRecords).toBe(8);
    expect(projectionService.projectAll).toHaveBeenCalledWith("repo-1");
  });

  it("should retrieve a single SourceRecord by ID", async () => {
    const record = await controller.getSourceRecord(
      "ws-1",
      "repo-1",
      "valid-id",
    );
    expect(record.id).toBe("valid-id");
  });

  it("should throw NotFoundException if SourceRecord does not exist", async () => {
    await expect(
      controller.getSourceRecord("ws-1", "repo-1", "invalid-id"),
    ).rejects.toThrow(NotFoundException);
  });
});
