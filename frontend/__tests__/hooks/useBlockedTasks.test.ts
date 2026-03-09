import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockBlockedTasks = {
  count: 2,
  tasks: [
    {
      id: 1,
      title: 'Tarea bloqueada por cliente',
      project_name: 'Proyecto Alpha',
      project_identifier: 'ALPHA',
      assignee_name: 'Ana García',
      state: 'In Progress',
      priority: 'high',
      labels: ['Bloqueada', 'cliente'],
      plane_issue_id: 'issue-001',
    },
    {
      id: 2,
      title: 'Esperando API externa',
      project_name: 'Proyecto Beta',
      project_identifier: 'BETA',
      assignee_name: null,
      state: 'Todo',
      priority: 'medium',
      labels: ['bloqueada'],
      plane_issue_id: 'issue-002',
    },
  ],
};

const mockComments = {
  comments: [
    {
      actor_name: 'Ana García',
      body: 'Bloqueada porque el cliente no responde',
      created_at: '2026-03-08T10:00:00Z',
    },
  ],
};

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn((path: string) => {
    if (path === '/blocked-tasks') {
      return Promise.resolve(mockBlockedTasks);
    }
    if (path.match(/\/work-items\/\d+\/comments/)) {
      return Promise.resolve(mockComments);
    }
    return Promise.reject(new Error(`Unmocked path: ${path}`));
  }),
}));

import { apiGet } from '@/lib/api';
import { useBlockedTasks, useWorkItemComments } from '@/hooks/useBlockedTasks';

const apiGetMock = vi.mocked(apiGet);

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

describe('useBlockedTasks', () => {
  it('empieza en estado loading', () => {
    const { result } = renderHook(() => useBlockedTasks(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('devuelve tareas bloqueadas después del fetch', async () => {
    const { result } = renderHook(() => useBlockedTasks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.count).toBe(2);
    expect(result.current.data?.tasks).toHaveLength(2);
    expect(result.current.data?.tasks[0].title).toBe('Tarea bloqueada por cliente');
    expect(result.current.data?.tasks[0].project_name).toBe('Proyecto Alpha');
    expect(result.current.data?.tasks[0].assignee_name).toBe('Ana García');
  });

  it('incluye labels en cada tarea', async () => {
    const { result } = renderHook(() => useBlockedTasks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.tasks[0].labels).toContain('Bloqueada');
    expect(result.current.data?.tasks[1].labels).toContain('bloqueada');
  });

  it('maneja tareas sin asignado', async () => {
    const { result } = renderHook(() => useBlockedTasks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.tasks[1].assignee_name).toBeNull();
  });

  it('maneja error de la API', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useBlockedTasks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useWorkItemComments', () => {
  it('no hace fetch cuando workItemId es null', () => {
    const { result } = renderHook(() => useWorkItemComments(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('devuelve comentarios cuando se pasa un ID válido', async () => {
    const { result } = renderHook(() => useWorkItemComments(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.comments).toHaveLength(1);
    expect(result.current.data?.comments[0].actor_name).toBe('Ana García');
    expect(result.current.data?.comments[0].body).toBe('Bloqueada porque el cliente no responde');
  });
});
