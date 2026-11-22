import { z } from "zod";

/**
 * The targeting options a proxy username can carry, in username order:
 *
 *   <proxy_user_id>[_c_<country_id>[_city_<city_alias>]][_asn_<asn_id>][_s_<session_id>]
 *
 * This registry is the single place that knows about targeting. The request
 * schema, the username builder and the live preview all read it, so a new option
 * (for example a US state, tag `st`) is one entry here plus its form field.
 * Messages are predicates; callers prefix them with the field name or label.
 */
export const TARGETING = {
  country_id: {
    tag: "c",
    label: "Country",
    schema: z
      .string({ error: "must be a string" })
      .trim()
      .toLowerCase()
      .regex(/^[a-z]{2}$/, 'must be a two-letter ISO 3166-1 code, for example "us"'),
  },
  city_alias: {
    tag: "city",
    label: "City",
    requires: "country_id",
    schema: z
      .string({ error: "must be a string" })
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_]{1,64}$/, 'must be a city_alias from the city search, for example "new_york"'),
  },
  asn_id: {
    tag: "asn",
    label: "ASN",
    schema: z
      .number({ error: "must be a number" })
      .int("must be a whole number")
      .min(1, "must be a valid ASN")
      .max(4_294_967_295, "must be a valid ASN"),
  },
} satisfies Record<string, Segment>;

type Segment = { tag: string; label: string; requires?: string; schema: z.ZodType };

export type TargetingField = keyof typeof TARGETING;
export const TARGETING_FIELDS = Object.keys(TARGETING) as TargetingField[];

/** A registry entry with its optional keys visible (`requires` only exists on some). */
export const segmentOf = (field: TargetingField) => TARGETING[field] as Segment & { requires?: TargetingField };

/** null and undefined both mean "not targeted", so JSON clients can send either. */
export type Targeting = {
  [K in TargetingField]?: z.output<(typeof TARGETING)[K]["schema"]> | null;
};

export type UsernamePart =
  | { kind: "user"; value: string }
  | { kind: TargetingField | "session"; tag: string; value: string };

/** Splits a username into labelled parts. The live preview renders these one by one. */
export function usernameParts(proxyUserId: string, targeting: Targeting, sessionId?: string): UsernamePart[] {
  const parts: UsernamePart[] = [{ kind: "user", value: proxyUserId }];
  for (const field of TARGETING_FIELDS) {
    const segment = segmentOf(field);
    const value = targeting[field];
    // A dependent segment (city) only makes sense inside its parent (country).
    const parentMissing = segment.requires && targeting[segment.requires] == null;
    if (value != null && !parentMissing) parts.push({ kind: field, tag: segment.tag, value: String(value) });
  }
  if (sessionId) parts.push({ kind: "session", tag: "s", value: sessionId });
  return parts;
}

export function buildUsername(proxyUserId: string, targeting: Targeting, sessionId?: string): string {
  const parts = usernameParts(proxyUserId, targeting, sessionId);
  return parts.map((part) => (part.kind === "user" ? part.value : `${part.tag}_${part.value}`)).join("_");
}
