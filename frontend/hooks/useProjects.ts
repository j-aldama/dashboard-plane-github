import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ProjectsResponse } from "@/types/projects";
import { CyclesResponse, CycleAnalysisResponse } from "@/types/cycles";

// ── Hooks ──────────────────────────────────────────────────────────────────────

/**
 * Fetch all projects from Plane API.
 */
export function useProjects() {
  return useQuery<ProjectsResponse>({
    queryKey: ["plane", "projects"],
    queryFn: () => api.get<ProjectsResponse>("/api/plane/projects"),
    staleTime: 4 * 60 * 1000,
  });
}

/**
 * Fetch all cycles, used to find current cycle for a given project.
 */
export function useProjectCycles() {
  return useQuery<CyclesResponse>({
    queryKey: ["plane", "cycles"],
    queryFn: () => api.get<CyclesResponse>("/api/plane/cycles"),
    staleTime: 4 * 60 * 1000,
  });
}

/**
 * Fetch cycle analysis for a specific cycle.
 */
export function useProjectCycleAnalysis(cycleId: string | null) {
  return useQuery<CycleAnalysisResponse>({
    queryKey: ["plane", "cycles", cycleId, "analysis"],
    queryFn: () =>
      api.get<CycleAnalysisResponse>(
        `/api/plane/cycles/${cycleId}/analysis`,
      ),
    enabled: !!cycleId,
    staleTime: 4 * 60 * 1000,
  });
}
