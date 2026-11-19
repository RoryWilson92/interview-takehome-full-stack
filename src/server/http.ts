import "server-only";
import { trace } from "@opentelemetry/api";
import type { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { log } from "./log";
import { currentTraceId } from "./telemetry";

const MAX_BODY_BYTES = 16 * 1024;

type Handler = (request: Request) => Promise<Response>;

/**
 * Wraps a route handler. Any thrown error becomes the shared error body, and
 * the trace ID goes back as `x-request-id` (and `request_id` in error bodies).
 */
export function route(handler: Handler): Handler {
  return async (request) => {
    const requestId = currentTraceId() ?? crypto.randomUUID();
    let response: Response;
    try {
      response = await handler(request);
    } catch (error) {
      response = errorResponse(asApiError(error), requestId, request);
    }
    response.headers.set("x-request-id", requestId);
    return response;
  };
}

/** For HTTP methods a route does not support, so they get the same error body too. */
export const methodNotAllowed = (allowed: string) =>
  route(async (request) => {
    throw new ApiError("method_not_allowed", `${request.method} is not supported here. Use ${allowed}.`);
  });

function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError("internal_error", "Something went wrong on our side. Try again, and quote the request ID if it keeps happening.", {
    cause: error,
  });
}

function errorResponse(error: ApiError, requestId: string, request: Request): Response {
  const span = trace.getActiveSpan();
  span?.setAttributes({ "error.type": error.code, ...(error.field && { "app.error.field": error.field }) });

  const fields = { code: error.code, status: error.status, field: error.field, method: request.method, path: new URL(request.url).pathname };
  if (error.status >= 500) {
    if (error.cause) span?.recordException(error.cause instanceof Error ? error.cause : String(error.cause));
    log.error("request.failed", { ...fields, message: error.message, cause: String(error.cause ?? "") });
  } else {
    log.warn("request.rejected", { ...fields, message: error.message });
  }

  const headers = new Headers({ "Cache-Control": "no-store" });
  if (error.retryAfter) headers.set("Retry-After", String(error.retryAfter));
  return Response.json(error.toBody(requestId), { status: error.status, headers });
}

/** Parses the body as JSON whatever the Content-Type, so `curl -d` works without extra headers. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new ApiError("payload_too_large", `The request body must be at most ${MAX_BODY_BYTES} bytes.`);
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError("invalid_json", "The request body must be valid JSON.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError("invalid_json", "The request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}

/** Validates input with a Zod schema and turns the first issue into an ApiError. */
export function parseInput<T extends z.ZodType>(schema: T, input: Record<string, unknown>): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  if (issue.code === "unrecognized_keys") {
    const allowed = "shape" in schema ? ` Allowed: ${Object.keys(schema.shape as object).join(", ")}.` : "";
    return fail("invalid_parameter", issue.keys[0], `Unknown parameter "${issue.keys[0]}".${allowed}`);
  }
  const field = String(issue.path[0] ?? "body");
  if (input[field] === undefined && issue.code === "invalid_type") {
    return fail("missing_parameter", field, `${field} is required`);
  }
  return fail("invalid_parameter", field, `${field} ${issue.message}`);
}

function fail(code: "invalid_parameter" | "missing_parameter", field: string, message: string): never {
  throw new ApiError(code, message, { field });
}

/** Query string as a plain object for schema parsing. */
export function searchParams(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams);
}

export const json = (data: unknown, cacheControl = "no-store") =>
  Response.json(data, { headers: { "Cache-Control": cacheControl } });
