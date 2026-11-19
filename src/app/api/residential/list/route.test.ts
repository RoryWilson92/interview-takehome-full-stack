import { describe, expect, it, vi } from "vitest";
import { POST, GET } from "./route";

// Stand-in location data, so the route test needs no network.
vi.mock("@/server/byteful/locations", () => ({
  listCountries: async () => [{ country_id: "gb", country_name: "United Kingdom", continent_id: "eu", node_count: 9 }],
  findCity: async (_country: string, alias: string) =>
    alias === "norwich" ? { city_id: 1, city_alias: "norwich", city_name: "Norwich", subdivision_id: "gb-nfk", node_count: 9 } : null,
  findAsn: async (id: number) =>
    ({ 5089: { asn_id: 5089, asn_name: "Virgin Media", asn_type: "isp", country_id: "gb", node_count: 9 },
       7922: { asn_id: 7922, asn_name: "Comcast", asn_type: "isp", country_id: "us", node_count: 9 } })[id] ?? null,
}));

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/residential/list", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const creds = { proxy_user_id: "alice", proxy_user_password: "secretpass" };

describe("POST /api/residential/list", () => {
  it("returns the list and the success message", async () => {
    const response = await post({ ...creds, list_count: 2, country_id: "gb", city_alias: "norwich", asn_id: 5089 });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    const body = await response.json();
    expect(body.message).toBe("Residential list successfully generated.");
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatch(/^http:\/\/alice_c_gb_city_norwich_asn_5089_s_[A-Z0-9]{16}:secretpass@residential\.byteful\.com:8000$/);
  });

  it.each([
    ["not json", "{oops", 400, "invalid_json", undefined],
    ["an array", "[]", 400, "invalid_json", undefined],
    ["no password", { proxy_user_id: "alice" }, 400, "missing_parameter", "proxy_user_password"],
    ["a count out of range", { ...creds, list_count: 1001 }, 400, "invalid_parameter", "list_count"],
    ["a city without a country", { ...creds, city_alias: "norwich" }, 400, "invalid_parameter", "city_alias"],
    ["an unknown key", { ...creds, contry_id: "gb" }, 400, "invalid_parameter", "contry_id"],
    ["an unknown country", { ...creds, country_id: "zz" }, 422, "unknown_location", "country_id"],
    ["an unknown city", { ...creds, country_id: "gb", city_alias: "londn" }, 422, "unknown_location", "city_alias"],
    ["an ASN from another country", { ...creds, country_id: "gb", asn_id: 7922 }, 422, "unknown_location", "asn_id"],
  ])("rejects %s with the shared error shape", async (_name, body, status, error, field) => {
    const response = await post(body);
    expect(response.status).toBe(status);
    const json = await response.json();
    expect(json).toMatchObject({ error, ...(field && { field }) });
    expect(typeof json.message).toBe("string");
    expect(json.request_id).toBe(response.headers.get("x-request-id"));
  });

  it("uses the same error shape for unsupported methods", async () => {
    const response = await GET(new Request("http://localhost/api/residential/list"));
    expect(response.status).toBe(405);
    expect(await response.json()).toMatchObject({ error: "method_not_allowed" });
  });
});
