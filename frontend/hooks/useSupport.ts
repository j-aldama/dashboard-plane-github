'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '@/lib/api';

export interface SupportProject {
  id: number;
  name: string;
  identifier: string;
  support_start_date: string;
  support_end_date: string;
  days_remaining: number;
  total_support_days: number;
  is_active: boolean;
}

export interface SupportMetrics {
  active_support_projects: SupportProject[];
  expired_support_projects: SupportProject[];
  total_active: number;
  total_expired: number;
}

export interface ActivateSupportPayload {
  is_support: boolean;
  support_start_date?: string;
  support_end_date?: string;
}

export function useSupport() {
  return useQuery({
    queryKey: ['support-metrics'],
    queryFn: () => apiGet<SupportMetrics>('/metrics/support'),
  });
}

export function useActivateSupport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, payload }: { projectId: number; payload: ActivateSupportPayload }) =>
      apiPatch<SupportProject>(`/projects/${projectId}/support`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-metrics'] });
    },
  });
}
