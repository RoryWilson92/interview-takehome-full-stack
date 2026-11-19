import { targetingSchema } from "@/lib/proxy/schema";
import { json, parseInput, route, searchParams } from "@/server/http";
import { countAvailability } from "@/server/residential";

/** GET ?country_id=gb&city_alias=london&asn_id=5089 → online nodes that match the targeting. */
export const GET = route(async (request) => {
  const { asn_id, ...query } = searchParams(request);
  // Query values are strings; the shared schema expects asn_id as a number, like the JSON body.
  const targeting = parseInput(targetingSchema, { ...query, ...(asn_id !== undefined && { asn_id: Number(asn_id) }) });
  const nodeCount = await countAvailability(targeting);
  return json({ data: { node_count: nodeCount } }, "private, max-age=60");
});
