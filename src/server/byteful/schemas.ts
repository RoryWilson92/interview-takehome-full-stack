import "server-only";
import { z } from "zod";

// Only the fields we use. Counts are optional upstream data, so a missing
// count reads as 0 rather than failing the row.
const count = z.number().nullish().transform((value) => value ?? 0);

export const bytefulCountrySchema = z.object({
  country_id: z.string(),
  country_name: z.string(),
  continent_id: z.string().nullish().transform((value) => value ?? null),
  country_node_count: count,
});

export const bytefulCitySchema = z.object({
  city_id: z.number(),
  city_alias: z.string(),
  city_name: z.string(),
  subdivision_id: z.string(),
  city_node_count: count,
});

export const bytefulAsnSchema = z.object({
  asn_id: z.number(),
  asn_name: z.string(),
  asn_type: z.string().nullish().transform((value) => value ?? null),
  country_id: z.string().nullish().transform((value) => value ?? null),
  asn_node_count: count,
});

export const bytefulAvailabilitySchema = z.object({
  data: z.object({ total_residential_availability_node_count: z.number() }),
});
