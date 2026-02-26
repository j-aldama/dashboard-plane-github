import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5 minute stale time — matches backend CACHE_TTL default
      staleTime: 5 * 60 * 1000,
      // Retry failed requests up to 2 times
      retry: 2,
      // Refetch on window focus for dashboard freshness
      refetchOnWindowFocus: true,
    },
  },
});
