'use client';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useFilters, buildApiParams } from '@/hooks/useFilters';

export interface ProjectItem {
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
  project_type: 'client' | 'support' | 'internal';
  is_archived: boolean;
  project_start_date: string | null;
  project_end_date: string | null;
}

export function useProjects() {
  const { toQueryParams } = useFilters();
  const params = toQueryParams();
  return useQuery({
    queryKey: ['projects-list', params],
    queryFn: () => apiGet<{ projects: ProjectItem[] }>('/metrics/projects', buildApiParams({}, params)),
  });
}
