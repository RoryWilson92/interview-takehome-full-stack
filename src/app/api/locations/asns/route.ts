import { asnSearchParamsSchema } from "@/lib/api/contracts";
import { json, parseInput, route, searchParams } from "@/server/http";
import { searchAsns } from "@/server/byteful/locations";

/** GET ?country_id=gb&q=virgin (or q=AS5089) → ASNs, busiest first. country_id is optional. */
export const GET = route(async (request) => {
  const params = parseInput(asnSearchParamsSchema, searchParams(request));
  return json(await searchAsns(params), "public, max-age=300, stale-while-revalidate=3600");
});
