import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Data fixtures
// ---------------------------------------------------------------------------
const mockProjectsList = [
  {
    id: 1,
    name: 'Proyecto Alpha',
    identifier: 'ALPHA',
    project_type: 'client' as const,
    is_archived: false,
  },
  {
    id: 2,
    name: 'Proyecto Beta',
    identifier: 'BETA',
    project_type: 'support' as const,
    is_archived: true,
  },
  {
    id: 3,
    name: 'Proyecto Gamma',
    identifier: null,
    project_type: 'internal' as const,
    is_archived: false,
  },
];

const mockUpdatedProject = {
  ...mockProjectsList[0],
  project_type: 'internal' as const,
};

// ---------------------------------------------------------------------------
// Mocks — use inline vi.fn() inside factory to avoid TDZ hoisting issues
// ---------------------------------------------------------------------------
vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(() => Promise.resolve(mockProjectsList)),
  apiPatch: vi.fn(() => Promise.resolve(mockUpdatedProject)),
}));

import { useProjectsList, useUpdateProjectType } from '@/hooks/useProjectSettings';
import { apiGet, apiPatch } from '@/lib/api';

// ---------------------------------------------------------------------------
// Test wrapper factory — fresh QueryClient per test to avoid state bleed
// ---------------------------------------------------------------------------
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
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
// Tests — useProjectsList
// ---------------------------------------------------------------------------
describe('useProjectsList', () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockClear();
    vi.mocked(apiGet).mockResolvedValue(mockProjectsList);
  });

  it('empieza en estado loading', () => {
    const { result } = renderHook(() => useProjectsList(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('devuelve la lista de proyectos despues del fetch', async () => {
    const { result } = renderHook(() => useProjectsList(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
  });

  it('mapea correctamente los campos de cada proyecto', async () => {
    const { result } = renderHook(() => useProjectsList(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [alpha, beta, gamma] = result.current.data!;

    expect(alpha.id).toBe(1);
    expect(alpha.name).toBe('Proyecto Alpha');
    expect(alpha.identifier).toBe('ALPHA');
    expect(alpha.project_type).toBe('client');
    expect(alpha.is_archived).toBe(false);

    expect(beta.project_type).toBe('support');
    expect(beta.is_archived).toBe(true);

    expect(gamma.identifier).toBeNull();
    expect(gamma.project_type).toBe('internal');
  });

  it('llama a apiGet con la ruta /projects', async () => {
    const { result } = renderHook(() => useProjectsList(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(vi.mocked(apiGet)).toHaveBeenCalledWith('/projects');
  });

  it('propaga el error cuando la API falla', async () => {
    vi.mocked(apiGet).mockRejectedValueOnce(new Error('Error del servidor'));

    const { result } = renderHook(() => useProjectsList(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as Error).message).toBe('Error del servidor');
  });
});

// ---------------------------------------------------------------------------
// Tests — useUpdateProjectType
// ---------------------------------------------------------------------------
describe('useUpdateProjectType', () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockClear();
    vi.mocked(apiPatch).mockClear();
    vi.mocked(apiGet).mockResolvedValue(mockProjectsList);
    vi.mocked(apiPatch).mockResolvedValue(mockUpdatedProject);
  });

  it('la mutacion empieza en estado idle', () => {
    const { result } = renderHook(() => useUpdateProjectType(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isIdle).toBe(true);
  });

  it('llama a apiPatch con la ruta y el payload correctos', async () => {
    const { result } = renderHook(() => useUpdateProjectType(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ projectId: 1, project_type: 'internal' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(vi.mocked(apiPatch)).toHaveBeenCalledWith('/projects/1', {
      project_type: 'internal',
    });
  });

  it('devuelve el proyecto actualizado despues de la mutacion', async () => {
    const { result } = renderHook(() => useUpdateProjectType(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ projectId: 1, project_type: 'internal' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockUpdatedProject);
    expect(result.current.data?.project_type).toBe('internal');
  });

  it('propaga el error cuando apiPatch falla', async () => {
    vi.mocked(apiPatch).mockRejectedValueOnce(new Error('Acceso denegado'));

    const { result } = renderHook(() => useUpdateProjectType(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ projectId: 1, project_type: 'support' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as Error).message).toBe('Acceso denegado');
  });

  it('acepta los tres tipos de proyecto validos', async () => {
    for (const type of ['client', 'support', 'internal'] as const) {
      vi.mocked(apiPatch).mockResolvedValueOnce({
        ...mockProjectsList[0],
        project_type: type,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useUpdateProjectType(), { wrapper });

      await act(async () => {
        result.current.mutate({ projectId: 1, project_type: type });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.project_type).toBe(type);
    }
  });
});
