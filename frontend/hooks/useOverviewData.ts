'use client';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useFilters, buildApiParams } from '@/hooks/useFilters';

export interface OverviewMetrics {
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  total_points: number;
  completed_points: number;
  total_cycles: number;
  active_cycles: number;
  total_bugs: number;
}

export interface ProjectMetrics {
  id: number;
  name: string;
  identifier: string;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  total_points: number;
  completed_points: number;
  total_bugs: number;
  active_cycle: string | null;
  is_support: boolean;
}

export function useOverviewMetrics() {
  const { toQueryParams } = useFilters();
  const params = toQueryParams();
  return useQuery({
    queryKey: ['overview-metrics', params],
    queryFn: () => apiGet<OverviewMetrics>('/metrics/overview', buildApiParams({}, params)),
  });
}

export function useProjectsMetrics() {
  const { toQueryParams } = useFilters();
  const params = toQueryParams();
  return useQuery({
    queryKey: ['projects-metrics', params],
    queryFn: () => apiGet<{ projects: ProjectMetrics[] }>('/metrics/projects', buildApiParams({}, params)),
  });
}
