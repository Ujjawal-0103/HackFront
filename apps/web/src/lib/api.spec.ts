import { api, ApiError, setApiAuthToken, setApiActiveWorkspaceId } from "./api";

describe("Web API Client (apps/web/src/lib/api.ts)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should make registration request targeting /api/auth/register", async () => {
    const mockResponse = {
      token: "test_token_123",
      user: { id: "user_1", email: "test@traceback.dev", name: "Test User" },
      workspaces: [{ id: "ws_1", name: "Workspace 1", role: "OWNER" }],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await api.register({
      name: "Test User",
      email: "test@traceback.dev",
      password: "Password123!",
      passwordConfirmation: "Password123!",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/auth\/register$/),
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
      }),
    );
    expect(result.token).toBe("test_token_123");
  });

  it("should make login request targeting /api/auth/login", async () => {
    const mockResponse = {
      token: "test_token_456",
      user: { id: "user_2", email: "test2@traceback.dev", name: "Test 2" },
      workspaces: [],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await api.login({
      email: "test2@traceback.dev",
      password: "Password123!",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/auth\/login$/),
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result.token).toBe("test_token_456");
  });

  it("should clearly surface server-side validation error messages", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: jest.fn().mockResolvedValue({
        message: "Password must be at least 8 characters long",
      }),
    });

    await expect(
      api.register({
        name: "Test",
        email: "test@traceback.dev",
        password: "short",
        passwordConfirmation: "short",
      }),
    ).rejects.toThrow("Password must be at least 8 characters long");
  });

  it("should wrap network fetch failures with a descriptive ApiError message", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Failed to fetch"));

    await expect(
      api.register({
        name: "Test",
        email: "test@traceback.dev",
        password: "Password123!",
        passwordConfirmation: "Password123!",
      }),
    ).rejects.toThrow("Network error connecting to API: Failed to fetch");
  });
});
