import { connection } from "next/server";
import { json, route } from "@/server/http";
import { listCountries } from "@/server/byteful/locations";

/** Every country with its online node count, busiest first. Small enough to send whole. */
export const GET = route(async () => {
  // This handler reads nothing from the request, so Next would prerender it at
  // build time. That would need the API key during the build and freeze the
  // node counts. connection() keeps it a request-time route.
  await connection();
  return json({ data: await listCountries() }, "public, max-age=300, stale-while-revalidate=3600");
});
