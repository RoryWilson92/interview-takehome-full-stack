import type { ResidentialListResponse } from "@/lib/api/contracts";
import { residentialListRequestSchema } from "@/lib/proxy/schema";
import { json, methodNotAllowed, parseInput, readJsonObject, route } from "@/server/http";
import { createResidentialList } from "@/server/residential";

/** Builds a residential proxy list in-process, mirroring Byteful's Create Residential List. */
export const POST = route(async (request) => {
  const input = parseInput(residentialListRequestSchema, await readJsonObject(request));
  const data = await createResidentialList(input);
  // no-store: the list contains the proxy password.
  return json({ data, message: "Residential list successfully generated." } satisfies ResidentialListResponse);
});

export const GET = methodNotAllowed("POST");
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
