# Byteful Proxy Generator

A Next.js app that builds residential proxy lists for Byteful's gateway. Pick a
proxy user, session type, protocol and quantity, optionally target a country,
city and ISP/ASN, and get ready-to-use proxy strings to copy or download.

- **`POST /api/residential/list`** builds the list in-process, mirroring Byteful's
  [Create Residential List](https://documentation.byteful.com/api-reference/residential/create-residential-list).
- **Lookup routes** proxy country, city and ASN search (and live node counts) from
  the Byteful API, with caching, retries and rate limiting. The API key never leaves the server.
- **The generator page** validates with the same Zod schema as the server, shows a
  live preview of the proxy username and the size of the matching IP pool, and supports
  presets, copy, `.txt` download, dark mode and keyboard submit (⌘/Ctrl + Enter).

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Zod 4,
TanStack Query 5, Headless UI, Motion + Flubber (morphing icons), OpenTelemetry
(`@vercel/otel`), Vitest.

---

## Run it

Needs Node.js 20 or later.

```bash
npm install
cp .env.example .env.local   # then fill in your two Byteful keys
npm run dev                  # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run build && npm start` | Production build and server |
| `npm test` | Unit and route tests (Vitest), no network needed |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |

### Environment variables

| Name | Required | Description |
|---|---|---|
| `BYTEFUL_PUBLIC_KEY` | yes | Public key from [dashboard.byteful.com/developer/api-key](https://dashboard.byteful.com/developer/api-key) |
| `BYTEFUL_PRIVATE_KEY` | yes | Private key from the same page |
| `BYTEFUL_API_URL` | no | Defaults to `https://api.byteful.com/1.0` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | no | Send traces over OTLP/HTTP, for example `http://localhost:4318` |

The keys are read on the first request, not at build time, so `npm run build` works
without them. A missing key returns a `configuration_error` that names it.

### Traces (optional)

```bash
docker compose up -d                                          # Jaeger
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 npm run dev
open http://localhost:16686                                   # service: byteful-proxy-generator
```

Every response carries an `x-request-id` header (and `request_id` in error bodies).
It is the OpenTelemetry trace ID, so a user's error report leads straight to its trace.

---

## API

### `POST /api/residential/list`

```bash
curl -X POST http://localhost:3000/api/residential/list \
  -d '{"proxy_user_id":"alice","proxy_user_password":"secretpass","list_count":2,"country_id":"gb","city_alias":"norwich"}'
```

```json
{
  "data": [
    "http://alice_c_gb_city_norwich_s_AD3EAXSD1WPYG0OG:secretpass@residential.byteful.com:8000",
    "http://alice_c_gb_city_norwich_s_7DYN9VSDWKIY7FGX:secretpass@residential.byteful.com:8000"
  ],
  "message": "Residential list successfully generated."
}
```

| Field | Type | Required | Default | Rules |
|---|---|---|---|---|
| `proxy_user_id` | string | yes | | Not blank, at most 128 characters |
| `proxy_user_password` | string | yes | | Not blank, at most 256 characters |
| `list_count` | integer | no | `100` | 1 to 1000 |
| `list_format` | string | no | `http` | `http`, `https`, `socks5`, `socks5h` |
| `list_session_type` | string | no | `sticky` | `sticky` or `rotating` |
| `country_id` | string | no | | ISO 3166-1 alpha-2, must be a country Byteful serves |
| `city_alias` | string | no | | `city_alias` from the city search; needs `country_id`; must be in that country |
| `asn_id` | integer | no | | Must exist; if `country_id` is set, the ASN must be registered in that country |

Sticky lists get a unique 16-character session ID per line (crypto RNG, no modulo
bias, uniqueness guaranteed with a `Set`). Rotating lists return `list_count`
identical lines.

### Lookup routes

| Route | Returns |
|---|---|
| `GET /api/locations/countries` | All countries with `node_count`, busiest first |
| `GET /api/locations/cities?country_id=gb&q=lon&limit=50` | Cities in one country, busiest first, plus `total_count` |
| `GET /api/locations/asns?country_id=gb&q=virgin` | ASNs (by name, or `q=AS5089` by number); `country_id` optional |
| `GET /api/residential/availability?country_id=gb&city_alias=manchester&asn_id=5089` | `{ "data": { "node_count": 1721 } }`, online nodes for that targeting |

Field names match the generator request (`country_id`, `city_alias`, `asn_id`), so a
lookup result can be sent straight back to the generator.

### Errors

Every error from every route has one shape:

```json
{
  "error": "invalid_parameter",
  "message": "list_count must be a whole number from 1 to 1000",
  "field": "list_count",
  "request_id": "5b8f2f4bf765b0ffb4e1c630c2a4e902"
}
```

`field` is present when the error is about one input. `request_id` is the trace ID.

| Status | `error` | When |
|---|---|---|
| 400 | `invalid_json` | The body is not valid JSON, or not a JSON object |
| 400 | `missing_parameter` | `proxy_user_id` or `proxy_user_password` is absent |
| 400 | `invalid_parameter` | Wrong type, out of range, unknown value, unknown field, or `city_alias` without `country_id`. Also bad lookup query params |
| 405 | `method_not_allowed` | Any method other than `POST` on `/api/residential/list` |
| 413 | `payload_too_large` | Body over 16 KB |
| 422 | `unknown_location` | The country, city or ASN does not exist in Byteful's data, or the ASN is in a different country |
| 429 | `rate_limited` | Byteful kept answering 429 after our retries. Sends `Retry-After` |
| 500 | `configuration_error` | A `BYTEFUL_*` variable is missing |
| 500 | `internal_error` | An unexpected bug. Quote the `request_id` |
| 502 | `upstream_auth_failed` | Byteful rejected the API key |
| 502 | `upstream_error` | Byteful returned an error, could not be reached, or sent data in an unexpected shape |
| 504 | `upstream_timeout` | Byteful did not answer within 8 seconds |

The browser client adds one more code of its own, `network_error`, for requests that
never get a response.

---

## How it is built

```
src/
├── app/                      Routes and the page shell (thin: parse → call → respond)
│   ├── api/residential/…     list (POST), availability (GET)
│   └── api/locations/…       countries, cities, asns (GET)
├── lib/                      Shared by browser and server, no I/O
│   ├── proxy/targeting.ts    Targeting registry + username builder
│   ├── proxy/schema.ts       Zod request schema (used by the route AND the form)
│   ├── proxy/generate.ts     Session IDs and list generation
│   └── api/                  Error codes + ApiError, response contracts
├── server/                   Server only (`import "server-only"`)
│   ├── byteful/client.ts     Byteful HTTP client: auth, timeout, retry, rate limit, Zod
│   ├── byteful/locations.ts  Country/city/ASN/availability lookups, cached
│   ├── residential.ts        Business rules: check targeting, then generate
│   ├── http.ts               Route wrapper: errors → JSON, request IDs, input parsing
│   └── cache.ts, rate-limiter.ts, telemetry.ts, log.ts, env.ts
├── client/                   Browser data layer: API client, React Query hooks, presets
└── components/               UI: generator sections, combobox, morphing icons
```

A request flows **route → business logic (`server/residential.ts`) → Byteful client**,
and the UI flows **component → React Query hook → `client/api.ts` → our route**. The
UI never calls `api.byteful.com`.

### Adding a targeting option (for example a US state or a zip code)

Targeting lives in one registry, `src/lib/proxy/targeting.ts`:

```ts
state: { tag: "st", label: "State", requires: "country_id", schema: z.string().regex(/^[a-z]{2}-[a-z0-9]+$/) },
```

That single entry adds the field to the request schema, the `requires` check, the
username builder (in registry order), the field labels and the error messages. The
compiler then points at what is left: a colour and caption in the username preview.
After that, add a lookup in `server/byteful/locations.ts`, a check in
`resolveTargeting`, a form value in `use-generator-form.ts` and a combobox in
`targeting-section.tsx`. The combobox, caching and error handling are already generic.

### Decisions and trade-offs

**One schema for client and server.** The form runs `residentialListRequestSchema` on
every change, so the page cannot send a request the endpoint would reject. Messages
are short predicates ("must be a whole number from 1 to 1000"). The API prefixes the
field name (`list_count …`) and the form prefixes the label (`Quantity …`).

**Targeting is checked against real data.** A typo like `city_alias: "londn"` returns
`422 unknown_location` instead of a list of dead proxies. A UK country with a US ASN
is rejected too: I checked, and the availability API reports 0 nodes for that
combination. The lookups are cached, so the check normally costs nothing.
*Trade-off:* generation now needs the Byteful API to be up when targeting is used.
If uptime mattered more than catching bad targeting, `resolveTargeting` could
fail open with a warning instead.

**Caching at three levels.** (1) The server has an in-memory TTL cache that also merges
concurrent identical calls into one request. Countries and lookups are kept 15–60
minutes; availability for 60 seconds, since node counts move. Failures are never
cached. (2) Lookup routes send `Cache-Control` so the browser and a CDN can reuse
them. (3) React Query keeps results per query key, and city and ASN searches are
debounced by 250 ms. The full country list (250 rows) is sent once and filtered
in the browser.
*Why not Next's `'use cache'`:* errors thrown inside it pass through React's
serializer, and production builds hide their messages, so typed upstream errors would
be lost. *Limit:* the cache is per instance. On serverless or several instances it
would move to Redis.

**Staying under Byteful's 20 req/s.** All upstream calls share a rolling-window limiter
(18/s), and 429/5xx/network failures retry with backoff, honouring `Retry-After`.
Timeouts are not retried, because the user has already waited 8 s.

**Resilient parsing.** Byteful responses are checked with Zod row by row. A malformed
row is logged and skipped rather than failing the whole lookup.

**Security.** Keys are read only in `server/env.ts`, which imports `server-only`, so
a client import fails the build. There is no `NEXT_PUBLIC_` variable. I checked that
neither key appears in `.next/static`, the served HTML or exported spans. Generated
lists are `Cache-Control: no-store`. Presets never store the password. Credentials are
percent-encoded in the URL, so a password with `@` or `:` still parses, and plain
values come out unchanged.

**Observability.** `@vercel/otel` traces each request. Custom spans cover
`residential.create_list` (count, format, session type, targeting; never
credentials), `locations.*` (with `cache.hit`) and `byteful GET <path>` (status code,
Byteful's `api_request_id`, retry events). Errors set `error.type` on the request
span. Logs are JSON lines carrying the same `trace_id`.

### Product details

- **Live username preview.** It shows each part of the username (`c_gb`, `city_…`,
  `asn_…`, `s_…`) colour-coded with its meaning, built by the same function the
  server uses.
- **Matching pool meter.** It shows online IPs for the current targeting. It warns
  when nothing is online ("remove the city or ASN to widen the pool"), and when a
  sticky list asks for more sessions than there are online IPs.
- **Each location shows its online node count**, and lists are sorted busiest first.
  Offline locations are labelled.
- **Changing the country** clears a city outside it, and an ASN registered elsewhere
  (with a note saying so). The city field stays disabled until a country is picked.
- **Errors say what to do next**, appear on the field they are about, and include a
  reference ID. A "settings changed" banner appears when the list on screen no longer
  matches the form.
- **Presets** in `localStorage`, versioned and Zod-checked on read, and synced
  across tabs.
- **Results:** click any line to copy it, copy all, download as
  `byteful-gb-london-sticky-http-100.txt`, hide passwords for screen sharing, and a
  ready `curl` command that tests the first proxy against ipinfo.io.
- **Motion with Flubber.** The generate icon morphs bolt → spinner → check/cross;
  copy and download morph to a check; the theme toggle morphs sun ↔ moon. Animations
  respect "reduce motion".

---

## Assumptions

- `country_id` and `city_alias` are trimmed and lower-cased, so `"GB"` works.
- `null` for an optional field means "not set".
- Unknown body fields are rejected (`invalid_parameter`) rather than silently ignored.
  A typo like `contry_id` would otherwise produce untargeted proxies.
- `asn_id` must be a JSON number; `"5089"` is rejected.
- The body is parsed as JSON whatever the `Content-Type`, so `curl -d` works without
  extra headers.
- Length limits on credentials (128 and 256) are sanity limits; the spec does not set any.
- The spec suggests `subdivision_id=gb%`, but that returns no cities. The API needs the
  `like_` operator: `like_subdivision_id=gb-%`. Every subdivision ID has the form
  `gb-xxx`, so the dash keeps the match exact. I checked all 9,547 cities.
- The availability endpoint filters by city *name*, not alias, so the server resolves
  the alias first.

## With more time

- Per-IP rate limiting on the lookup routes. Today anyone who can reach the app can
  spend the shared Byteful quota (the cache and limiter soften this).
- A shared cache (Redis or `'use cache: remote'`) for multi-instance deployments.
- Server-side presets per user and team, reusing the same Zod schema.
- US state and zip targeting, OS targeting and session TTL, through the registry.
- Server-render the country list into the page with React Query hydration, saving
  one round trip.
- Playwright end-to-end tests for the full page flow (the logic, the routes and the
  Byteful client are covered by Vitest).
- Virtualise the result list if lists grow well beyond 1,000 lines. At 1,000, a full
  relayout takes about 7 ms, so it isn't needed yet. (`content-visibility: auto` was
  tried and removed: its paint containment clipped long lines and broke horizontal
  scrolling.)
