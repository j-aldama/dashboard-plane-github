'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '@/lib/api';

export type ProjectType = 'client' | 'support' | 'internal';

export interface ProjectListItem {
  id: number;
  name: string;
  identifier: string | null;
  project_type: ProjectType;
  is_archived: boolean;
}

export function useProjectsList() {
  return useQuery({
    queryKey: ['projects-settings'],
    queryFn: () => apiGet<ProjectListItem[]>('/projects'),
  });
}

export function useUpdateProjectType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, project_type }: { projectId: number; project_type: ProjectType }) =>
      apiPatch<ProjectListItem>(`/projects/${projectId}`, { project_type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects-settings'] });
      queryClient.invalidateQueries({ queryKey: ['projects-list'] });
      queryClient.invalidateQueries({ queryKey: ['projects-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['overview-metrics'] });
    },
  });
}
