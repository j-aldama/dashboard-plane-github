'use client';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useFilters, buildApiParams } from '@/hooks/useFilters';

export interface CycleItem {
  id: string;
  name: string;
  project_name: string;
  project_id: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  total_points: number;
  completed_points: number;
}

export interface CyclesResponse {
  cycles: CycleItem[];
}

export function useCycles(extraParams?: Record<string, string>) {
  const { toQueryParams } = useFilters();
  const filterParams = toQueryParams();
  const params = buildApiParams(extraParams ?? {}, filterParams);

  return useQuery({
    queryKey: ['cycles-list', params],
    queryFn: () => apiGet<CyclesResponse>('/metrics/cycles', params),
  });
}
