'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '@/lib/api';

export interface GitHubRepo {
  id: number;
  repo_name: string;
  is_active: boolean;
}

export function useGitHubRepos() {
  return useQuery<GitHubRepo[]>({
    queryKey: ['github-repos'],
    queryFn: () => apiGet<GitHubRepo[]>('/github-repos'),
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateGitHubRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ repoId, is_active }: { repoId: number; is_active: boolean }) =>
      apiPatch<GitHubRepo>(`/github-repos/${repoId}`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-repos'] });
      queryClient.invalidateQueries({ queryKey: ['github-overview'] });
      queryClient.invalidateQueries({ queryKey: ['github-by-repo'] });
      queryClient.invalidateQueries({ queryKey: ['github-by-user'] });
      queryClient.invalidateQueries({ queryKey: ['github-activity'] });
    },
  });
}
