"use client";

import { useMemo, useState } from "react";
import type { Asn, City, Country } from "@/lib/api/contracts";
import type { ApiError } from "@/lib/api/errors";
import { capitalize } from "@/lib/format";
import {
  messagesByField,
  residentialListRequestSchema,
  type ListFormat,
  type RequestField,
  type ResidentialListInput,
  type ResidentialListRequest,
  type SessionType,
} from "@/lib/proxy/schema";
import { TARGETING } from "@/lib/proxy/targeting";
import type { PresetValues } from "@/client/presets";

export type GeneratorValues = {
  proxy_user_id: string;
  proxy_user_password: string;
  /** Raw input text, so a half-typed number is still editable. The schema validates it. */
  list_count: string;
  list_format: ListFormat;
  list_session_type: SessionType;
  // Targeting holds whole lookup objects so the fields can show names and node counts.
  country: Country | null;
  city: City | null;
  asn: Asn | null;
};

const INITIAL_VALUES: GeneratorValues = {
  proxy_user_id: "",
  proxy_user_password: "",
  list_count: "100",
  list_format: "http",
  list_session_type: "sticky",
  country: null,
  city: null,
  asn: null,
};

export const FIELD_LABELS: Record<RequestField, string> = {
  proxy_user_id: "Proxy user ID",
  proxy_user_password: "Password",
  list_count: "Quantity",
  list_format: "Protocol",
  list_session_type: "Session type",
  ...(Object.fromEntries(Object.entries(TARGETING).map(([field, { label }]) => [field, label])) as Record<
    keyof typeof TARGETING,
    string
  >),
};

/** Form state → request body. The same Zod schema then validates it here and on the server. */
export function toRequest(values: GeneratorValues): ResidentialListInput {
  const count = values.list_count.trim();
  return {
    proxy_user_id: values.proxy_user_id.trim(),
    proxy_user_password: values.proxy_user_password,
    list_count: count === "" ? Number.NaN : Number(count),
    list_format: values.list_format,
    list_session_type: values.list_session_type,
    country_id: values.country?.country_id,
    city_alias: values.city?.city_alias,
    asn_id: values.asn?.asn_id,
  };
}

/** "London was cleared…" or "London and Virgin Media were cleared…", naming what a country change dropped. */
function clearedNotice(names: string[], country: Country | null): string | null {
  if (names.length === 0) return null;
  const subject = names.join(" and ");
  // With no country, only the city can be dropped: the ASN does not depend on a country.
  if (!country) return `${subject} was cleared: a city needs a country.`;
  return names.length === 1
    ? `${subject} was cleared: it is not in ${country.country_name}.`
    : `${subject} were cleared: they are not in ${country.country_name}.`;
}

/** A server rejection, with the value it rejected so it can hide once that value changes. */
type ServerError = { field: RequestField; message: string; value: unknown };

export function useGeneratorForm() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [touched, setTouched] = useState<ReadonlySet<RequestField>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<ServerError | null>(null);
  // A one-line note when we change a field on the user's behalf.
  const [notice, setNotice] = useState<string | null>(null);

  const request = useMemo(() => toRequest(values), [values]);
  const validation = useMemo(() => residentialListRequestSchema.safeParse(request), [request]);
  const clientErrors = useMemo(() => (validation.success ? {} : messagesByField(validation.error.issues)), [validation]);

  /**
   * Errors show once a field is touched or the user tried to submit. A server error
   * shows while the field still holds the value the server rejected. Comparing request
   * values means form keys (`country`) never need mapping to request fields (`country_id`).
   */
  function errorFor(field: RequestField): string | undefined {
    if (serverError?.field === field && Object.is(request[field], serverError.value)) return serverError.message;
    const message = clientErrors[field];
    if (!message || !(submitted || touched.has(field))) return undefined;
    return capitalize(`${FIELD_LABELS[field]} ${message}`);
  }

  function set<K extends keyof GeneratorValues>(key: K, value: GeneratorValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }

  /** A new country drops a city outside it and an ASN registered elsewhere, and says so. */
  function setCountry(country: Country | null) {
    const { city, asn } = values;
    const keepCity = Boolean(city && country && city.subdivision_id.startsWith(`${country.country_id}-`));
    const keepAsn = Boolean(asn && (!country || asn.country_id === country.country_id));
    setValues((current) => ({ ...current, country, city: keepCity ? city : null, asn: keepAsn ? asn : null }));
    const cleared = [!keepCity && city?.city_name, !keepAsn && asn?.asn_name].filter((name): name is string => Boolean(name));
    setNotice(clearedNotice(cleared, country));
  }

  return {
    values,
    request,
    /** The validated request body, or null while the form has errors. */
    parsed: validation.success ? validation.data : null,
    /** First field with an error, in form order. Used to move focus there. */
    firstInvalidField: Object.keys(clientErrors)[0] as RequestField | undefined,
    notice,
    errorFor,
    set,
    setCountry,
    touch: (field: RequestField) => setTouched((current) => new Set(current).add(field)),

    /** Reveals every error. Returns the parsed request when it is valid. */
    submit() {
      setSubmitted(true);
      return validation.success ? validation.data : null;
    },

    /** Puts a server rejection on the field it is about, tied to the value that was sent. */
    applyServerError(error: ApiError, sent: ResidentialListRequest) {
      if (!error.field || !(error.field in FIELD_LABELS)) return;
      const field = error.field as RequestField;
      const message =
        error.code === "unknown_location"
          ? `${FIELD_LABELS[field]} is not available. Pick another one.`
          : capitalize(error.message);
      setServerError({ field, message, value: sent[field] });
    },

    applyPreset(preset: PresetValues) {
      setValues((current) => ({ ...current, ...preset }));
      setServerError(null);
      setNotice(null);
    },
  };
}

export type GeneratorForm = ReturnType<typeof useGeneratorForm>;
