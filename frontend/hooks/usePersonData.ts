import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useDateRange } from "@/contexts/DateRangeContext";
import {
  PlaneTeamResponse,
  GitHubTeamResponse,
  GitHubMemberDetail,
} from "@/types/projects";

/**
 * Fetch Plane team metrics (all members).
 */
export function usePlaneTeam() {
  return useQuery<PlaneTeamResponse>({
    queryKey: ["plane", "team-metrics"],
    queryFn: () => api.get<PlaneTeamResponse>("/api/plane/team-metrics"),
  });
}

/**
 * Fetch GitHub team metrics for the current date range.
 */
export function useGitHubTeam() {
  const { dateRange } = useDateRange();
  const from = dateRange.from.toISOString().slice(0, 10);
  const to = dateRange.to.toISOString().slice(0, 10);

  return useQuery<GitHubTeamResponse>({
    queryKey: ["github", "team-metrics", from, to],
    queryFn: () =>
      api.get<GitHubTeamResponse>(
        `/api/github/team-metrics?from=${from}&to=${to}`,
      ),
  });
}

/**
 * Fetch detailed GitHub metrics for a specific member, including history.
 */
export function useGitHubMemberDetail(username: string | null) {
  const { dateRange } = useDateRange();
  const from = dateRange.from.toISOString().slice(0, 10);
  const to = dateRange.to.toISOString().slice(0, 10);

  return useQuery<GitHubMemberDetail>({
    queryKey: ["github", "member", username, from, to],
    queryFn: () =>
      api.get<GitHubMemberDetail>(
        `/api/github/member/${username}/detail?from=${from}&to=${to}`,
      ),
    enabled: !!username,
  });
}
