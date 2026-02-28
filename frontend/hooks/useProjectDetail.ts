'use client';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useFilters, buildApiParams } from '@/hooks/useFilters';

export interface ActiveCycle {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  total_tasks: number;
  completed_tasks: number;
}

export interface CycleTask {
  id: number;
  title: string;
  state: string;
  assignee: string | null;
  priority: string | null;
  is_bug: boolean;
  is_client_blocker: boolean;
}

export interface LabelBreakdown {
  label: string;
  count: number;
}

export interface ProjectDetail {
  id: number;
  name: string;
  identifier: string;
  is_support: boolean;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  total_points: number;
  completed_points: number;
  total_bugs: number;
  total_client_blockers: number;
  active_cycle: ActiveCycle | null;
  cycle_tasks: CycleTask[];
  label_breakdown: LabelBreakdown[];
}

export function useProjectDetail(projectId: string) {
  const { toQueryParams } = useFilters();
  const params = toQueryParams();
  return useQuery({
    queryKey: ['project-detail', projectId, params],
    queryFn: () =>
      apiGet<ProjectDetail>(
        `/metrics/projects/${projectId}`,
        buildApiParams({}, params),
      ),
    enabled: Boolean(projectId),
  });
}
