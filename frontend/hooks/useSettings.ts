'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/lib/api';

export interface SyncSchedule {
  id: number;
  enabled: boolean;
  scheduled_time: string; // HH:MM
  timezone: string;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateSyncScheduleBody {
  enabled: boolean;
  scheduled_time: string;
  timezone: string;
}

export interface SyncLog {
  id: number;
  sync_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  records_synced: number | null;
}

export function useSyncSchedule() {
  return useQuery<SyncSchedule>({
    queryKey: ['sync-schedule'],
    queryFn: () => apiGet<SyncSchedule>('/sync/schedule'),
    retry: 1,
  });
}

export function useUpdateSyncSchedule() {
  const queryClient = useQueryClient();
  return useMutation<SyncSchedule, Error, UpdateSyncScheduleBody>({
    mutationFn: (body) => apiPut<SyncSchedule>('/sync/schedule', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-schedule'] });
    },
  });
}

export function useSyncHistory() {
  return useQuery<SyncLog[]>({
    queryKey: ['sync-history'],
    queryFn: () => apiGet<SyncLog[]>('/sync/all/history'),
    retry: 1,
  });
}
