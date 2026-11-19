import "server-only";
import type { z } from "zod";
import type { Asn, AsnSearchParams, City, CitySearchParams, Country, SearchResult } from "@/lib/api/contracts";
import { createCache } from "../cache";
import { traced } from "../telemetry";
import { bytefulGet, bytefulSearch, bytefulSearchAll } from "./client";
import { bytefulAsnSchema, bytefulAvailabilitySchema, bytefulCitySchema, bytefulCountrySchema } from "./schemas";

const MINUTE = 60_000;

// Locations rarely change, so lists are cached for longer. Node counts move all
// the time, so the availability count gets a short TTL.
const countryCache = createCache<Country[]>({ ttlMs: 60 * MINUTE });
const citySearchCache = createCache<SearchResult<City>>({ ttlMs: 15 * MINUTE });
const asnSearchCache = createCache<SearchResult<Asn>>({ ttlMs: 15 * MINUTE });
const cityCache = createCache<City | null>({ ttlMs: 60 * MINUTE });
const asnCache = createCache<Asn | null>({ ttlMs: 60 * MINUTE });
const availabilityCache = createCache<number>({ ttlMs: MINUTE });

// Byteful returns its own field names; we expose a smaller, stable shape.
const toCountry = (row: z.output<typeof bytefulCountrySchema>): Country => ({
  country_id: row.country_id,
  country_name: row.country_name,
  continent_id: row.continent_id,
  node_count: row.country_node_count,
});
const toCity = ({ city_node_count, ...row }: z.output<typeof bytefulCitySchema>): City => ({ ...row, node_count: city_node_count });
const toAsn = ({ asn_node_count, ...row }: z.output<typeof bytefulAsnSchema>): Asn => ({ ...row, node_count: asn_node_count });

/**
 * Cities have no country_id. Their subdivision IDs start with the country code
 * ("gb-sct"), so `like_subdivision_id=gb-%` selects the cities in a country.
 */
const inCountry = (countryId: string) => `${countryId}-%`;

/** Free text for a LIKE filter. `%` and `_` are wildcards there, so we strip them. */
const contains = (text?: string) => (text ? `%${text.replace(/[%_]/g, "")}%` : undefined);

/** All countries, busiest first (`sort_by` sorts descending). */
export function listCountries(): Promise<Country[]> {
  return traced("locations.countries", {}, () =>
    countryCache("all", async () => {
      const rows = await bytefulSearchAll("/country/search", { sort_by: "country_node_count" }, bytefulCountrySchema);
      return rows.map(toCountry);
    }),
  );
}

export function searchCities({ country_id, q, limit }: CitySearchParams): Promise<SearchResult<City>> {
  return traced("locations.search_cities", { "location.country_id": country_id, "search.query": q ?? "" }, () =>
    citySearchCache(JSON.stringify([country_id, q, limit]), async () => {
      const { rows, total } = await bytefulSearch(
        "/city/search",
        { like_subdivision_id: inCountry(country_id), like_city_name: contains(q), sort_by: "city_node_count", per_page: limit },
        bytefulCitySchema,
      );
      return { data: rows.map(toCity), total_count: total };
    }),
  );
}

export function searchAsns({ country_id, q, limit }: AsnSearchParams): Promise<SearchResult<Asn>> {
  // "AS5089" or "5089" looks up the number; anything else searches names.
  const asnNumber = q?.match(/^(?:as)?\s*(\d{1,10})$/i)?.[1];
  return traced("locations.search_asns", { "location.country_id": country_id ?? "", "search.query": q ?? "" }, () =>
    asnSearchCache(JSON.stringify([country_id, q, limit]), async () => {
      const { rows, total } = await bytefulSearch(
        "/asn/search",
        {
          country_id,
          asn_id: asnNumber,
          like_asn_name: asnNumber ? undefined : contains(q),
          sort_by: "asn_node_count",
          per_page: limit,
        },
        bytefulAsnSchema,
      );
      return { data: rows.map(toAsn), total_count: total };
    }),
  );
}

export function findCity(countryId: string, cityAlias: string): Promise<City | null> {
  return traced("locations.find_city", { "location.country_id": countryId, "location.city_alias": cityAlias }, () =>
    cityCache(`${countryId}/${cityAlias}`, async () => {
      const query = { city_alias: cityAlias, like_subdivision_id: inCountry(countryId), per_page: 1 };
      const { rows } = await bytefulSearch("/city/search", query, bytefulCitySchema);
      return rows[0] ? toCity(rows[0]) : null;
    }),
  );
}

export function findAsn(asnId: number): Promise<Asn | null> {
  return traced("locations.find_asn", { "location.asn_id": asnId }, () =>
    asnCache(String(asnId), async () => {
      const { rows } = await bytefulSearch("/asn/search", { asn_id: asnId, per_page: 1 }, bytefulAsnSchema);
      return rows[0] ? toAsn(rows[0]) : null;
    }),
  );
}

/** Online residential nodes that match the targeting. The availability API filters by city name, not alias. */
export function countAvailableNodes(filter: { country_id?: string; city_name?: string; asn_id?: number }): Promise<number> {
  return traced("locations.count_available", {}, () =>
    availabilityCache(JSON.stringify(filter), async () => {
      const { data } = await bytefulGet("/residential_availability/count", filter, bytefulAvailabilitySchema);
      return data.total_residential_availability_node_count;
    }),
  );
}
