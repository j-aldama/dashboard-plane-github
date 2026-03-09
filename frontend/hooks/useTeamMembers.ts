import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '@/lib/api';

export interface TeamMember {
  id: number;
  name: string;
  email: string | null;
  plane_user_id: string;
  github_username: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

export interface GitHubOrgMember {
  login: string;
  avatar_url: string | null;
}

export function useTeamMembers() {
  return useQuery<TeamMember[]>({
    queryKey: ['team-members'],
    queryFn: () => apiGet<TeamMember[]>('/team-members'),
  });
}

export function useGitHubOrgMembers() {
  return useQuery<GitHubOrgMember[]>({
    queryKey: ['github-org-members'],
    queryFn: () => apiGet<GitHubOrgMember[]>('/github-org-members'),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useUpdateGithubUsername() {
  const queryClient = useQueryClient();
  return useMutation<TeamMember, Error, { memberId: number; github_username: string | null }>({
    mutationFn: ({ memberId, github_username }) =>
      apiPatch<TeamMember>(`/team-members/${memberId}`, { github_username }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    },
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation<TeamMember, Error, { memberId: number; is_active?: boolean; github_username?: string | null }>({
    mutationFn: ({ memberId, ...data }) =>
      apiPatch<TeamMember>(`/team-members/${memberId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    },
  });
}
