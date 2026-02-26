import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useDateRange } from "@/contexts/DateRangeContext";
import {
  usePlaneTeamMetrics,
  useGitHubTeamMetrics,
  mergeMembers,
} from "@/hooks/useOverviewData";
import {
  PlaneProjectsResponse,
  GitHubTeamMetricsResponse,
  UnifiedMember,
  TeamKPIs,
  TrendDirection,
  TrendInfo,
} from "@/types/overview";

// ── Projects hook ───────────────────────────────────────────────────────────

export function usePlaneProjects() {
  return useQuery<PlaneProjectsResponse>({
    queryKey: ["plane", "projects"],
    queryFn: () =>
      api.get<PlaneProjectsResponse>("/api/plane/projects"),
    staleTime: 4 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

// ── Previous-period GitHub (for trend calculation) ──────────────────────────

function usePreviousGitHubTeamMetrics() {
  const { dateRange } = useDateRange();
  const rangeDays =
    Math.ceil(
      (dateRange.to.getTime() - dateRange.from.getTime()) /
        (1000 * 60 * 60 * 24),
    ) || 30;

  const prevTo = new Date(dateRange.from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - rangeDays);

  const from = prevFrom.toISOString().slice(0, 10);
  const to = prevTo.toISOString().slice(0, 10);

  return useQuery<GitHubTeamMetricsResponse>({
    queryKey: ["github", "team-metrics", "prev", from, to],
    queryFn: () =>
      api.get<GitHubTeamMetricsResponse>(
        `/api/github/team-metrics?from=${from}&to=${to}`,
      ),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

// ── Trend helpers ───────────────────────────────────────────────────────────

function computeTrend(current: number, previous: number): TrendInfo {
  if (previous === 0 && current === 0) {
    return { direction: "neutral", label: "sin cambio" };
  }
  if (previous === 0) {
    return { direction: "up", label: `+${current}` };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) {
    return { direction: "up", label: `+${pct}% vs anterior` };
  }
  if (pct < 0) {
    return { direction: "down", label: `${pct}% vs anterior` };
  }
  return { direction: "neutral", label: "sin cambio" };
}

/**
 * Determine per-member trend direction based on relative effort.
 * relative_effort > 1 means above-average contribution.
 */
export function memberTrendDirection(m: UnifiedMember): TrendDirection {
  if (m.relative_effort > 1.1) return "up";
  if (m.relative_effort < 0.9 && m.relative_effort > 0) return "down";
  return "neutral";
}

// ── Unified hook ────────────────────────────────────────────────────────────

export interface UseTeamOverviewResult {
  members: UnifiedMember[];
  kpis: TeamKPIs;
  trends: {
    tasks: TrendInfo;
    points: TrendInfo;
    prs: TrendInfo;
    projects: TrendInfo;
  };
  isLoading: boolean;
  isError: boolean;
}

export function useTeamOverview(): UseTeamOverviewResult {
  const planeQuery = usePlaneTeamMetrics();
  const githubQuery = useGitHubTeamMetrics();
  const projectsQuery = usePlaneProjects();
  const prevGithub = usePreviousGitHubTeamMetrics();

  const isLoading =
    planeQuery.isLoading || githubQuery.isLoading || projectsQuery.isLoading;
  const isError = planeQuery.isError && githubQuery.isError;

  const members = useMemo(() => {
    if (!planeQuery.data && !githubQuery.data) return [];
    return mergeMembers(
      planeQuery.data?.members ?? [],
      githubQuery.data?.members ?? [],
    ).sort((a, b) => b.story_points - a.story_points);
  }, [planeQuery.data, githubQuery.data]);

  // Compute KPIs
  const kpis = useMemo<TeamKPIs>(() => {
    const totalTasksCompleted =
      planeQuery.data?.total_tasks_completed ??
      members.reduce((s, m) => s + m.tasks_completed, 0);

    const totalStoryPoints =
      planeQuery.data?.total_story_points ??
      members.reduce((s, m) => s + m.story_points, 0);

    const avgStoryPoints =
      members.length > 0
        ? Math.round((totalStoryPoints / members.length) * 10) / 10
        : 0;

    const totalPrsMerged = members.reduce((s, m) => s + m.prs_merged, 0);

    const activeProjects =
      projectsQuery.data?.projects.filter((p) => p.status !== "red").length ??
      0;

    return { totalTasksCompleted, avgStoryPoints, totalPrsMerged, activeProjects };
  }, [planeQuery.data, projectsQuery.data, members]);

  // Compute trends
  const trends = useMemo(() => {
    const prevGithubPrs =
      prevGithub.data?.members.reduce((s, m) => s + m.prs_merged, 0) ?? 0;

    return {
      tasks: {
        direction: "neutral" as const,
        label: "periodo actual",
      },
      points: {
        direction: "neutral" as const,
        label: "periodo actual",
      },
      prs:
        prevGithubPrs > 0
          ? computeTrend(kpis.totalPrsMerged, prevGithubPrs)
          : { direction: "neutral" as const, label: "periodo actual" },
      projects: {
        direction: "neutral" as const,
        label: `${kpis.activeProjects} activos`,
      },
    };
  }, [prevGithub.data, kpis]);

  return { members, kpis, trends, isLoading, isError };
}
