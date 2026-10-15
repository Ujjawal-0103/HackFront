import { Test, TestingModule } from "@nestjs/testing";
import { AdvisoryController } from "./advisory.controller";
import { AdvisoryService } from "./advisory.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { AuthService } from "../auth/auth.service";

describe("AdvisoryController (Sprint 7 REST API)", () => {
  let controller: AdvisoryController;
  let advisoryService: jest.Mocked<any>;

  beforeEach(async () => {
    advisoryService = {
      checkChangeAgainstDecisions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdvisoryController],
      providers: [
        { provide: AdvisoryService, useValue: advisoryService },
        { provide: WorkspacesService, useValue: new WorkspacesService() },
        {
          provide: AuthService,
          useValue: {
            validateToken: jest.fn().mockResolvedValue({ id: "user_1" }),
          },
        },
      ],
    }).compile();

    controller = module.get<AdvisoryController>(AdvisoryController);
  });

  it("should forward advisory check request with workspace and repository parameters", async () => {
    const mockResponse = {
      advisoryStatus: "NO_CONFLICT_DETECTED",
      summary: "Clean check",
      conflicts: [],
      advisoryNotice: "Advisory only",
      limitations: [],
      inspectedSourcesCount: 5,
      evaluatedAt: new Date().toISOString(),
      repositoryId: "repo_1",
    };

    advisoryService.checkChangeAgainstDecisions.mockResolvedValue(mockResponse);

    const result = await controller.checkChange(
      "ws_alpha",
      "repo_1",
      {
        diff: "diff --git a/file.ts b/file.ts\n+const x = 1;",
      },
    );

    expect(result).toBe(mockResponse);
    expect(advisoryService.checkChangeAgainstDecisions).toHaveBeenCalledWith({
      workspaceId: "ws_alpha",
      repositoryId: "repo_1",
      diff: "diff --git a/file.ts b/file.ts\n+const x = 1;",
    });
  });
});
