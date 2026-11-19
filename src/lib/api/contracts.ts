import { z } from "zod";
import { TARGETING } from "@/lib/proxy/targeting";

/*
 * Shapes of our own lookup API. The server builds them, the browser parses them,
 * so a drift between the two shows up as a clear error instead of a broken UI.
 * Field names match the generator request (country_id, city_alias, asn_id).
 */

export const countrySchema = z.object({
  country_id: z.string(),
  country_name: z.string(),
  continent_id: z.string().nullable(),
  node_count: z.number(),
});

export const citySchema = z.object({
  city_id: z.number(),
  city_alias: z.string(),
  city_name: z.string(),
  subdivision_id: z.string(),
  node_count: z.number(),
});

export const asnSchema = z.object({
  asn_id: z.number(),
  asn_name: z.string(),
  asn_type: z.string().nullable(),
  country_id: z.string().nullable(),
  node_count: z.number(),
});

export type Country = z.infer<typeof countrySchema>;
export type City = z.infer<typeof citySchema>;
export type Asn = z.infer<typeof asnSchema>;

const searchResponse = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item), total_count: z.number() });

export const countriesResponseSchema = z.object({ data: z.array(countrySchema) });
export const citiesResponseSchema = searchResponse(citySchema);
export const asnsResponseSchema = searchResponse(asnSchema);
export const availabilityResponseSchema = z.object({ data: z.object({ node_count: z.number() }) });
export const residentialListResponseSchema = z.object({ data: z.array(z.string()), message: z.string() });

export type SearchResult<T> = { data: T[]; total_count: number };
export type ResidentialListResponse = z.infer<typeof residentialListResponseSchema>;

// Lookup query strings. `q` is free text; `limit` caps the number of results.
const searchQuery = z.string().trim().max(64, "must be at most 64 characters").optional();
const searchLimit = z.coerce.number().int().min(1).max(100).default(50);

export const citySearchParamsSchema = z.object({
  country_id: TARGETING.country_id.schema,
  q: searchQuery,
  limit: searchLimit,
});

export const asnSearchParamsSchema = z.object({
  country_id: TARGETING.country_id.schema.optional(),
  q: searchQuery,
  limit: searchLimit,
});

export type CitySearchParams = z.output<typeof citySearchParamsSchema>;
export type AsnSearchParams = z.output<typeof asnSearchParamsSchema>;
