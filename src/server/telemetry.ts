import "server-only";
import { isSpanContextValid, SpanStatusCode, trace, type Attributes, type Span } from "@opentelemetry/api";

export const tracer = trace.getTracer("byteful-proxy-generator");

/** Runs `fn` inside a child span and marks the span as failed if it throws. */
export function traced<T>(name: string, attributes: Attributes, fn: (span: Span) => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn(span);
    } catch (error) {
      span.recordException(error instanceof Error ? error : String(error));
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : undefined });
      throw error;
    } finally {
      span.end();
    }
  });
}

/** The active trace ID. We return it as the request ID, so a user report leads straight to the trace. */
export function currentTraceId(): string | undefined {
  const context = trace.getActiveSpan()?.spanContext();
  return context && isSpanContextValid(context) ? context.traceId : undefined;
}
