import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useDateRange } from "@/contexts/DateRangeContext";
import {
  PlaneTeamMetricsResponse,
  PlaneTeamMemberMetrics,
  GitHubTeamMetricsResponse,
  GitHubMemberMetrics,
  UnifiedMember,
} from "@/types/overview";

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetch aggregated team metrics from the Plane API.
 */
export function usePlaneTeamMetrics() {
  return useQuery<PlaneTeamMetricsResponse>({
    queryKey: ["plane", "team-metrics"],
    queryFn: () => api.get<PlaneTeamMetricsResponse>("/api/plane/team-metrics"),
    staleTime: 4 * 60 * 1000,
  });
}

/**
 * Fetch aggregated team metrics from the GitHub API, scoped to the current date range.
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build initials from a full name (e.g. "Ana Rodriguez" -> "AR").
 */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/**
 * Merge Plane and GitHub member data into a single unified list.
 *
 * Matching is done by `plane_member_id` on the GitHub side matching `member_id`
 * on the Plane side. Members without a match still appear in the result with
 * zeroed-out metrics for the unmatched source.
 */
export function mergeMembers(
  plane: PlaneTeamMemberMetrics[],
  github: GitHubMemberMetrics[],
): UnifiedMember[] {
  const ghByPlaneId = new Map<string, GitHubMemberMetrics>();
  const unmatchedGh: GitHubMemberMetrics[] = [];

  for (const g of github) {
    if (g.plane_member_id) {
      ghByPlaneId.set(g.plane_member_id, g);
    } else {
      unmatchedGh.push(g);
    }
  }

  const result: UnifiedMember[] = [];

  // Plane members first (primary source)
  for (const p of plane) {
    const gh = ghByPlaneId.get(p.member_id);
    result.push({
      id: p.member_id,
      name: p.name,
      avatar_url: p.avatar_url ?? gh?.avatar_url ?? null,
      initials: getInitials(p.name),
      story_points: p.story_points_completed,
      tasks_completed: p.tasks_completed,
      tasks_assigned: p.tasks_assigned,
      priority_avg: p.priority_avg,
      relative_effort: p.relative_effort,
      github_username: gh?.username ?? null,
      prs_open: gh?.prs_open ?? 0,
      prs_merged: gh?.prs_merged ?? 0,
      prs_rejected: gh?.prs_rejected ?? 0,
      commits: gh?.commits_total ?? 0,
      lines_added: gh?.lines_added ?? 0,
      lines_removed: gh?.lines_removed ?? 0,
      lines_net: gh?.lines_net ?? 0,
    });
  }

  // GitHub-only members (no Plane match)
  for (const g of unmatchedGh) {
    result.push({
      id: g.username,
      name: g.name ?? g.username,
      avatar_url: g.avatar_url,
      initials: getInitials(g.name ?? g.username),
      story_points: 0,
      tasks_completed: 0,
      tasks_assigned: 0,
      priority_avg: 0,
      relative_effort: 0,
      github_username: g.username,
      prs_open: g.prs_open,
      prs_merged: g.prs_merged,
      prs_rejected: g.prs_rejected,
      commits: g.commits_total,
      lines_added: g.lines_added,
      lines_removed: g.lines_removed,
      lines_net: g.lines_net,
    });
  }

  return result;
}
