'use client';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useFilters, buildApiParams } from '@/hooks/useFilters';

export interface MemberComparative {
  id: string;
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
  rankings: Record<string, number>;
}

interface ComparativeResponse {
  members: MemberComparative[];
}

export function useComparative() {
  const { toQueryParams } = useFilters();
  const params = toQueryParams();
  return useQuery({
    queryKey: ['comparative', params],
    queryFn: () => apiGet<ComparativeResponse>('/metrics/comparative', buildApiParams({}, params)),
  });
}
