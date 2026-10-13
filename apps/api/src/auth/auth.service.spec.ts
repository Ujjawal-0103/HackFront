import { AuthService } from "./auth.service";
import { WorkspacesService } from "../workspaces/workspaces.service";

describe("AuthService (Session & Identity Management)", () => {
  let authService: AuthService;
  let workspacesService: WorkspacesService;

  beforeEach(() => {
    workspacesService = new WorkspacesService();
    authService = new AuthService(workspacesService);
  });

  it("should successfully log in a user and return a secure token and workspaces", async () => {
    const response = await authService.login({ userId: "user_1" });

    expect(response).toBeDefined();
    expect(response.token).toMatch(/^tb_token_user_1_[a-f0-9]{32}$/);
    expect(response.user.id).toBe("user_1");
    expect(response.user.email).toBe("alex@company.com");
    expect(response.workspaces.length).toBeGreaterThan(0);
    expect(response.workspaces[0].id).toBe("ws_alpha");
  });

  it("should validate an issued active token", async () => {
    const loginRes = await authService.login({ userId: "user_1" });
    const user = await authService.validateToken(loginRes.token);

    expect(user).toBeDefined();
    expect(user?.id).toBe("user_1");
  });

  it("should reject an invalid or unknown token", async () => {
    const user = await authService.validateToken("invalid-token");
    expect(user).toBeNull();

    const randomUser = await authService.validateToken("random-gibberish");
    expect(randomUser).toBeNull();
  });

  it("should revoke an active session on logout", async () => {
    const loginRes = await authService.login({ userId: "user_1" });
    const beforeLogout = await authService.validateToken(loginRes.token);
    expect(beforeLogout).toBeDefined();

    const logoutRes = await authService.logout(loginRes.token);
    expect(logoutRes.success).toBe(true);
  });

  it("should return active session data including authorized workspaces", async () => {
    const session = await authService.getSession("user_1");

    expect(session.user.id).toBe("user_1");
    expect(session.activeWorkspaceId).toBe("ws_alpha");
    expect(session.workspaces.some((w) => w.id === "ws_alpha")).toBe(true);
  });
});
