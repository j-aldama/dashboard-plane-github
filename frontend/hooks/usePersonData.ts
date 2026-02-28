'use client';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useFilters, buildApiParams } from '@/hooks/useFilters';

// ---------------------------------------------------------------------------
// Person metrics (Plane)
// ---------------------------------------------------------------------------

export interface PersonTask {
  id: number;
  title: string;
  project: string;
  state: string;
  points: number | null;
  cycle: string | null;
  is_bug: boolean;
}

export interface PersonMetrics {
  user_id: string;
  display_name: string;
  email: string | null;
  github_username: string | null;
  avatar_url: string | null;
  completed_tasks: number;
  completed_points: number;
  active_tasks: number;
  overdue_tasks: number;
  bug_tasks: number;
  assigned_tasks: PersonTask[];
}

// ---------------------------------------------------------------------------
// GitHub activity
// ---------------------------------------------------------------------------

export interface WeeklyActivity {
  week: string;
  commits: number;
}

export interface PersonPR {
  id: number;
  title: string;
  repo: string;
  state: string;
  merged_at: string | null;
  created_at: string;
  url: string | null;
}

export interface PersonGitHubActivity {
  user_id: string;
  github_username: string | null;
  commits: number;
  pull_requests: number;
  prs_merged: number;
  lines_added: number;
  lines_deleted: number;
  weekly_commits: WeeklyActivity[];
  recent_prs: PersonPR[];
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function usePersonMetrics(userId: string) {
  const { toQueryParams } = useFilters();
  const params = toQueryParams();
  return useQuery({
    queryKey: ['person-metrics', userId, params],
    queryFn: () =>
      apiGet<PersonMetrics>(
        `/metrics/comparative`,
        buildApiParams({ user_id: userId }, params),
      ),
    enabled: Boolean(userId),
  });
}

export function usePersonGitHubActivity(userId: string) {
  const { toQueryParams } = useFilters();
  const params = toQueryParams();
  return useQuery({
    queryKey: ['person-github-activity', userId, params],
    queryFn: () =>
      apiGet<PersonGitHubActivity>(
        `/metrics/github/activity`,
        buildApiParams({ user_id: userId }, params),
      ),
    enabled: Boolean(userId),
  });
}
