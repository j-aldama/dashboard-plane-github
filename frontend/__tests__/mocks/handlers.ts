import { http, HttpResponse } from 'msw';

export const mockOverviewMetrics = {
  total_tasks: 150,
  completed_tasks: 95,
  pending_tasks: 55,
  total_points: 300,
  completed_points: 180,
  total_cycles: 5,
  active_cycles: 2,
  total_bugs: 12,
};

export const mockProjectsMetrics = {
  projects: [
    {
      id: 1,
      name: 'Proyecto Alpha',
      identifier: 'ALPHA',
      total_tasks: 50,
      completed_tasks: 30,
      pending_tasks: 20,
      total_points: 100,
      completed_points: 60,
      total_bugs: 5,
      active_cycle: 'Sprint 3',
      is_support: false,
    },
    {
      id: 2,
      name: 'Proyecto Beta',
      identifier: 'BETA',
      total_tasks: 40,
      completed_tasks: 25,
      pending_tasks: 15,
      total_points: 80,
      completed_points: 50,
      total_bugs: 3,
      active_cycle: null,
      is_support: true,
    },
  ],
};

export const mockComparativeData = {
  members: [
    {
      id: 'user-1',
      name: 'Ana Garcia',
      avatar_url: null,
      github_username: 'anagarcia',
      tasks_completed: 25,
      points_completed: 50,
      avg_complexity: 3.2,
      active_workload: 8,
      overdue_tasks: 1,
      commits: 45,
      prs_merged: 12,
      lines_written: 3200,
      rankings: {
        tasks_completed: 1,
        points_completed: 1,
        commits: 2,
        prs_merged: 1,
      },
    },
    {
      id: 'user-2',
      name: 'Carlos Lopez',
      avatar_url: 'https://example.com/avatar.jpg',
      github_username: 'carloslopez',
      tasks_completed: 20,
      points_completed: 40,
      avg_complexity: 2.8,
      active_workload: 6,
      overdue_tasks: 0,
      commits: 50,
      prs_merged: 10,
      lines_written: 4100,
      rankings: {
        tasks_completed: 2,
        points_completed: 2,
        commits: 1,
        prs_merged: 2,
      },
    },
  ],
};

export const handlers = [
  http.get('/api/metrics/overview', () => {
    return HttpResponse.json(mockOverviewMetrics);
  }),

  http.get('/api/metrics/projects', () => {
    return HttpResponse.json(mockProjectsMetrics);
  }),

  http.get('/api/metrics/comparative', () => {
    return HttpResponse.json(mockComparativeData);
  }),
];
