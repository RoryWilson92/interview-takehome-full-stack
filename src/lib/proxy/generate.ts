import type { ListFormat, ResidentialListRequest } from "./schema";
import { buildUsername } from "./targeting";

export const PROXY_HOST = "residential.byteful.com";
export const PROXY_PORT = 8000;
export const SESSION_ID_LENGTH = 16;

const SESSION_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
// The largest multiple of 36 that fits in a byte. Bytes at or above it are
// dropped so every character is equally likely (no modulo bias).
const UNBIASED_LIMIT = 252;

/** 16 random uppercase letters and digits from the platform CSPRNG. */
export function randomSessionId(): string {
  let id = "";
  const bytes = new Uint8Array(SESSION_ID_LENGTH * 2);
  while (id.length < SESSION_ID_LENGTH) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < UNBIASED_LIMIT) id += SESSION_ALPHABET[byte % SESSION_ALPHABET.length];
      if (id.length === SESSION_ID_LENGTH) break;
    }
  }
  return id;
}

/**
 * `<format>://<username>:<password>@residential.byteful.com:8000`.
 * Credentials are percent-encoded so a password with ":" or "@" still parses;
 * plain values like the spec examples come out unchanged.
 */
export function proxyUrl(format: ListFormat, username: string, password: string): string {
  return `${format}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${PROXY_HOST}:${PROXY_PORT}`;
}

/** Builds the list in-process. Sticky lists get a unique session ID per line. */
export function generateProxyList(request: ResidentialListRequest): string[] {
  const { proxy_user_id, proxy_user_password, list_count, list_format, list_session_type, ...targeting } = request;
  const line = (sessionId?: string) =>
    proxyUrl(list_format, buildUsername(proxy_user_id, targeting, sessionId), proxy_user_password);

  if (list_session_type === "rotating") return Array.from({ length: list_count }, () => line());

  // A Set guarantees uniqueness, even though a clash among 36^16 IDs is astronomically unlikely.
  const sessionIds = new Set<string>();
  while (sessionIds.size < list_count) sessionIds.add(randomSessionId());
  return Array.from(sessionIds, line);
}
