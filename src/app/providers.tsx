"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { MotionConfig } from "motion/react";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api/errors";

/** Retry what can recover by itself (network, 5xx, rate limits), never a request the server rejected. */
function shouldRetry(failureCount: number, error: Error) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.code !== "rate_limited") return false;
  return failureCount < 2;
}

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser tab; useState keeps it across re-renders.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: shouldRetry, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* Honour the OS "reduce motion" setting in every animation. */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
