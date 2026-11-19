import "server-only";
import { ApiError } from "@/lib/api/errors";
import { generateProxyList } from "@/lib/proxy/generate";
import type { ResidentialListRequest } from "@/lib/proxy/schema";
import type { Targeting } from "@/lib/proxy/targeting";
import { countAvailableNodes, findAsn, findCity, listCountries } from "./byteful/locations";
import { traced } from "./telemetry";

const unknown = (field: string, message: string) => new ApiError("unknown_location", message, { field });

/**
 * Checks the targeting against Byteful's location data, so a typo like
 * city_alias "londn" fails here instead of as a dead proxy later. Lookups are
 * cached, so this normally costs no upstream call.
 *
 * Trade-off: generation now depends on the Byteful API being up. If that
 * matters more than catching bad targeting, this check could fail open with
 * a warning instead.
 */
export async function resolveTargeting({ country_id, city_alias, asn_id }: Targeting) {
  const [countries, city, asn] = await Promise.all([
    country_id ? listCountries() : null,
    country_id && city_alias ? findCity(country_id, city_alias) : null,
    asn_id ? findAsn(asn_id) : null,
  ]);

  if (country_id && !countries?.some((country) => country.country_id === country_id)) {
    throw unknown("country_id", `country_id "${country_id}" is not a country Byteful serves. See GET /api/locations/countries.`);
  }
  if (country_id && city_alias && !city) {
    throw unknown(
      "city_alias",
      `city_alias "${city_alias}" was not found in country "${country_id}". Search with GET /api/locations/cities?country_id=${country_id}&q=...`,
    );
  }
  if (asn_id && !asn) {
    throw unknown("asn_id", `asn_id ${asn_id} was not found. Search with GET /api/locations/asns?q=...`);
  }
  // An ASN registered in another country has no nodes in this one, so every proxy would fail.
  if (asn && country_id && asn.country_id !== country_id) {
    throw unknown(
      "asn_id",
      `asn_id ${asn.asn_id} (${asn.asn_name}) is in "${asn.country_id}", not "${country_id}". Pick an ASN in that country or leave out country_id.`,
    );
  }
  return { city, asn };
}

export function createResidentialList(request: ResidentialListRequest): Promise<string[]> {
  const attributes = {
    "proxy.count": request.list_count,
    "proxy.format": request.list_format,
    "proxy.session_type": request.list_session_type,
    "proxy.country_id": request.country_id ?? "",
    "proxy.city_alias": request.city_alias ?? "",
    "proxy.asn_id": request.asn_id ?? 0,
  };
  return traced("residential.create_list", attributes, async () => {
    await resolveTargeting(request);
    return generateProxyList(request);
  });
}

/** How many online nodes match the targeting. Unknown locations still raise unknown_location. */
export async function countAvailability(targeting: Targeting): Promise<number> {
  const { city } = await resolveTargeting(targeting);
  return countAvailableNodes({
    country_id: targeting.country_id ?? undefined,
    city_name: city?.city_name,
    asn_id: targeting.asn_id ?? undefined,
  });
}
