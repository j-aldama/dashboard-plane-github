// ── Plane API response types ─────────────────────────────────────────────────

export interface PlaneTeamMemberMetrics {
  member_id: string;
  name: string;
  avatar_url: string | null;
  story_points_completed: number;
  tasks_completed: number;
  tasks_assigned: number;
  priority_avg: number;
  relative_effort: number;
}

export interface PlaneTeamMetricsResponse {
  members: PlaneTeamMemberMetrics[];
  total_story_points: number;
  total_tasks_completed: number;
  last_updated: string;
  is_cached: boolean;
}

// ── Plane projects API response ─────────────────────────────────────────────

export interface PlaneProject {
  project_id: string;
  name: string;
  project_type: string;
  status: string;
  progress_pct: number;
  start_date: string | null;
  end_date: string | null;
  member_count: number;
}

export interface PlaneProjectsResponse {
  projects: PlaneProject[];
  last_updated: string;
  is_cached: boolean;
}

// ── GitHub API response types ────────────────────────────────────────────────

export interface GitHubMemberMetrics {
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

export interface RankingEntry {
  username: string;
  value: number;
}

export interface Rankings {
  by_prs_merged: RankingEntry[];
  by_commits: RankingEntry[];
  by_lines_net: RankingEntry[];
}

export interface GitHubTeamMetricsResponse {
  members: GitHubMemberMetrics[];
  rankings: Rankings;
  period_start: string | null;
  period_end: string | null;
  last_updated: string;
  is_cached: boolean;
}

// ── Unified member (Plane + GitHub merged) ───────────────────────────────────

export interface UnifiedMember {
  id: string;
  name: string;
  avatar_url: string | null;
  initials: string;
  // Plane metrics
  story_points: number;
  tasks_completed: number;
  tasks_assigned: number;
  priority_avg: number;
  relative_effort: number;
  // GitHub metrics
  github_username: string | null;
  prs_open: number;
  prs_merged: number;
  prs_rejected: number;
  commits: number;
  lines_added: number;
  lines_removed: number;
  lines_net: number;
}

// ── Aggregated KPIs ─────────────────────────────────────────────────────────

export interface TeamKPIs {
  totalTasksCompleted: number;
  avgStoryPoints: number;
  totalPrsMerged: number;
  activeProjects: number;
}

// ── Trend helpers ───────────────────────────────────────────────────────────

export type TrendDirection = "up" | "down" | "neutral";

export interface TrendInfo {
  direction: TrendDirection;
  label: string;
}

// ── Radar chart data point ──────────────────────────────────────────────────

export interface RadarDataPoint {
  metric: string;
  fullMark: number;
  [memberKey: string]: string | number;
}

// ── Bar chart grouped data point ────────────────────────────────────────────

export interface GroupedBarDataPoint {
  metric: string;
  [memberKey: string]: string | number;
}
