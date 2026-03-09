import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export interface SyncStepStatus {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  records_synced: number | null;
  error: string | null;
}

export interface LastSyncInfo {
  id: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  error_count: number;
}

export interface SyncStatusResponse {
  is_running: boolean;
  progress: number;
  current_step: string | null;
  started_at: string | null;
  steps: SyncStepStatus[];
  last_sync: LastSyncInfo | null;
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ['sync-status'],
    queryFn: () => apiGet<SyncStatusResponse>('/sync/status'),
    refetchInterval: (query) => {
      return query.state.data?.is_running ? 2000 : 10000;
    },
  });
}
