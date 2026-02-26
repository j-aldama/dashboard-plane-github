import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { GithubMetricsSnapshot } from "@/types";
import { useDateRange } from "@/contexts/DateRangeContext";

// ── Hooks ──────────────────────────────────────────────────────────────────────

/**
 * Fetch GitHub metrics snapshots for a team member, filtered by date range.
 */
export function useGitHubMetricsForMember(memberId: number) {
  const { dateRange } = useDateRange();

  const from = dateRange.from.toISOString().slice(0, 10);
  const to = dateRange.to.toISOString().slice(0, 10);

  return useQuery<GithubMetricsSnapshot[]>({
    queryKey: ["github-metrics", "member", memberId, from, to],
    queryFn: () =>
      api.get<GithubMetricsSnapshot[]>(
        `/metrics/github/${memberId}?from=${from}&to=${to}`,
      ),
    staleTime: 4 * 60 * 1000,       // 4 minutes
    enabled: memberId > 0,
  });
}

/**
 * Fetch GitHub metrics for all members (team overview), filtered by date range.
 */
export function useGitHubMetricsOverview() {
  const { dateRange } = useDateRange();

  const from = dateRange.from.toISOString().slice(0, 10);
  const to = dateRange.to.toISOString().slice(0, 10);

  return useQuery<GithubMetricsSnapshot[]>({
    queryKey: ["github-metrics", "overview", from, to],
    queryFn: () =>
      api.get<GithubMetricsSnapshot[]>(
        `/metrics/github?from=${from}&to=${to}`,
      ),
    staleTime: 4 * 60 * 1000,
  });
}
