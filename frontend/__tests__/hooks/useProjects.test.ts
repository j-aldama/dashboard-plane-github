import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Data fixtures
// ---------------------------------------------------------------------------
const mockProjectsResponse = {
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
      project_type: 'client' as const,
      is_archived: false,
      project_start_date: '2024-01-01',
      project_end_date: '2024-12-31',
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
      project_type: 'support' as const,
      is_archived: true,
      project_start_date: null,
      project_end_date: null,
    },
  ],
};

// ---------------------------------------------------------------------------
// Mocks — must be declared before the import under test
// ---------------------------------------------------------------------------
vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(() => Promise.resolve(mockProjectsResponse)),
}));

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
  buildApiParams: (
    extra: Record<string, string>,
    filters: Record<string, string>,
  ) => ({ ...filters, ...extra }),
}));

import { useProjects } from '@/hooks/useProjects';

// ---------------------------------------------------------------------------
// Test wrapper
// ---------------------------------------------------------------------------
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useProjects', () => {
  it('empieza en estado loading con data undefined', () => {
    const { result } = renderHook(() => useProjects(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('devuelve la lista de proyectos despues del fetch', async () => {
    const { result } = renderHook(() => useProjects(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.projects).toHaveLength(2);
  });

  it('mapea correctamente los campos del primer proyecto', async () => {
    const { result } = renderHook(() => useProjects(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const project = result.current.data!.projects[0];
    expect(project.id).toBe(1);
    expect(project.name).toBe('Proyecto Alpha');
    expect(project.identifier).toBe('ALPHA');
    expect(project.total_tasks).toBe(50);
    expect(project.completed_tasks).toBe(30);
    expect(project.pending_tasks).toBe(20);
    expect(project.total_points).toBe(100);
    expect(project.completed_points).toBe(60);
    expect(project.total_bugs).toBe(5);
    expect(project.active_cycle).toBe('Sprint 3');
    expect(project.is_support).toBe(false);
    expect(project.project_type).toBe('client');
    expect(project.is_archived).toBe(false);
    expect(project.project_start_date).toBe('2024-01-01');
    expect(project.project_end_date).toBe('2024-12-31');
  });

  it('maneja proyectos archivados y con active_cycle nulo', async () => {
    const { result } = renderHook(() => useProjects(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const project = result.current.data!.projects[1];
    expect(project.is_archived).toBe(true);
    expect(project.active_cycle).toBeNull();
    expect(project.project_type).toBe('support');
    expect(project.project_start_date).toBeNull();
    expect(project.project_end_date).toBeNull();
  });

  it('refleja el resultado completo de la API', async () => {
    const { result } = renderHook(() => useProjects(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockProjectsResponse);
  });

  it('propaga el error cuando la API falla', async () => {
    const { apiGet } = await import('@/lib/api');
    vi.mocked(apiGet).mockRejectedValueOnce(new Error('Error del servidor'));

    const { result } = renderHook(() => useProjects(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('Error del servidor');
  });
});
