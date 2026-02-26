import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CyclesResponse, CycleAnalysisResponse } from "@/types/cycles";

export function useCycles() {
  return useQuery<CyclesResponse>({
    queryKey: ["plane", "cycles"],
    queryFn: () => api.get<CyclesResponse>("/api/plane/cycles"),
  });
}

export function useCycleAnalysis(cycleId: string | null) {
  return useQuery<CycleAnalysisResponse>({
    queryKey: ["plane", "cycles", cycleId, "analysis"],
    queryFn: () =>
      api.get<CycleAnalysisResponse>(
        `/api/plane/cycles/${cycleId}/analysis`,
      ),
    enabled: !!cycleId,
  });
}
