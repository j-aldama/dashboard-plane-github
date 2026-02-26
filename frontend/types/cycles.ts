// ── Cycle list response ──────────────────────────────────────────────────────

export interface CycleInfo {
  cycle_id: string;
  cycle_name: string;
  project_name: string;
  start_date: string | null;
  end_date: string | null;
  tasks_assigned: number;
  tasks_completed: number;
  completion_rate: number;
  is_active: boolean;
}

export interface CyclesResponse {
  cycles: CycleInfo[];
  last_updated: string;
  is_cached: boolean;
}

// ── Cycle analysis response ──────────────────────────────────────────────────

export interface MemberCyclePerformance {
  member_id: string;
  name: string;
  avatar_url: string | null;
  points_completed: number;
  tasks_completed: number;
  tasks_assigned: number;
  max_task_complexity: number;
  avg_task_complexity: number;
}

export interface CycleAnalysisResponse {
  cycle_id: string;
  cycle_name: string;
  completion_rate: number;
  members: MemberCyclePerformance[];
  rankings: Record<string, string>;
  last_updated: string;
  is_cached: boolean;
}
