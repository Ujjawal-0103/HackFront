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
});
