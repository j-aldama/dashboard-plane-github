import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Data fixtures
// ---------------------------------------------------------------------------
const mockProjectDetail = {
  id: 42,
  name: 'Proyecto Detalle',
  identifier: 'DET',
  is_support: false,
  project_type: 'client' as const,
  total_tasks: 80,
  completed_tasks: 55,
  pending_tasks: 25,
  total_points: 200,
  completed_points: 140,
  total_bugs: 7,
  active_cycle: 'Sprint 5',
  is_archived: false,
  project_start_date: '2024-03-01',
  project_end_date: '2024-09-30',
  state_breakdown: [
    { state: 'Done', count: 55 },
    { state: 'In Progress', count: 10 },
    { state: 'Backlog', count: 15 },
  ],
  label_breakdown: [
    { label: 'bug', count: 7 },
    { label: 'feature', count: 30 },
  ],
  bugs: [
    {
      id: 1,
      plane_issue_id: 'issue-bug-1',
      title: 'Bug login',
      state: 'In Progress',
      priority: 'high',
      assignee_name: 'Ana Garcia',
    },
  ],
  client_blocked: [
    {
      id: 2,
      plane_issue_id: 'issue-blocked-1',
      title: 'Bloqueado por cliente',
      state: 'Backlog',
      priority: null,
      assignee_name: null,
    },
  ],
  pending_items: [
    {
      id: 3,
      plane_issue_id: 'issue-pending-1',
      title: 'Feature pendiente',
      state: 'Backlog',
      priority: 'medium',
      assignee_name: 'Carlos Lopez',
    },
  ],
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(() => Promise.resolve(mockProjectDetail)),
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

import { useProjectDetail } from '@/hooks/useProjectDetail';

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
describe('useProjectDetail', () => {
  it('empieza en estado loading cuando projectId es valido', () => {
    const { result } = renderHook(() => useProjectDetail('42'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('devuelve el detalle del proyecto despues del fetch', async () => {
    const { result } = renderHook(() => useProjectDetail('42'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockProjectDetail);
  });

  it('mapea los campos basicos del proyecto correctamente', async () => {
    const { result } = renderHook(() => useProjectDetail('42'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const detail = result.current.data!;
    expect(detail.id).toBe(42);
    expect(detail.name).toBe('Proyecto Detalle');
    expect(detail.identifier).toBe('DET');
    expect(detail.project_type).toBe('client');
    expect(detail.total_tasks).toBe(80);
    expect(detail.completed_tasks).toBe(55);
    expect(detail.pending_tasks).toBe(25);
    expect(detail.total_bugs).toBe(7);
    expect(detail.active_cycle).toBe('Sprint 5');
  });

  it('devuelve el desglose de estados (state_breakdown)', async () => {
    const { result } = renderHook(() => useProjectDetail('42'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const breakdown = result.current.data!.state_breakdown;
    expect(breakdown).toHaveLength(3);
    expect(breakdown[0]).toEqual({ state: 'Done', count: 55 });
    expect(breakdown[1]).toEqual({ state: 'In Progress', count: 10 });
  });

  it('devuelve el desglose de etiquetas (label_breakdown)', async () => {
    const { result } = renderHook(() => useProjectDetail('42'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const labels = result.current.data!.label_breakdown;
    expect(labels).toHaveLength(2);
    expect(labels[0]).toEqual({ label: 'bug', count: 7 });
  });

  it('devuelve la lista de bugs con sus campos', async () => {
    const { result } = renderHook(() => useProjectDetail('42'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const bugs = result.current.data!.bugs;
    expect(bugs).toHaveLength(1);
    expect(bugs[0].title).toBe('Bug login');
    expect(bugs[0].priority).toBe('high');
    expect(bugs[0].assignee_name).toBe('Ana Garcia');
  });

  it('devuelve items bloqueados por cliente y pendientes', async () => {
    const { result } = renderHook(() => useProjectDetail('42'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.client_blocked).toHaveLength(1);
    expect(result.current.data!.pending_items).toHaveLength(1);
    expect(result.current.data!.pending_items[0].title).toBe('Feature pendiente');
  });

  it('no ejecuta la query cuando projectId esta vacio', () => {
    const { result } = renderHook(() => useProjectDetail(''), {
      wrapper: createWrapper(),
    });

    // enabled: Boolean('') === false, so the query should not be loading
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('propaga el error cuando la API falla', async () => {
    const { apiGet } = await import('@/lib/api');
    vi.mocked(apiGet).mockRejectedValueOnce(new Error('404 no encontrado'));

    const { result } = renderHook(() => useProjectDetail('99'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as Error).message).toBe('404 no encontrado');
  });
});
