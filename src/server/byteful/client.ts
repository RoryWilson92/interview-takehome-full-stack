import "server-only";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { sleep } from "@/lib/utils";
import { serverEnv } from "../env";
import { log } from "../log";
import { createRateLimiter } from "../rate-limiter";
import { traced } from "../telemetry";

const TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;
const PER_PAGE = 100; // the documented maximum

// Byteful allows 20 requests per second per customer, shared by all keys.
// Stay a little under it so a burst of lookups never turns into 429s.
const acquireSlot = createRateLimiter(18, 1_000);

// Rory - Backoff adds jitter to the backoff time to avoid thundering herd problem.
const backoff = (attempt: number) => 250 * 2 ** attempt + Math.random() * 100;

// Byteful API error format.
const upstreamErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  api_request_id: z.string().optional(),
});

type Query = Record<string, string | number | undefined>;

/**
 * GET a Byteful endpoint and validate the response with `schema`. Retries 429,
 * 5xx and network failures with backoff; turns everything else into an ApiError
 * the routes can return as is.
 */
export async function bytefulGet<T extends z.ZodType>(path: string, query: Query, schema: T): Promise<z.output<T>> {
  const { BYTEFUL_API_URL, BYTEFUL_PUBLIC_KEY, BYTEFUL_PRIVATE_KEY } = serverEnv();
  const url = new URL(`${BYTEFUL_API_URL}/public/user${path}`);
  for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, String(value));
  const headers = { "X-API-Public-Key": BYTEFUL_PUBLIC_KEY, "X-API-Private-Key": BYTEFUL_PRIVATE_KEY };

  return traced(`byteful GET ${path}`, { "byteful.path": path, "byteful.query": url.search }, async (span) => {
    for (let attempt = 0; ; attempt++) {
      await acquireSlot();
      const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(
        (error: Error) => error,
      );

      if (response instanceof Error) {
        // Retrying a timeout would make the user wait another 8s, so only retry fast failures.
        if (response.name === "TimeoutError") {
          throw new ApiError("upstream_timeout", "The Byteful API did not respond in time. Try again in a moment.", {
            cause: response,
          });
        }
        if (attempt < MAX_RETRIES) {
          span.addEvent("retry", { attempt, reason: response.message });
          await sleep(backoff(attempt));
          continue;
        }
        throw new ApiError("upstream_error", "Could not reach the Byteful API. Try again in a moment.", { cause: response });
      }

      span.setAttribute("http.response.status_code", response.status);
      const body: unknown = await response.json().catch(() => undefined);

      if (response.ok) {
        const parsed = schema.safeParse(body);
        if (parsed.success) return parsed.data;
        log.error("byteful.unexpected_response", { path, issues: parsed.error.issues.slice(0, 5) });
        throw new ApiError("upstream_error", "The Byteful API returned data in an unexpected format.");
      }

      const error = upstreamErrorSchema.safeParse(body).data ?? {};
      if (error.api_request_id) span.setAttribute("byteful.api_request_id", error.api_request_id);
      log.warn("byteful.error_response", { path, status: response.status, attempt, ...error });

      if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
        const retryAfterMs = Number(response.headers.get("retry-after")) * 1000;
        span.addEvent("retry", { attempt, status: response.status });
        await sleep(Math.min(retryAfterMs || backoff(attempt), 2_000));
        continue;
      }
      throw toApiError(response.status, error.message);
    }
  });
}

function toApiError(status: number, upstreamMessage?: string): ApiError {
  const detail = upstreamMessage ? ` Byteful said: "${upstreamMessage}"` : "";
  if (status === 401 || status === 403) {
    return new ApiError(
      "upstream_auth_failed",
      `The Byteful API rejected this server's API key.${detail} Check BYTEFUL_PUBLIC_KEY and BYTEFUL_PRIVATE_KEY.`,
    );
  }
  if (status === 429) {
    return new ApiError("rate_limited", "The Byteful API is busy. Wait a few seconds and try again.", { retryAfter: 2 });
  }
  return new ApiError("upstream_error", `The Byteful API returned an error (HTTP ${status}).${detail}`);
}

const pageSchema = z.object({ data: z.array(z.unknown()), total_count: z.number() });

/**
 * One page of a search. Rows are validated one by one: a single malformed row
 * is logged and skipped instead of failing the whole lookup.
 */
export async function bytefulSearch<T extends z.ZodType>(path: string, query: Query, row: T) {
  const page = await bytefulGet(path, query, pageSchema);
  const rows = page.data.flatMap((item) => {
    const parsed = row.safeParse(item);
    return parsed.success ? [parsed.data as z.output<T>] : [];
  });
  if (rows.length < page.data.length) log.warn("byteful.rows_skipped", { path, skipped: page.data.length - rows.length });
  return { rows, total: page.total_count, pageSize: page.data.length };
}

/** Every page of a search. Fine for small sets like the 250 countries. */
export async function bytefulSearchAll<T extends z.ZodType>(path: string, query: Query, row: T, maxPages = 20) {
  const all: z.output<T>[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const { rows, pageSize } = await bytefulSearch(path, { ...query, page, per_page: PER_PAGE }, row);
    all.push(...rows);
    if (pageSize < PER_PAGE) break;
  }
  return all;
}
