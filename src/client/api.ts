import type { z } from "zod";
import {
  asnsResponseSchema,
  availabilityResponseSchema,
  citiesResponseSchema,
  countriesResponseSchema,
  residentialListResponseSchema,
  type AsnSearchParams,
  type CitySearchParams,
} from "@/lib/api/contracts";
import { ApiError, errorBodySchema } from "@/lib/api/errors";
import type { ResidentialListRequest } from "@/lib/proxy/schema";
import type { Targeting } from "@/lib/proxy/targeting";

/**
 * Browser client for our own routes (never api.byteful.com). Every response is
 * checked with the shared Zod contract, and every failure becomes an ApiError.
 */
async function request<T extends z.ZodType>(path: string, schema: T, init?: RequestInit): Promise<z.output<T>> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (cause) {
    if (init?.signal?.aborted) throw cause; // React Query cancelled it; not a real failure
    throw new ApiError("network_error", "Could not reach the server. Check your connection and try again.", { cause });
  }

  const body: unknown = await response.json().catch(() => undefined);
  const requestId = response.headers.get("x-request-id") ?? undefined;

  if (!response.ok) {
    const error = errorBodySchema.safeParse(body);
    if (error.success) throw ApiError.fromBody(error.data, response.status);
    throw new ApiError("internal_error", `The server returned an unexpected error (HTTP ${response.status}).`, {
      status: response.status,
      requestId,
    });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError("internal_error", "The server sent a response this page does not understand. Reload and try again.", {
      requestId,
      cause: parsed.error,
    });
  }
  return parsed.data;
}

/** Builds a query string, leaving out empty values. */
function query(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value != null && value !== "") search.set(key, String(value));
  return search.toString();
}

export const api = {
  countries: (signal?: AbortSignal) =>
    request("/api/locations/countries", countriesResponseSchema, { signal }).then((response) => response.data),
	
  cities: (params: Partial<CitySearchParams>, signal?: AbortSignal) =>
    request(`/api/locations/cities?${query(params)}`, citiesResponseSchema, { signal }),

  asns: (params: Partial<AsnSearchParams>, signal?: AbortSignal) =>
    request(`/api/locations/asns?${query(params)}`, asnsResponseSchema, { signal }),

  availability: (targeting: Targeting, signal?: AbortSignal) =>
    request(`/api/residential/availability?${query(targeting)}`, availabilityResponseSchema, { signal }).then(
      (response) => response.data.node_count,
    ),

  generateList: (body: ResidentialListRequest) =>
    request("/api/residential/list", residentialListResponseSchema, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((response) => response.data),
};
