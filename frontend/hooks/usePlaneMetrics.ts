import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PlaneMetricsSnapshot } from "@/types";
import { useDateRange } from "@/contexts/DateRangeContext";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TeamSummary {
  total_tasks: number;
  total_story_points: number;
  avg_story_points: number;
  member_count: number;
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

/**
 * Fetch Plane metrics snapshots for a team member, filtered by date range.
 */
export function usePlaneMetricsForMember(memberId: number) {
  const { dateRange } = useDateRange();

  const from = dateRange.from.toISOString().slice(0, 10);
  const to = dateRange.to.toISOString().slice(0, 10);

  return useQuery<PlaneMetricsSnapshot[]>({
    queryKey: ["plane-metrics", "member", memberId, from, to],
    queryFn: () =>
      api.get<PlaneMetricsSnapshot[]>(
        `/metrics/plane/${memberId}?from=${from}&to=${to}`,
      ),
    staleTime: 4 * 60 * 1000,       // 4 minutes
    enabled: memberId > 0,
  });
}

/**
 * Fetch Plane metrics for all members (team overview), filtered by date range.
 */
export function usePlaneMetricsOverview() {
  const { dateRange } = useDateRange();

  const from = dateRange.from.toISOString().slice(0, 10);
  const to = dateRange.to.toISOString().slice(0, 10);

  return useQuery<PlaneMetricsSnapshot[]>({
    queryKey: ["plane-metrics", "overview", from, to],
    queryFn: () =>
      api.get<PlaneMetricsSnapshot[]>(
        `/metrics/plane?from=${from}&to=${to}`,
      ),
    staleTime: 4 * 60 * 1000,
  });
}
