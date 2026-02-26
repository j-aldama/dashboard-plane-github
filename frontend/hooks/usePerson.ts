import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useDateRange } from "@/contexts/DateRangeContext";
import {
  PlaneTeamMetricsResponse,
  GitHubTeamMetricsResponse,
} from "@/types/overview";
import { GitHubMemberDetailResponse } from "@/types/person";
import { CyclesResponse, CycleAnalysisResponse } from "@/types/cycles";

// ── Hooks ──────────────────────────────────────────────────────────────────────

/**
 * Fetch Plane team metrics (aggregated per member).
 */
export function usePlaneTeamMetrics() {
  return useQuery<PlaneTeamMetricsResponse>({
    queryKey: ["plane", "team-metrics"],
    queryFn: () =>
      api.get<PlaneTeamMetricsResponse>("/api/plane/team-metrics"),
    staleTime: 4 * 60 * 1000,
  });
}

/**
 * Fetch GitHub team metrics with date range.
 */
export function useGitHubTeamMetrics() {
  const { dateRange } = useDateRange();
  const from = dateRange.from.toISOString().slice(0, 10);
  const to = dateRange.to.toISOString().slice(0, 10);

  return useQuery<GitHubTeamMetricsResponse>({
    queryKey: ["github", "team-metrics", from, to],
    queryFn: () =>
      api.get<GitHubTeamMetricsResponse>(
        `/api/github/team-metrics?from=${from}&to=${to}`,
      ),
    staleTime: 4 * 60 * 1000,
  });
}

/**
 * Fetch GitHub member detail with snapshot history.
 */
export function useGitHubMemberDetail(username: string | null) {
  const { dateRange } = useDateRange();
  const from = dateRange.from.toISOString().slice(0, 10);
  const to = dateRange.to.toISOString().slice(0, 10);

  return useQuery<GitHubMemberDetailResponse>({
    queryKey: ["github", "member", username, "detail", from, to],
    queryFn: () =>
      api.get<GitHubMemberDetailResponse>(
        `/api/github/member/${username}/detail?from=${from}&to=${to}`,
      ),
    enabled: !!username,
    staleTime: 4 * 60 * 1000,
  });
}

/**
 * Fetch all cycles for member performance tracking.
 */
export function usePersonCycles() {
  return useQuery<CyclesResponse>({
    queryKey: ["plane", "cycles"],
    queryFn: () => api.get<CyclesResponse>("/api/plane/cycles"),
    staleTime: 4 * 60 * 1000,
  });
}

/**
 * Fetch cycle analysis for a specific cycle (reused for member performance).
 */
export function usePersonCycleAnalysis(cycleId: string | null) {
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
