import "server-only";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";

// No NEXT_PUBLIC_ prefix: these never reach the browser bundle. The
// `server-only` import above makes any client import of this file a build error.
const envSchema = z.object({
  BYTEFUL_PUBLIC_KEY: z.string().min(1),
  BYTEFUL_PRIVATE_KEY: z.string().min(1),
  BYTEFUL_API_URL: z.url().default("https://api.byteful.com/1.0"),
});

let env: z.infer<typeof envSchema> | undefined;

/** Read on first use, so `next build` works without keys and a missing key fails with a clear error. */
export function serverEnv() {
  if (env) return env;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new ApiError(
      "configuration_error",
      `The server is missing configuration: ${missing}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return (env = parsed.data);
}
