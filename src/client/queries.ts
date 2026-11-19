import { useQuery } from "@tanstack/react-query";
import type { Targeting } from "@/lib/proxy/targeting";
import { api } from "./api";
import { useDebouncedValue } from "./use-debounced-value";

const SEARCH_DEBOUNCE_MS = 250;
const HOUR = 60 * 60_000;

/** One place for query keys, so prefetching and invalidation can't drift from the hooks. */
export const queryKeys = {
  countries: ["countries"] as const,
  cities: (countryId: string | undefined, q: string) => ["cities", countryId, q] as const,
  asns: (countryId: string | undefined, q: string) => ["asns", countryId ?? "any", q] as const,
  availability: ({ country_id, city_alias, asn_id }: Targeting) =>
    ["availability", country_id ?? null, city_alias ?? null, asn_id ?? null] as const,
};

/** All 250 countries arrive in one small response and are filtered in the browser. */
export function useCountries() {
  return useQuery({ queryKey: queryKeys.countries, queryFn: ({ signal }) => api.countries(signal), staleTime: HOUR });
}

/**
 * City search runs on the server (the US alone has ~1,000 cities). The query is
 * debounced, results are cached per (country, text), and the previous results
 * stay on screen while the next ones load, as long as the country is the same.
 */
export function useCitySearch(countryId: string | undefined, text: string) {
  const q = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  return useQuery({
    queryKey: queryKeys.cities(countryId, q),
    queryFn: ({ signal }) => api.cities({ country_id: countryId, q }, signal),
    enabled: Boolean(countryId),
    staleTime: 15 * 60_000,
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === countryId ? previous : undefined),
  });
}

/** ASN search, limited to the chosen country when there is one. */
export function useAsnSearch(countryId: string | undefined, text: string) {
  const q = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  return useQuery({
    queryKey: queryKeys.asns(countryId, q),
    queryFn: ({ signal }) => api.asns({ country_id: countryId, q }, signal),
    staleTime: 15 * 60_000,
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === (countryId ?? "any") ? previous : undefined),
  });
}

/** Online nodes for the current targeting. Node counts move, so this goes stale after a minute. */
export function useAvailability(targeting: Targeting) {
  return useQuery({
    queryKey: queryKeys.availability(targeting),
    queryFn: ({ signal }) => api.availability(targeting, signal),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}
