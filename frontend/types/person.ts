// ── Person view types ────────────────────────────────────────────────────────

export interface PersonProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  initials: string;
  role: string | null;
  github_username: string | null;
}

// ── GitHub member detail response ────────────────────────────────────────────

export interface GitHubSnapshotHistory {
  snapshot_date: string;
  prs_opened: number;
  prs_merged: number;
  commits_count: number;
  lines_added: number;
  lines_removed: number;
}

export interface GitHubMemberDetailResponse {
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
  snapshot_history: GitHubSnapshotHistory[];
}

// ── Chart data types ─────────────────────────────────────────────────────────

export interface PointsPerCycle {
  cycle: string;
  points: number;
}

export interface PrsByState {
  label: string;
  open: number;
  merged: number;
  rejected: number;
}

export interface CommitsPerWeek {
  week: string;
  commits: number;
}

export interface TasksByPriority {
  name: string;
  value: number;
  color: string;
}
