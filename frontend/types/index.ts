// ── Health ────────────────────────────────────────────────────────────────────

export interface ServiceStatus {
  database: string;
  redis: string;
}

export interface HealthResponse {
  status: string;
  services: ServiceStatus;
  timestamp: string;
}

// ── Team members ──────────────────────────────────────────────────────────────

export interface TeamMember {
  id: number;
  name: string;
  email: string | null;
  plane_member_id: string | null;
  github_username: string | null;
  avatar_url: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
}

// ── Plane metrics ─────────────────────────────────────────────────────────────

export interface PlaneMetricsSnapshot {
  id: number;
  team_member_id: number;
  cycle_id: string | null;
  story_points_completed: number | null;
  tasks_completed: number | null;
  tasks_assigned: number | null;
  priority_avg: number | null;
  snapshot_date: string;
  created_at: string;
}

// ── GitHub metrics ────────────────────────────────────────────────────────────

export interface GithubMetricsSnapshot {
  id: number;
  team_member_id: number;
  prs_opened: number | null;
  prs_merged: number | null;
  prs_rejected: number | null;
  commits_count: number | null;
  lines_added: number | null;
  lines_deleted: number | null;
  period_start: string | null;
  period_end: string | null;
  snapshot_date: string;
  created_at: string;
}

// ── Project status ────────────────────────────────────────────────────────────

export type ProjectType = "dev" | "support";
export type StatusColor = "green" | "yellow" | "red" | "blue";

export interface ProjectStatusHistory {
  id: number;
  project_id: string;
  project_name: string;
  project_type: ProjectType | null;
  status: StatusColor | null;
  progress_pct: number | null;
  start_date: string | null;
  end_date: string | null;
  snapshot_date: string;
  created_at: string;
}

// ── Cycle snapshots ───────────────────────────────────────────────────────────

export interface CycleSnapshot {
  id: number;
  cycle_id: string;
  cycle_name: string | null;
  start_date: string | null;
  end_date: string | null;
  tasks_assigned: number | null;
  tasks_completed: number | null;
  completion_rate: number | null;
  is_active: boolean;
  snapshot_date: string;
  created_at: string;
}
