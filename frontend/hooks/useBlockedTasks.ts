import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export interface BlockedTask {
  id: number;
  title: string;
  project_name: string;
  project_identifier: string | null;
  assignee_name: string | null;
  state: string | null;
  priority: string | null;
  labels: string[];
  plane_issue_id: string;
}

export interface BlockedTasksResponse {
  count: number;
  tasks: BlockedTask[];
}

export interface IssueComment {
  actor_name: string;
  body: string;
  created_at: string;
}

export interface IssueCommentsResponse {
  comments: IssueComment[];
}

export function useBlockedTasks() {
  return useQuery({
    queryKey: ['blocked-tasks'],
    queryFn: () => apiGet<BlockedTasksResponse>('/blocked-tasks'),
    refetchInterval: 60000,
  });
}

export function useWorkItemComments(workItemId: number | null) {
  return useQuery({
    queryKey: ['work-item-comments', workItemId],
    queryFn: () => apiGet<IssueCommentsResponse>(`/work-items/${workItemId}/comments`),
    enabled: workItemId !== null,
  });
}
