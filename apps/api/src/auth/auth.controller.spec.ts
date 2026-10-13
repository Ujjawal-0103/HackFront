import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { WorkspacesService } from "../workspaces/workspaces.service";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [AuthService, WorkspacesService],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it("should handle login request", async () => {
    const response = await controller.login({ userId: "user_1" });
    expect(response.token).toBeDefined();
    expect(response.user.id).toBe("user_1");
  });

  it("should handle session retrieval", async () => {
    const session = await controller.getSession({
      id: "user_1",
      email: "alex@company.com",
      name: "Alex Maintainer",
    });
    expect(session.user.id).toBe("user_1");
    expect(session.activeWorkspaceId).toBe("ws_alpha");
  });

  it("should handle logout request", async () => {
    const loginRes = await authService.login({ userId: "user_1" });
    const logoutRes = await controller.logout(`Bearer ${loginRes.token}`);
    expect(logoutRes.success).toBe(true);
  });
});
