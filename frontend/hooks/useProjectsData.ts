import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ProjectsResponse } from "@/types/projects";
import { CyclesResponse } from "@/types/cycles";

/**
 * Fetch all Plane projects with status and progress.
 */
export function usePlaneProjects() {
  return useQuery<ProjectsResponse>({
    queryKey: ["plane", "projects"],
    queryFn: () => api.get<ProjectsResponse>("/api/plane/projects"),
  });
}

/**
 * Fetch all Plane cycles (sprints).
 * Re-exports the same endpoint as useCycles but scoped to the project view.
 */
export function usePlaneCycles() {
  return useQuery<CyclesResponse>({
    queryKey: ["plane", "cycles"],
    queryFn: () => api.get<CyclesResponse>("/api/plane/cycles"),
  });
}
