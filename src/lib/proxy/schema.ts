import { z } from "zod";
import { segmentOf, TARGETING, TARGETING_FIELDS, type TargetingField } from "./targeting";

export const LIST_FORMATS = ["http", "https", "socks5", "socks5h"] as const;
export const SESSION_TYPES = ["sticky", "rotating"] as const;
export const LIST_COUNT = { min: 1, max: 1000, default: 100 } as const;

export type ListFormat = (typeof LIST_FORMATS)[number];
export type SessionType = (typeof SESSION_TYPES)[number];

const requiredString = (max: number) =>
  z
    .string({ error: "must be a string" })
    .max(max, `must be at most ${max} characters`)
    .refine((value) => value.trim().length > 0, "is required");

const countMessage = `must be a whole number from ${LIST_COUNT.min} to ${LIST_COUNT.max}`;

// Built from the registry so a new targeting option only needs a registry entry.
const targetingShape = Object.fromEntries(
  TARGETING_FIELDS.map((field) => [field, TARGETING[field].schema.nullish()]),
) as { [K in TargetingField]: z.ZodOptional<z.ZodNullable<(typeof TARGETING)[K]["schema"]>> };

/** Enforces the registry's `requires` rules, for example city_alias needs country_id. */
function checkDependencies(value: Record<string, unknown>, ctx: z.RefinementCtx) {
  for (const field of TARGETING_FIELDS) {
    const { requires } = segmentOf(field);
    if (requires && value[field] != null && value[requires] == null) {
      ctx.addIssue({ code: "custom", path: [field], message: `requires ${requires}` });
    }
  }
}

export const targetingSchema = z.strictObject(targetingShape).superRefine(checkDependencies);

/**
 * POST /api/residential/list body. Shared by the route handler and the page,
 * so the form can never send a request the server would reject.
 */
export const residentialListRequestSchema = z
  .strictObject({
    proxy_user_id: requiredString(128),
    proxy_user_password: requiredString(256),
    list_count: z
      .number({ error: countMessage })
      .int(countMessage)
      .min(LIST_COUNT.min, countMessage)
      .max(LIST_COUNT.max, countMessage)
      .default(LIST_COUNT.default),
    list_format: z.enum(LIST_FORMATS, { error: `must be one of ${LIST_FORMATS.join(", ")}` }).default("http"),
    list_session_type: z.enum(SESSION_TYPES, { error: `must be one of ${SESSION_TYPES.join(", ")}` }).default("sticky"),
    ...targetingShape,
  })
  .superRefine(checkDependencies);

export type ResidentialListInput = z.input<typeof residentialListRequestSchema>;
export type ResidentialListRequest = z.output<typeof residentialListRequestSchema>;
export type RequestField = keyof ResidentialListRequest;

/** First message per top-level field, for showing errors next to form inputs. */
export function messagesByField(issues: readonly z.core.$ZodIssue[]): Partial<Record<string, string>> {
  const messages: Partial<Record<string, string>> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "");
    messages[field] ??= issue.message;
  }
  return messages;
}
