import { Test, TestingModule } from "@nestjs/testing";
import { RepositoriesController } from "./repositories.controller";
import { RepositoriesService } from "./repositories.service";
import { WorkspacesService } from "../workspaces/workspaces.service";

describe("RepositoriesController", () => {
  let controller: RepositoriesController;
  let mockService: any;
  let mockWorkspacesService: any;

  beforeEach(async () => {
    mockService = {
      listRepositories: jest.fn().mockResolvedValue([]),
      createRepository: jest.fn().mockResolvedValue({ id: "repo_1" }),
      getRepository: jest.fn().mockResolvedValue({ id: "repo_1" }),
      getRepositoryActivity: jest.fn().mockResolvedValue({ commits: [] }),
      importRepositoryByUrl: jest.fn().mockResolvedValue({
        repository: { id: "repo_1", fullName: "owner/repo" },
        isAlreadyConnected: false,
        message: "Repository connected",
      }),
      deleteRepository: jest
        .fn()
        .mockResolvedValue({ success: true, id: "repo_1" }),
    };

    mockWorkspacesService = {
      getMembership: jest.fn().mockResolvedValue({ role: "OWNER" }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        { provide: RepositoriesService, useValue: mockService },
        { provide: WorkspacesService, useValue: mockWorkspacesService },
      ],
    }).compile();

    controller = module.get<RepositoriesController>(RepositoriesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should list repositories for a workspace", async () => {
    const result = await controller.listRepositories("ws_alpha");
    expect(result).toEqual([]);
    expect(mockService.listRepositories).toHaveBeenCalledWith("ws_alpha");
  });

  it("should create a repository in a workspace", async () => {
    const dto = { fullName: "Ujjawal-0103/HackFront" };
    const result = await controller.createRepository("ws_alpha", dto);
    expect(result).toEqual({ id: "repo_1" });
    expect(mockService.createRepository).toHaveBeenCalledWith("ws_alpha", dto);
  });

  it("should import a repository by URL in a workspace", async () => {
    const dto = { url: "https://github.com/owner/repo" };
    const result = await controller.importRepositoryByUrl("ws_alpha", dto);
    expect(result).toEqual({
      repository: { id: "repo_1", fullName: "owner/repo" },
      isAlreadyConnected: false,
      message: "Repository connected",
    });
    expect(mockService.importRepositoryByUrl).toHaveBeenCalledWith(
      "ws_alpha",
      dto.url,
    );
  });

  it("should get repository details", async () => {
    const result = await controller.getRepository("ws_alpha", "repo_1");
    expect(result).toEqual({ id: "repo_1" });
    expect(mockService.getRepository).toHaveBeenCalledWith(
      "ws_alpha",
      "repo_1",
    );
  });

  it("should get repository activity", async () => {
    const result = await controller.getRepositoryActivity("ws_alpha", "repo_1");
    expect(result).toEqual({ commits: [] });
    expect(mockService.getRepositoryActivity).toHaveBeenCalledWith(
      "ws_alpha",
      "repo_1",
    );
  });
});
