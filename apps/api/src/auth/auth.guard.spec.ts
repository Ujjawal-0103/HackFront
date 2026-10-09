import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";

describe("AuthGuard (Identity Boundary)", () => {
  let guard: AuthGuard;

  beforeEach(() => {
    guard = new AuthGuard();
  });

  it("should accept valid Bearer token and attach authenticated user context", () => {
    const mockRequest: any = {
      headers: {
        authorization: "Bearer sample-valid-token",
      },
    };
    const mockContext = {
      switchToHttp: () => ({ getRequest: () => mockRequest }),
    } as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(true);
    expect(mockRequest.user).toBeDefined();
    expect(mockRequest.user.id).toBe("usr_verified_123");
  });

  it("should accept dev user header in development mode", () => {
    const mockRequest: any = {
      headers: {
        "x-user-id": "dev_user_456",
      },
    };
    const mockContext = {
      switchToHttp: () => ({ getRequest: () => mockRequest }),
    } as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(true);
    expect(mockRequest.user.id).toBe("dev_user_456");
  });

  it("should reject dev user header when in production mode", () => {
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

      expect(() => guard.canActivate(mockContext)).toThrow(
        UnauthorizedException,
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("should throw UnauthorizedException when no credentials are provided", () => {
    const mockRequest: any = {
      headers: {},
    };
    const mockContext = {
      switchToHttp: () => ({ getRequest: () => mockRequest }),
    } as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });

  it("should throw UnauthorizedException on invalid token", () => {
    const mockRequest: any = {
      headers: {
        authorization: "Bearer invalid-token",
      },
    };
    const mockContext = {
      switchToHttp: () => ({ getRequest: () => mockRequest }),
    } as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });
});
