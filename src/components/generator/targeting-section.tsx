"use client";

import { clsx } from "clsx";
import { Info } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { describeError } from "@/client/describe-error";
import { useAsnSearch, useCitySearch, useCountries } from "@/client/queries";
import { Combobox } from "@/components/ui/combobox";
import { Field } from "@/components/ui/field";
import type { Country } from "@/lib/api/contracts";
import { countryFlag, formatCompact, formatCount } from "@/lib/format";
import { PoolMeter } from "./pool-meter";
import { Section } from "./section";
import type { GeneratorForm } from "./use-generator-form";

// Names people type that differ from the ISO code.
const COUNTRY_ALIASES: Record<string, string> = { uk: "gb", usa: "us", america: "us", britain: "gb", england: "gb" };

/** Countries are already in the browser, so filtering them is instant. Name prefix matches come first. */
function filterCountries(countries: Country[], query: string): Country[] {
  const q = query.trim().toLowerCase();
  if (!q) return countries;
  const startsWith = (country: Country) => Number(country.country_name.toLowerCase().startsWith(q));
  return countries
    .filter((c) => c.country_name.toLowerCase().includes(q) || c.country_id === q || COUNTRY_ALIASES[q] === c.country_id)
    .sort((a, b) => startsWith(b) - startsWith(a));
}

const errorState = (query: { isError: boolean; error: unknown; refetch: () => unknown }) =>
  query.isError ? { message: describeError(query.error).title, onRetry: () => void query.refetch() } : null;

export function TargetingSection({ form }: { form: GeneratorForm }) {
  const { country, city, asn } = form.values;
  const [countryQuery, setCountryQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [asnQuery, setAsnQuery] = useState("");

  const countries = useCountries();
  const cities = useCitySearch(country?.country_id, cityQuery);
  const asns = useAsnSearch(country?.country_id, asnQuery);
  const countryOptions = useMemo(() => filterCountries(countries.data ?? [], countryQuery), [countries.data, countryQuery]);

  const countryError = form.errorFor("country_id");
  const cityError = form.errorFor("city_alias");
  const asnError = form.errorFor("asn_id");
  const hasTargeting = Boolean(country || city || asn);

  return (
    <Section
      step={3}
      title="Targeting"
      description="Optional. Narrow the exit IPs by location and network."
      action={
        hasTargeting && (
          <button
            type="button"
            onClick={() => {
              form.setCountry(null);
              form.set("asn", null);
            }}
            className="text-xs font-medium text-fg-subtle hover:text-fg"
          >
            Clear all
          </button>
        )
      }
    >
      <Field
        id="country_id"
        label="Country"
        error={countryError}
        hint={
          form.notice && (
            <span className="flex items-start gap-1.5 text-amber-700 dark:text-amber-300">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              {form.notice}
            </span>
          )
        }
      >
        <Combobox
          id="country_id"
          label="country"
          placeholder="Any country"
          value={country}
          onChange={form.setCountry}
          query={countryQuery}
          onQueryChange={setCountryQuery}
          options={countryOptions}
          getKey={(c) => c.country_id}
          getLabel={(c) => c.country_name}
          renderAdornment={(c) => <span className="text-base leading-none">{countryFlag(c.country_id)}</span>}
          renderOption={(c) => (
            <OptionRow leading={countryFlag(c.country_id)} title={c.country_name} detail={c.country_id.toUpperCase()} count={c.node_count} />
          )}
          loading={countries.isPending}
          error={errorState(countries)}
          emptyMessage={`No country matches "${countryQuery}".`}
          footer="Sorted by online IPs"
          invalid={Boolean(countryError)}
        />
      </Field>

      <Field id="city_alias" label="City" error={cityError} hint={country ? undefined : "Pick a country first to choose a city."}>
        <Combobox
          id="city_alias"
          label="city"
          placeholder={country ? `Any city in ${country.country_name}` : "Pick a country first"}
          disabled={!country}
          value={city}
          onChange={(value) => form.set("city", value)}
          query={cityQuery}
          onQueryChange={setCityQuery}
          options={cities.data?.data ?? []}
          getKey={(c) => c.city_id}
          getLabel={(c) => c.city_name}
          renderOption={(c) => <OptionRow title={c.city_name} detail={c.subdivision_id.toUpperCase()} count={c.node_count} />}
          loading={cities.isPending}
          fetching={cities.isFetching}
          error={errorState(cities)}
          emptyMessage={cityQuery ? `No city in ${country?.country_name} matches "${cityQuery}".` : "No cities found."}
          footer={
            cities.data &&
            `${formatCount(cities.data.data.length)} of ${formatCount(cities.data.total_count)} cities${
              cities.data.data.length < cities.data.total_count ? ". Type to search the rest." : "."
            }`
          }
          invalid={Boolean(cityError)}
        />
      </Field>

      <Field
        id="asn_id"
        label="ISP / ASN"
        error={asnError}
        hint="Search by name or number, like Vodafone or AS5089."
      >
        <Combobox
          id="asn_id"
          label="ASN"
          placeholder={country ? `Any network in ${country.country_name}` : "Any network, worldwide"}
          value={asn}
          onChange={(value) => form.set("asn", value)}
          query={asnQuery}
          onQueryChange={setAsnQuery}
          options={asns.data?.data ?? []}
          getKey={(a) => a.asn_id}
          getLabel={(a) => `${a.asn_name} (AS${a.asn_id})`}
          renderOption={(a) => (
            <OptionRow
              leading={!country && a.country_id ? countryFlag(a.country_id) : undefined}
              title={a.asn_name}
              detail={`AS${a.asn_id}${a.asn_type ? ` · ${a.asn_type}` : ""}`}
              count={a.node_count}
            />
          )}
          loading={asns.isPending}
          fetching={asns.isFetching}
          error={errorState(asns)}
          emptyMessage={asnQuery ? `No network matches "${asnQuery}".` : "No networks found."}
          footer={asns.data && `${formatCount(asns.data.data.length)} of ${formatCount(asns.data.total_count)} networks, busiest first.`}
          invalid={Boolean(asnError)}
        />
      </Field>

      <PoolMeter
        targeting={{ country_id: country?.country_id, city_alias: city?.city_alias, asn_id: asn?.asn_id }}
        listCount={Number(form.values.list_count)}
        sticky={form.values.list_session_type === "sticky"}
      />
    </Section>
  );
}

/** One option: optional flag, name, a detail line and the online node count. */
function OptionRow({ leading, title, detail, count }: { leading?: ReactNode; title: string; detail: string; count: number }) {
  return (
    <>
      {leading && <span className="text-base leading-none">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{title}</span>
        <span className="block truncate text-xs font-normal text-fg-subtle">{detail}</span>
      </span>
      <span
        title={`${formatCount(count)} online IPs`}
        className={clsx(
          "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
          count > 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-surface-muted text-fg-subtle",
        )}
      >
        {count > 0 ? formatCompact(count) : "offline"}
      </span>
    </>
  );
}
