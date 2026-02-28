'use client';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useFilters, buildApiParams } from '@/hooks/useFilters';

export interface MemberRankings {
  tasks_completed: number;
  points_completed: number;
  avg_complexity: number;
  active_workload: number;
  overdue_tasks: number;
  commits: number;
  prs_merged: number;
  lines_written: number;
}

export interface PersonItem {
  id: number;
  name: string;
  avatar_url: string | null;
  github_username: string | null;
  tasks_completed: number;
  points_completed: number;
  avg_complexity: number;
  active_workload: number;
  overdue_tasks: number;
  commits: number;
  prs_merged: number;
  lines_written: number;
  rankings: MemberRankings;
}

export interface PersonListResponse {
  members: PersonItem[];
}

export function usePersonList() {
  const { toQueryParams } = useFilters();
  const params = toQueryParams();
  return useQuery({
    queryKey: ['person-list', params],
    queryFn: () =>
      apiGet<PersonListResponse>('/metrics/comparative', buildApiParams({}, params)),
  });
}
