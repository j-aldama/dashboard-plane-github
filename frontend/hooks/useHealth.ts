import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

interface HealthStatus {
  status: string;
  timestamp: string;
  version?: string;
}

export function useHealth() {
  return useQuery<HealthStatus>({
    queryKey: ['health'],
    queryFn: () => apiGet<HealthStatus>('/health'),
    staleTime: 1000 * 30,  // 30 seconds
    retry: 1,
  });
}
