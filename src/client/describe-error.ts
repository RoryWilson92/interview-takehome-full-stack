import { ApiError } from "@/lib/api/errors";

export type ErrorCopy = { title: string; detail: string; retryable: boolean; requestId?: string };

/** Turns any error into a title and a next step a user can act on. */
export function describeError(error: unknown, labels: Record<string, string> = {}): ErrorCopy {
  const apiError = error instanceof ApiError ? error : new ApiError("internal_error", "An unexpected error happened.");
  const { code, message, field, requestId } = apiError;
  const copy = (title: string, detail: string, retryable: boolean): ErrorCopy => ({ title, detail, retryable, requestId });

  switch (code) {
    case "network_error":
      return copy("Can't reach the server", "Check your internet connection, then try again.", true);
    case "rate_limited":
      return copy("Too many requests", "Byteful is busy right now. Wait a few seconds, then try again.", true);
    case "upstream_timeout":
    case "upstream_error":
      return copy("Byteful is not responding", "Location data is unavailable for a moment. Try again shortly.", true);
    case "upstream_auth_failed":
    case "configuration_error":
      return copy("The server is not set up correctly", message, false);
    case "unknown_location": {
      const label = field ? (labels[field] ?? field) : "This location";
      return copy("Location not available", `${label} is not available any more. Pick another one and generate again.`, false);
    }
    case "invalid_parameter":
    case "missing_parameter":
    case "invalid_json":
      return copy("Check the highlighted field", message, false);
    default:
      return copy("Something went wrong", message, true);
  }
}
