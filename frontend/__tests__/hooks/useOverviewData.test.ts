import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockOverviewMetrics = {
  total_tasks: 150,
  completed_tasks: 95,
  pending_tasks: 55,
  total_points: 300,
  completed_points: 180,
  total_cycles: 5,
  active_cycles: 2,
  total_bugs: 12,
};

const mockProjectsMetrics = {
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

// Mock the api module
vi.mock('@/lib/api', () => ({
  apiGet: vi.fn((path: string) => {
    if (path === '/metrics/overview') {
      return Promise.resolve(mockOverviewMetrics);
    }
    if (path === '/metrics/projects') {
      return Promise.resolve(mockProjectsMetrics);
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

import { useOverviewMetrics, useProjectsMetrics } from '@/hooks/useOverviewData';

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

describe('useOverviewMetrics', () => {
  it('devuelve datos de metricas generales despues del fetch', async () => {
    const { result } = renderHook(() => useOverviewMetrics(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockOverviewMetrics);
    expect(result.current.data?.total_tasks).toBe(150);
    expect(result.current.data?.completed_tasks).toBe(95);
    expect(result.current.data?.pending_tasks).toBe(55);
    expect(result.current.data?.total_points).toBe(300);
    expect(result.current.data?.completed_points).toBe(180);
    expect(result.current.data?.total_cycles).toBe(5);
    expect(result.current.data?.active_cycles).toBe(2);
    expect(result.current.data?.total_bugs).toBe(12);
  });

  it('empieza en estado loading', () => {
    const { result } = renderHook(() => useOverviewMetrics(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useProjectsMetrics', () => {
  it('devuelve datos de proyectos despues del fetch', async () => {
    const { result } = renderHook(() => useProjectsMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.projects).toHaveLength(2);
    expect(result.current.data?.projects[0].name).toBe('Proyecto Alpha');
    expect(result.current.data?.projects[0].identifier).toBe('ALPHA');
    expect(result.current.data?.projects[0].total_tasks).toBe(50);
    expect(result.current.data?.projects[0].completed_tasks).toBe(30);
    expect(result.current.data?.projects[1].name).toBe('Proyecto Beta');
    expect(result.current.data?.projects[1].is_support).toBe(true);
  });

  it('empieza en estado loading', () => {
    const { result } = renderHook(() => useProjectsMetrics(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});
