import { AuthService } from "./auth.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { EmailService } from "./email.service";
import {
  BadRequestException,
  ConflictException,
  HttpException,
  UnauthorizedException,
} from "@nestjs/common";

describe("AuthService (Authentication, Registration & Session Management)", () => {
  let authService: AuthService;
  let workspacesService: WorkspacesService;
  let emailService: EmailService;

  beforeEach(() => {
    workspacesService = new WorkspacesService();
    emailService = new EmailService();
    authService = new AuthService(workspacesService, undefined, emailService);
  });

  describe("Registration", () => {
    it("should successfully register a new user, hash password, and issue session token", async () => {
      const response = await authService.register({
        name: "Test Developer",
        email: "test.dev@company.com",
        password: "SecurePassword123!",
        passwordConfirmation: "SecurePassword123!",
      });

      expect(response).toBeDefined();
      expect(response.token).toMatch(/^tb_live_/);
      expect(response.user.email).toBe("test.dev@company.com");
      expect(response.user.name).toBe("Test Developer");
      expect(response.workspaces.length).toBeGreaterThan(0);

      // Verify user can now validate their session
      const validated = await authService.validateToken(response.token);
      expect(validated).toBeDefined();
      expect(validated?.email).toBe("test.dev@company.com");
    });

    it("should reject duplicate registration with identical email", async () => {
      await authService.register({
        name: "Unique User",
        email: "unique@company.com",
        password: "SecurePassword123!",
        passwordConfirmation: "SecurePassword123!",
      });

      await expect(
        authService.register({
          name: "Another User",
          email: "unique@company.com",
          password: "SecurePassword123!",
          passwordConfirmation: "SecurePassword123!",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should reject registration with passwords shorter than 8 characters", async () => {
      await expect(
        authService.register({
          name: "Short Pass",
          email: "short@company.com",
          password: "Pass1",
          passwordConfirmation: "Pass1",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject registration with passwords without numbers", async () => {
      await expect(
        authService.register({
          name: "No Number",
          email: "nonum@company.com",
          password: "PasswordOnly",
          passwordConfirmation: "PasswordOnly",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject registration when password confirmation does not match", async () => {
      await expect(
        authService.register({
          name: "Mismatch Pass",
          email: "mismatch@company.com",
          password: "SecurePassword123!",
          passwordConfirmation: "DifferentPassword456!",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("Login", () => {
    beforeEach(async () => {
      await authService.register({
        name: "Login User",
        email: "login.user@company.com",
        password: "ValidPassword123!",
        passwordConfirmation: "ValidPassword123!",
      });
    });

    it("should successfully log in with valid email and password", async () => {
      const response = await authService.login({
        email: "login.user@company.com",
        password: "ValidPassword123!",
      });

      expect(response).toBeDefined();
      expect(response.token).toMatch(/^tb_live_/);
      expect(response.user.email).toBe("login.user@company.com");
      expect(response.workspaces.length).toBeGreaterThan(0);
    });

    it("should reject login with wrong password", async () => {
      await expect(
        authService.login({
          email: "login.user@company.com",
          password: "WrongPassword999!",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should reject login with unknown email", async () => {
      await expect(
        authService.login({
          email: "unknown@company.com",
          password: "ValidPassword123!",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should forbid unauthenticated user impersonation via userId when not in test environment", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        await expect(
          authService.login({
            userId: "user_1",
          }),
        ).rejects.toThrow(UnauthorizedException);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it("should enforce brute-force rate limiting after 5 consecutive failed attempts", async () => {
      const testEmail = "brute.force@company.com";
      await authService.register({
        name: "Target User",
        email: testEmail,
        password: "TargetPassword123!",
        passwordConfirmation: "TargetPassword123!",
      });

      // 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await expect(
          authService.login({
            email: testEmail,
            password: "IncorrectPassword!",
          }),
        ).rejects.toThrow(UnauthorizedException);
      }

      // 6th attempt should be blocked by rate limiter with 429
      await expect(
        authService.login({
          email: testEmail,
          password: "TargetPassword123!",
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe("Session Management & Revocation", () => {
    it("should validate an issued active session token", async () => {
      const loginRes = await authService.register({
        name: "Active Session User",
        email: "active.session@company.com",
        password: "ValidPassword123!",
        passwordConfirmation: "ValidPassword123!",
      });

      const user = await authService.validateToken(loginRes.token);
      expect(user).toBeDefined();
      expect(user?.email).toBe("active.session@company.com");
    });

    it("should reject invalid or unknown tokens", async () => {
      expect(await authService.validateToken("invalid-token")).toBeNull();
      expect(await authService.validateToken("random-gibberish")).toBeNull();
      expect(await authService.validateToken("")).toBeNull();
    });

    it("should revoke an active session on logout", async () => {
      const loginRes = await authService.register({
        name: "Logout User",
        email: "logout.user@company.com",
        password: "ValidPassword123!",
        passwordConfirmation: "ValidPassword123!",
      });

      const beforeLogout = await authService.validateToken(loginRes.token);
      expect(beforeLogout).toBeDefined();

      const logoutRes = await authService.logout(loginRes.token);
      expect(logoutRes.success).toBe(true);

      const afterLogout = await authService.validateToken(loginRes.token);
      expect(afterLogout).toBeNull();
    });

    it("should return active session data including authorized workspaces", async () => {
      const session = await authService.getSession("user_1");
      expect(session.user.id).toBe("user_1");
      expect(session.activeWorkspaceId).toBe("ws_alpha");
      expect(session.workspaces.some((w) => w.id === "ws_alpha")).toBe(true);
    });

    it("should strictly reject sample-valid-token and mock token fallback when in production environment", async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "production";
        expect(
          await authService.validateToken("sample-valid-token"),
        ).toBeNull();
        expect(
          await authService.validateToken("tb_token_user_1_123456"),
        ).toBeNull();
        expect(
          await authService.validateToken("traceback_token_user_1"),
        ).toBeNull();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it("should reject mock user login fallback in production environment", async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "production";
        await expect(
          authService.login({
            email: "alex@company.com",
            password: "Password123!",
          }),
        ).rejects.toThrow(UnauthorizedException);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe("Password Recovery (Forgot Password & Reset Password)", () => {
    beforeEach(async () => {
      await authService.register({
        name: "Recovery User",
        email: "recovery.user@company.com",
        password: "OldPassword123!",
        passwordConfirmation: "OldPassword123!",
      });
    });

    it("should return identical generic message for both existing and non-existent accounts", async () => {
      const existingRes = await authService.forgotPassword({
        email: "recovery.user@company.com",
      });
      expect(existingRes.success).toBe(true);
      expect(existingRes.message).toBe(
        "If an account exists for that email, password-reset instructions will be sent.",
      );

      const nonExistentRes = await authService.forgotPassword({
        email: "ghost@nowhere.com",
      });
      expect(nonExistentRes.success).toBe(true);
      expect(nonExistentRes.message).toBe(
        "If an account exists for that email, password-reset instructions will be sent.",
      );
    });

    it("should rate limit password reset requests after 5 attempts", async () => {
      const testEmail = "ratelimit@example.com";
      for (let i = 0; i < 5; i++) {
        await authService.forgotPassword({ email: testEmail });
      }

      await expect(
        authService.forgotPassword({ email: testEmail }),
      ).rejects.toThrow(HttpException);
    });

    it("should successfully reset password with valid token and revoke previous sessions", async () => {
      // 1. Log in and get active session token
      const loginRes = await authService.login({
        email: "recovery.user@company.com",
        password: "OldPassword123!",
      });
      const activeSessionToken = loginRes.token;

      // Verify session is valid before reset
      const validatedBefore = await authService.validateToken(activeSessionToken);
      expect(validatedBefore).toBeDefined();

      // 2. Request forgot password
      await authService.forgotPassword({ email: "recovery.user@company.com" });
      const resetToken = emailService.getLatestResetTokenForTest("recovery.user@company.com");
      expect(resetToken).toBeDefined();

      // 3. Reset password using token
      const resetRes = await authService.resetPassword({
        token: resetToken!,
        newPassword: "BrandNewPassword456!",
        confirmPassword: "BrandNewPassword456!",
      });
      expect(resetRes.success).toBe(true);

      // 4. Verify previous active session has been revoked!
      const validatedAfter = await authService.validateToken(activeSessionToken);
      expect(validatedAfter).toBeNull();

      // 5. Verify old password fails and new password works
      await expect(
        authService.login({
          email: "recovery.user@company.com",
          password: "OldPassword123!",
        }),
      ).rejects.toThrow(UnauthorizedException);

      const newLoginRes = await authService.login({
        email: "recovery.user@company.com",
        password: "BrandNewPassword456!",
      });
      expect(newLoginRes).toBeDefined();
      expect(newLoginRes.user.email).toBe("recovery.user@company.com");
    });

    it("should reject password reset when token has already been used", async () => {
      await authService.forgotPassword({ email: "recovery.user@company.com" });
      const resetToken = emailService.getLatestResetTokenForTest("recovery.user@company.com");
      expect(resetToken).toBeDefined();

      // First reset succeeds
      await authService.resetPassword({
        token: resetToken!,
        newPassword: "FirstResetPass123!",
      });

      // Second attempt with same token must fail
      await expect(
        authService.resetPassword({
          token: resetToken!,
          newPassword: "SecondResetPass456!",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject password reset with invalid or nonexistent token", async () => {
      await expect(
        authService.resetPassword({
          token: "completely-bogus-token",
          newPassword: "NewValidPassword123!",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject password reset with weak password or mismatching confirmation", async () => {
      await authService.forgotPassword({ email: "recovery.user@company.com" });
      const resetToken = emailService.getLatestResetTokenForTest("recovery.user@company.com");

      // Password too short (<8)
      await expect(
        authService.resetPassword({
          token: resetToken!,
          newPassword: "Short1",
        }),
      ).rejects.toThrow(BadRequestException);

      // Password missing numbers
      await expect(
        authService.resetPassword({
          token: resetToken!,
          newPassword: "PasswordWithoutNumbers",
        }),
      ).rejects.toThrow(BadRequestException);

      // Mismatched confirmation
      await expect(
        authService.resetPassword({
          token: resetToken!,
          newPassword: "ValidPassword123!",
          confirmPassword: "MismatchPassword456!",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
