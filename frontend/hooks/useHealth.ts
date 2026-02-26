import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { HealthResponse } from "@/types";

export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: () => api.get<HealthResponse>("/health"),
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}
