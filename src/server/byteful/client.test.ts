import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { bytefulGet } from "./client";

const schema = z.object({ ok: z.literal(true) });
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeAll(() => {
  process.env.BYTEFUL_PUBLIC_KEY = "pub";
  process.env.BYTEFUL_PRIVATE_KEY = "priv";
});
afterEach(() => vi.unstubAllGlobals());

function mockFetch(...responses: Array<Response | Error>) {
  const fetch = vi.fn();
  for (const response of responses) {
    if (response instanceof Error) fetch.mockRejectedValueOnce(response);
    else fetch.mockResolvedValueOnce(response);
  }
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("bytefulGet", () => {
  it("sends both API key headers and validates the response", async () => {
    const fetch = mockFetch(reply(200, { ok: true }));
    await expect(bytefulGet("/country/search", { per_page: 1 }, schema)).resolves.toEqual({ ok: true });
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe("https://api.byteful.com/1.0/public/user/country/search?per_page=1");
    expect(init.headers).toEqual({ "X-API-Public-Key": "pub", "X-API-Private-Key": "priv" });
  });

  it("retries 429 and 5xx, then succeeds", async () => {
    const fetch = mockFetch(reply(429, { error: "Too Many Requests" }), reply(503, {}), reply(200, { ok: true }));
    await expect(bytefulGet("/x", {}, schema)).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("maps a rejected key to upstream_auth_failed without retrying", async () => {
    const fetch = mockFetch(reply(401, { error: "Unauthorized", message: "Invalid API key." }));
    await expect(bytefulGet("/x", {}, schema)).rejects.toMatchObject({ code: "upstream_auth_failed", status: 502 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives up after repeated rate limits with rate_limited", async () => {
    mockFetch(reply(429, {}), reply(429, {}), reply(429, {}));
    await expect(bytefulGet("/x", {}, schema)).rejects.toMatchObject({ code: "rate_limited", status: 429 });
  });

  it("maps timeouts and malformed data", async () => {
    mockFetch(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    await expect(bytefulGet("/x", {}, schema)).rejects.toMatchObject({ code: "upstream_timeout", status: 504 });
    mockFetch(reply(200, { ok: "yes" }));
    await expect(bytefulGet("/x", {}, schema)).rejects.toMatchObject({ code: "upstream_error", status: 502 });
  });
});
