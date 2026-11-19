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

const TARGETING_KEYS = { country: "country_id", city: "city_alias", asn: "asn_id" } as const;
const requestFieldOf = (key: keyof GeneratorValues): RequestField =>
  key in TARGETING_KEYS ? TARGETING_KEYS[key as keyof typeof TARGETING_KEYS] : (key as RequestField);

export function useGeneratorForm() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [touched, setTouched] = useState<ReadonlySet<RequestField>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Partial<Record<string, string>>>({});
  // A one-line note when we change a field on the user's behalf.
  const [notice, setNotice] = useState<string | null>(null);

  const request = useMemo(() => toRequest(values), [values]);
  const validation = useMemo(() => residentialListRequestSchema.safeParse(request), [request]);
  const clientErrors = useMemo(() => (validation.success ? {} : messagesByField(validation.error.issues)), [validation]);

  const clearServerErrors = (...fields: RequestField[]) =>
    setServerErrors((errors) => (fields.some((field) => field in errors) ? {} : errors));

  /** Errors show once a field is touched or the user tried to submit. Server errors always show. */
  function errorFor(field: RequestField): string | undefined {
    if (serverErrors[field]) return serverErrors[field];
    const message = clientErrors[field];
    if (!message || !(submitted || touched.has(field))) return undefined;
    return capitalize(`${FIELD_LABELS[field]} ${message}`);
  }

  function set<K extends keyof GeneratorValues>(key: K, value: GeneratorValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    clearServerErrors(requestFieldOf(key));
    setNotice(null);
  }

  /** A new country drops a city outside it and an ASN registered elsewhere, and says so. */
  function setCountry(country: Country | null) {
    const { city, asn } = values;
    const keepCity = Boolean(city && country && city.subdivision_id.startsWith(`${country.country_id}-`));
    const keepAsn = Boolean(asn && (!country || asn.country_id === country.country_id));
    setValues((current) => ({ ...current, country, city: keepCity ? city : null, asn: keepAsn ? asn : null }));
    clearServerErrors("country_id", "city_alias", "asn_id");
    setNotice(asn && !keepAsn && country ? `${asn.asn_name} was cleared: it is not in ${country.country_name}.` : null);
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

    /** Puts a server rejection on the field it is about. */
    applyServerError(error: ApiError) {
      if (!error.field) return;
      const message =
        error.code === "unknown_location"
          ? `${FIELD_LABELS[error.field as RequestField] ?? error.field} is not available. Pick another one.`
          : capitalize(error.message);
      setServerErrors({ [error.field]: message });
    },

    presetValues: (): PresetValues => ({
      list_count: values.list_count,
      list_format: values.list_format,
      list_session_type: values.list_session_type,
      country: values.country,
      city: values.city,
      asn: values.asn,
    }),

    applyPreset(preset: PresetValues) {
      setValues((current) => ({ ...current, ...preset }));
      setServerErrors({});
      setNotice(null);
    },
  };
}

export type GeneratorForm = ReturnType<typeof useGeneratorForm>;
