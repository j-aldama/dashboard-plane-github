'use client';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useFilters, buildApiParams } from '@/hooks/useFilters';

// ---------------------------------------------------------------------------
// Types — overview
// ---------------------------------------------------------------------------

export interface GitHubOverview {
  total_commits: number;
  total_prs: number;
  prs_merged: number;
  lines_added: number;
  lines_removed: number;
}

// ---------------------------------------------------------------------------
// Types — activity (temporal)
// ---------------------------------------------------------------------------

export interface ActivityPoint {
  date: string;   // ISO date string, e.g. "2024-01-15"
  commits: number;
}

export interface GitHubActivity {
  activity: ActivityPoint[];
}

// ---------------------------------------------------------------------------
// Types — by repository
// ---------------------------------------------------------------------------

export interface RepoMetrics {
  repo: string;
  commits: number;
  pull_requests: number;
  lines_added: number;
  lines_removed: number;
}

export interface GitHubByRepo {
  repos: RepoMetrics[];
}

// ---------------------------------------------------------------------------
// Types — by user
// ---------------------------------------------------------------------------

export interface UserMetrics {
  user_id: string;
  display_name: string;
  github_username: string | null;
  commits: number;
  pull_requests: number;
  prs_merged: number;
  lines_added: number;
  lines_removed: number;
}

export interface GitHubByUser {
  users: UserMetrics[];
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useGitHubOverview() {
  const { toQueryParams } = useFilters();
  const params = toQueryParams();
  return useQuery({
    queryKey: ['github-overview', params],
    queryFn: () =>
      apiGet<GitHubOverview>('/metrics/github/overview', buildApiParams({}, params)),
  });
}

export function useGitHubActivity() {
  const { toQueryParams } = useFilters();
  const params = toQueryParams();
  return useQuery({
    queryKey: ['github-activity', params],
    queryFn: () =>
      apiGet<GitHubActivity>('/metrics/github/activity', buildApiParams({}, params)),
  });
}

export function useGitHubByRepo() {
  const { toQueryParams } = useFilters();
  const params = toQueryParams();
  return useQuery({
    queryKey: ['github-by-repo', params],
    queryFn: () =>
      apiGet<GitHubByRepo>('/metrics/github/by-repo', buildApiParams({}, params)),
  });
}

export function useGitHubByUser() {
  const { toQueryParams } = useFilters();
  const params = toQueryParams();
  return useQuery({
    queryKey: ['github-by-user', params],
    queryFn: () =>
      apiGet<GitHubByUser>('/metrics/github/by-user', buildApiParams({}, params)),
  });
}
