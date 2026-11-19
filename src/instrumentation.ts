import { registerOTel } from "@vercel/otel";

/**
 * OpenTelemetry for the server. Next.js traces requests out of the box; our
 * code adds spans for Byteful calls, cache hits and list generation. Spans
 * export over OTLP when OTEL_EXPORTER_OTLP_ENDPOINT is set (see README).
 */
export function register() {
  registerOTel({ serviceName: "byteful-proxy-generator" });
}
