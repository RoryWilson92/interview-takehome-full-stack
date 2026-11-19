import { citySearchParamsSchema } from "@/lib/api/contracts";
import { json, parseInput, route, searchParams } from "@/server/http";
import { searchCities } from "@/server/byteful/locations";

/** GET ?country_id=gb&q=lon&limit=50 → cities in one country, busiest first. */
export const GET = route(async (request) => {
  const params = parseInput(citySearchParamsSchema, searchParams(request));
  return json(await searchCities(params), "public, max-age=300, stale-while-revalidate=3600");
});
