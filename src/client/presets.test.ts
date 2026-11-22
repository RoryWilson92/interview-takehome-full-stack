import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratorValues } from "@/components/generator/use-generator-form";
import { savePreset } from "./presets";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});

describe("savePreset", () => {
  it("never stores credentials, even when given the whole form", () => {
    // The presets menu passes form.values, which includes the credentials.
    const form: GeneratorValues = {
      proxy_user_id: "alice",
      proxy_user_password: "secretpass",
      list_count: "100",
      list_format: "socks5h",
      list_session_type: "rotating",
      country: null,
      city: null,
      asn: null,
    };
    savePreset("Rotating SOCKS", form);

    const stored = storage.get("byteful.generator.presets") ?? "";
    expect(stored).not.toContain("secretpass");
    expect(stored).not.toContain("proxy_user");
    expect(JSON.parse(stored).presets[0].values).toEqual({
      list_count: "100",
      list_format: "socks5h",
      list_session_type: "rotating",
      country: null,
      city: null,
      asn: null,
    });
  });
});
