import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";

describe("HttpExceptionFilter", () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it("should format HttpException into structured ApiErrorResponse envelope", () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({ status: mockStatus }),
        getRequest: () => ({ url: "/api/test" }),
      }),
    } as unknown as ArgumentsHost;

    const exception = new HttpException(
      "Bad Request Sample",
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: "Bad Request Sample",
        }),
      }),
    );
  });

  it("should mask unhandled internal errors without leaking internal stack traces", () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({ status: mockStatus }),
        getRequest: () => ({ url: "/api/unhandled" }),
      }),
    } as unknown as ArgumentsHost;

    const secretError = new Error(
      'FATAL: password authentication failed for user "postgres"',
    );
    filter.catch(secretError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "INTERNAL_UNHANDLED",
          message: "An unexpected internal error occurred",
        }),
      }),
    );
    // Crucial check: database secret error message is NOT sent to client
    const sentPayload = mockJson.mock.calls[0][0];
    expect(sentPayload.error.message).not.toContain("password authentication");
  });

  it("should redact database URLs, bearer tokens, and credentials in HttpException responses", () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({ status: mockStatus }),
        getRequest: () => ({ url: "/api/test-leak" }),
      }),
    } as unknown as ArgumentsHost;

    const leakingException = new HttpException(
      "Connection failed to postgresql://admin:super_secret_password@db.internal:5432/traceback with Bearer tb_live_user_123_abc456",
      HttpStatus.BAD_GATEWAY,
    );
    filter.catch(leakingException, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
    const sentPayload = mockJson.mock.calls[0][0];
    expect(sentPayload.error.message).not.toContain("super_secret_password");
    expect(sentPayload.error.message).not.toContain("tb_live_user_123_abc456");
    expect(sentPayload.error.message).toContain(
      "postgresql://admin:[REDACTED]@",
    );
    expect(sentPayload.error.message).toContain("Bearer [REDACTED]");
  });
});
