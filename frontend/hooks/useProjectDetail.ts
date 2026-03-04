'use client';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useFilters, buildApiParams } from '@/hooks/useFilters';

export interface LabelBreakdown {
  label: string;
  count: number;
}

export interface WorkItemSummary {
  id: number;
  plane_issue_id: string;
  title: string;
  state: string;
  priority: string | null;
  assignee_name: string | null;
}

export interface ProjectDetail {
  id: number;
  name: string;
  identifier: string;
  is_support: boolean;
  project_type: 'client' | 'support' | 'internal';
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  total_points: number;
  completed_points: number;
  total_bugs: number;
  active_cycle: string | null;
  is_archived: boolean;
  project_start_date: string | null;
  project_end_date: string | null;
  state_breakdown: { state: string; count: number }[];
  label_breakdown: LabelBreakdown[];
  bugs: WorkItemSummary[];
  client_blocked: WorkItemSummary[];
  pending_items: WorkItemSummary[];
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
