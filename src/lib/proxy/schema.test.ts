import { describe, expect, it } from "vitest";
import { messagesByField, residentialListRequestSchema } from "./schema";

const base = { proxy_user_id: "alice", proxy_user_password: "secret" };
const errors = (input: Record<string, unknown>) => {
  const result = residentialListRequestSchema.safeParse({ ...base, ...input });
  return result.success ? {} : messagesByField(result.error.issues);
};

describe("residentialListRequestSchema", () => {
  it("fills in the defaults", () => {
    expect(residentialListRequestSchema.parse(base)).toMatchObject({ list_count: 100, list_format: "http", list_session_type: "sticky" });
  });

  it.each([0, 1001, 1.5, "100", null])("rejects list_count %s", (list_count) => {
    expect(errors({ list_count }).list_count).toBe("must be a whole number from 1 to 1000");
  });

  it("requires country_id for city_alias", () => {
    expect(errors({ city_alias: "london" }).city_alias).toBe("requires country_id");
  });

  it("normalizes country and city case, and treats null as not set", () => {
    const parsed = residentialListRequestSchema.parse({ ...base, country_id: " GB ", city_alias: "London", asn_id: null });
    expect(parsed).toMatchObject({ country_id: "gb", city_alias: "london", asn_id: null });
  });

  it("rejects blank credentials, unknown formats and unknown keys", () => {
    expect(errors({ proxy_user_id: "  " }).proxy_user_id).toBe("is required");
    expect(errors({ list_format: "ftp" }).list_format).toBe("must be one of http, https, socks5, socks5h");
    expect(residentialListRequestSchema.safeParse({ ...base, contry_id: "gb" }).error?.issues[0].code).toBe("unrecognized_keys");
  });

  it("rejects malformed targeting", () => {
    expect(errors({ country_id: "gbr" }).country_id).toMatch(/two-letter/);
    expect(errors({ country_id: "gb", city_alias: "new york" }).city_alias).toMatch(/city_alias/);
    expect(errors({ asn_id: "5089" }).asn_id).toBe("must be a number");
  });
});
