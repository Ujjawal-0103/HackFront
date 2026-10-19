import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";

describe("AuthGuard (Identity Boundary)", () => {
  let guard: AuthGuard;

  beforeEach(() => {
    guard = new AuthGuard();
  });

  it("should accept valid Bearer token and attach authenticated user context", async () => {
    const mockRequest: any = {
      headers: {
        authorization: "Bearer sample-valid-token",
      },
    };
    const mockContext = {
      switchToHttp: () => ({ getRequest: () => mockRequest }),
    } as ExecutionContext;

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
    expect(mockRequest.user).toBeDefined();
    expect(mockRequest.user.id).toBe("usr_verified_123");
  });

  it("should accept dev user header in development mode", async () => {
    const mockRequest: any = {
      headers: {
        "x-user-id": "dev_user_456",
      },
    };
    const mockContext = {
      switchToHttp: () => ({ getRequest: () => mockRequest }),
    } as ExecutionContext;

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
    expect(mockRequest.user.id).toBe("dev_user_456");
  });

  it("should reject dev user header when in production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const mockRequest: any = {
        headers: {
          "x-user-id": "dev_user_456",
        },
      };
      const mockContext = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
      } as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("should throw UnauthorizedException when no credentials are provided", async () => {
    const mockRequest: any = {
      headers: {},
    };
    const mockContext = {
      switchToHttp: () => ({ getRequest: () => mockRequest }),
    } as ExecutionContext;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should throw UnauthorizedException on invalid token", async () => {
    const mockRequest: any = {
      headers: {
        authorization: "Bearer invalid-token",
      },
    };
    const mockContext = {
      switchToHttp: () => ({ getRequest: () => mockRequest }),
    } as ExecutionContext;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should reject token in production when authService is not injected", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const mockRequest: any = {
        headers: {
          authorization: "Bearer tb_token_user_123_test",
        },
      };
      const mockContext = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
      } as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("should validate token with injected authService in production", async () => {
    const mockAuthService: any = {
      validateToken: jest.fn().mockResolvedValue({
        id: "usr_prod_777",
        email: "prod@company.com",
        name: "Prod User",
      }),
    };
    const injectedGuard = new AuthGuard(mockAuthService);

    const mockRequest: any = {
      headers: {
        authorization: "Bearer valid-prod-token",
      },
    };
    const mockContext = {
      switchToHttp: () => ({ getRequest: () => mockRequest }),
    } as ExecutionContext;

    const result = await injectedGuard.canActivate(mockContext);
    expect(result).toBe(true);
    expect(mockRequest.user.id).toBe("usr_prod_777");
    expect(mockAuthService.validateToken).toHaveBeenCalledWith(
      "valid-prod-token",
    );
  });

  it("should reject arbitrary unknown token without authService rather than substituting mock user", async () => {
    const unprovidedGuard = new AuthGuard();
    const mockRequest: any = {
      headers: {
        authorization: "Bearer tb_live_unknown_user_token_12345",
      },
    };
    const mockContext = {
      switchToHttp: () => ({ getRequest: () => mockRequest }),
    } as ExecutionContext;

    await expect(unprovidedGuard.canActivate(mockContext)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should reject revoked or expired token when authService returns null", async () => {
    const mockAuthService: any = {
      validateToken: jest.fn().mockResolvedValue(null),
    };
    const injectedGuard = new AuthGuard(mockAuthService);

    const mockRequest: any = {
      headers: {
        authorization: "Bearer tb_live_revoked_token_67890",
      },
    };
    const mockContext = {
      switchToHttp: () => ({ getRequest: () => mockRequest }),
    } as ExecutionContext;

    await expect(injectedGuard.canActivate(mockContext)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockAuthService.validateToken).toHaveBeenCalledWith(
      "tb_live_revoked_token_67890",
    );
  });
});
