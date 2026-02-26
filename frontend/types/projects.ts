// ── Projects API response types ──────────────────────────────────────────────

import { StatusColor, ProjectType } from "@/types";

export interface ProjectInfo {
  project_id: string;
  name: string;
  project_type: ProjectType | null;
  status: StatusColor | null;
  progress_pct: number | null;
  start_date: string | null;
  end_date: string | null;
  member_count: number;
}

export interface ProjectsResponse {
  projects: ProjectInfo[];
  last_updated: string;
  is_cached: boolean;
}

// ── Derived types for project view ──────────────────────────────────────────

export interface ProjectStatusSummary {
  total: number;
  green: number;
  yellow: number;
  red: number;
  blue: number;
}

export interface TaskDistribution {
  name: string;
  value: number;
  color: string;
}

export interface BurndownPoint {
  date: string;
  ideal: number;
  actual: number;
}

// ── Plane team member types (for person view) ───────────────────────────────

export interface PlaneMember {
  member_id: string;
  name: string;
  avatar_url: string | null;
  story_points_completed: number;
  tasks_completed: number;
  tasks_assigned: number;
  priority_avg: number;
  relative_effort: number;
}

export interface PlaneTeamResponse {
  members: PlaneMember[];
  total_story_points: number;
  total_tasks_completed: number;
  last_updated: string;
  is_cached: boolean;
}

// ── GitHub member types (for person view) ───────────────────────────────────

export interface GitHubMember {
  username: string;
  name: string | null;
  avatar_url: string | null;
  prs_open: number;
  prs_merged: number;
  prs_rejected: number;
  commits_total: number;
  lines_added: number;
  lines_removed: number;
  lines_net: number;
  team_member_id: number | null;
  plane_member_id: string | null;
}

export interface GitHubTeamResponse {
  members: GitHubMember[];
  rankings: Record<string, unknown>;
  last_updated: string;
  is_cached: boolean;
}

export interface GitHubMemberDetail extends GitHubMember {
  history: Record<string, unknown>[];
  last_updated: string;
  is_cached: boolean;
}
