import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockComparativeData = {
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

// Mock the api module
vi.mock('@/lib/api', () => ({
  apiGet: vi.fn((path: string) => {
    if (path === '/metrics/comparative') {
      return Promise.resolve(mockComparativeData);
    }
    return Promise.reject(new Error(`Unmocked path: ${path}`));
  }),
}));

// Mock the useFilters hook to avoid needing FilterProvider/Next.js router
vi.mock('@/hooks/useFilters', () => ({
  useFilters: () => ({
    dateFrom: null,
    dateTo: null,
    projectIds: [],
    userIds: [],
    cycleId: null,
    toQueryParams: () => ({}),
    activeFilterCount: 0,
    setDateRange: vi.fn(),
    setProjects: vi.fn(),
    setUsers: vi.fn(),
    setCycle: vi.fn(),
    clearFilters: vi.fn(),
  }),
  buildApiParams: (extra: Record<string, string>, filters: Record<string, string>) => ({
    ...filters,
    ...extra,
  }),
}));

import { useComparative } from '@/hooks/useComparative';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useComparative', () => {
  it('devuelve datos comparativos despues del fetch', async () => {
    const { result } = renderHook(() => useComparative(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.members).toHaveLength(2);
  });

  it('devuelve miembros con sus metricas', async () => {
    const { result } = renderHook(() => useComparative(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const members = result.current.data?.members;
    expect(members).toBeDefined();

    const ana = members![0];
    expect(ana.name).toBe('Ana Garcia');
    expect(ana.tasks_completed).toBe(25);
    expect(ana.points_completed).toBe(50);
    expect(ana.commits).toBe(45);
    expect(ana.prs_merged).toBe(12);
    expect(ana.github_username).toBe('anagarcia');

    const carlos = members![1];
    expect(carlos.name).toBe('Carlos Lopez');
    expect(carlos.tasks_completed).toBe(20);
    expect(carlos.commits).toBe(50);
    expect(carlos.lines_written).toBe(4100);
  });

  it('devuelve rankings por miembro', async () => {
    const { result } = renderHook(() => useComparative(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const ana = result.current.data?.members[0];
    expect(ana?.rankings.tasks_completed).toBe(1);
    expect(ana?.rankings.prs_merged).toBe(1);

    const carlos = result.current.data?.members[1];
    expect(carlos?.rankings.commits).toBe(1);
    expect(carlos?.rankings.tasks_completed).toBe(2);
  });

  it('empieza en estado loading', () => {
    const { result } = renderHook(() => useComparative(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('respeta la estructura de la respuesta', async () => {
    const { result } = renderHook(() => useComparative(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockComparativeData);
  });
});
