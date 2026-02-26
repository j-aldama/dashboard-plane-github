import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4 minutes stale time — data refetches after 4 min of being stale
      staleTime: 4 * 60 * 1000,
      // Retry failed requests up to 2 times with exponential back-off
      retry: 2,
      // Manual refresh only — no auto-refetch
      refetchOnWindowFocus: false,
    },
  },
});
