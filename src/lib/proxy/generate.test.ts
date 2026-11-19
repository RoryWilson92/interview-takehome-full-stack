import { describe, expect, it } from "vitest";
import { generateProxyList, randomSessionId } from "./generate";
import { residentialListRequestSchema } from "./schema";

const request = (input: Record<string, unknown>) =>
  residentialListRequestSchema.parse({ proxy_user_id: "alice", proxy_user_password: "secretpass", ...input });

describe("generateProxyList", () => {
  it("matches the spec example format", () => {
    const [line] = generateProxyList(request({ list_count: 1, country_id: "gb", city_alias: "norwich" }));
    expect(line).toMatch(/^http:\/\/alice_c_gb_city_norwich_s_[A-Z0-9]{16}:secretpass@residential\.byteful\.com:8000$/);
  });

  it("applies the defaults: 100 sticky http proxies", () => {
    const list = generateProxyList(request({}));
    expect(list).toHaveLength(100);
    expect(list.every((line) => /^http:\/\/alice_s_[A-Z0-9]{16}:secretpass@residential\.byteful\.com:8000$/.test(line))).toBe(true);
  });

  it("gives every sticky line a unique session ID", () => {
    const list = generateProxyList(request({ list_count: 1000 }));
    expect(new Set(list).size).toBe(1000);
  });

  it("returns identical lines without a session for rotating lists", () => {
    const list = generateProxyList(request({ list_count: 3, list_session_type: "rotating", list_format: "socks5h", asn_id: 5089 }));
    expect(list).toEqual(Array(3).fill("socks5h://alice_asn_5089:secretpass@residential.byteful.com:8000"));
  });

  it("orders segments country, city, ASN, session", () => {
    const [line] = generateProxyList(request({ list_count: 1, country_id: "US", city_alias: "new_york", asn_id: 7922 }));
    expect(line).toMatch(/^http:\/\/alice_c_us_city_new_york_asn_7922_s_[A-Z0-9]{16}:/);
  });

  it("percent-encodes credentials that would break the URL", () => {
    const [line] = generateProxyList(
      request({ list_count: 1, list_session_type: "rotating", proxy_user_id: "a@b", proxy_user_password: "p:@/ss" }),
    );
    expect(line).toBe("http://a%40b:p%3A%40%2Fss@residential.byteful.com:8000");
  });
});

describe("randomSessionId", () => {
  it("uses all 36 characters and nothing else", () => {
    const chars = new Set(Array.from({ length: 2000 }, randomSessionId).join(""));
    expect(chars.size).toBe(36);
    expect([...chars].every((c) => /[A-Z0-9]/.test(c))).toBe(true);
  });
});
