import { z } from "zod";

/**
 * Every error code the API returns, with its HTTP status. The server builds its
 * error responses from this table and the client reads them back with it.
 */
export const ERROR_STATUS = {
  invalid_json: 400,
  missing_parameter: 400,
  invalid_parameter: 400,
  method_not_allowed: 405,
  payload_too_large: 413,
  unknown_location: 422,
  rate_limited: 429,
  internal_error: 500,
  configuration_error: 500,
  upstream_error: 502,
  upstream_auth_failed: 502,
  upstream_timeout: 504,
  // Client only: the request never got an HTTP response.
  network_error: 0,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

/** The one error body shape every route returns. */
export const errorBodySchema = z.object({
  error: z.string(),
  message: z.string(),
  field: z.string().optional(),
  request_id: z.string().optional(),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;

type ApiErrorOptions = {
  field?: string;
  requestId?: string;
  /** Seconds, sent as the Retry-After header. */
  retryAfter?: number;
  status?: number;
  cause?: unknown;
};

/** Thrown by server code and rebuilt by the browser client from an error body. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly field?: string;
  readonly requestId?: string;
  readonly retryAfter?: number;

  constructor(code: ErrorCode, message: string, options: ApiErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.code = code;
    this.status = options.status ?? ERROR_STATUS[code] ?? 500;
    this.field = options.field;
    this.requestId = options.requestId;
    this.retryAfter = options.retryAfter;
  }

  static fromBody(body: ErrorBody, status: number): ApiError {
    const code = (body.error in ERROR_STATUS ? body.error : "internal_error") as ErrorCode;
    return new ApiError(code, body.message, { field: body.field, requestId: body.request_id, status });
  }

  toBody(requestId?: string): ErrorBody {
    return {
      error: this.code,
      message: this.message,
      ...(this.field && { field: this.field }),
      ...(requestId && { request_id: requestId }),
    };
  }
}
