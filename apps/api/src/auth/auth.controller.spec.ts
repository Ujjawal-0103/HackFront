import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { EmailService } from "./email.service";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: AuthService;
  let emailService: EmailService;

  beforeEach(async () => {
    emailService = new EmailService();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        WorkspacesService,
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it("should handle registration request", async () => {
    const response = await controller.register({
      name: "Alice Engineer",
      email: "alice@company.com",
      password: "StrongPassword123!",
      passwordConfirmation: "StrongPassword123!",
    });
    expect(response.token).toBeDefined();
    expect(response.user.email).toBe("alice@company.com");
    expect(response.workspaces.length).toBeGreaterThan(0);
  });

  it("should handle login request with valid credentials", async () => {
    await controller.register({
      name: "Bob Lead",
      email: "bob@company.com",
      password: "StrongPassword123!",
      passwordConfirmation: "StrongPassword123!",
    });

    const response = await controller.login({
      email: "bob@company.com",
      password: "StrongPassword123!",
    });
    expect(response.token).toBeDefined();
    expect(response.user.email).toBe("bob@company.com");
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
    const registerRes = await controller.register({
      name: "Charlie QA",
      email: "charlie@company.com",
      password: "StrongPassword123!",
      passwordConfirmation: "StrongPassword123!",
    });
    const logoutRes = await controller.logout(`Bearer ${registerRes.token}`);
    expect(logoutRes.success).toBe(true);
  });

  it("should handle forgot-password and reset-password endpoints", async () => {
    await controller.register({
      name: "Daisy Dev",
      email: "daisy@company.com",
      password: "InitialPassword123!",
      passwordConfirmation: "InitialPassword123!",
    });

    const forgotRes = await controller.forgotPassword({
      email: "daisy@company.com",
    });
    expect(forgotRes.success).toBe(true);
    expect(forgotRes.message).toBe(
      "If an account exists for that email, password-reset instructions will be sent.",
    );

    const token = emailService.getLatestResetTokenForTest("daisy@company.com");
    expect(token).toBeDefined();

    const resetRes = await controller.resetPassword({
      token: token!,
      newPassword: "UpdatedPassword456!",
      confirmPassword: "UpdatedPassword456!",
    });
    expect(resetRes.success).toBe(true);

    // Should be able to log in with new password
    const loginRes = await controller.login({
      email: "daisy@company.com",
      password: "UpdatedPassword456!",
    });
    expect(loginRes.token).toBeDefined();
  });
});
