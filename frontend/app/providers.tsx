"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { DateRangeProvider } from "@/contexts/DateRangeContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DateRangeProvider>{children}</DateRangeProvider>
    </QueryClientProvider>
  );
}
