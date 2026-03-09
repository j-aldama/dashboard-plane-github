import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock hooks BEFORE importing the component
vi.mock('@/hooks/useSyncStatus', () => ({
  useSyncStatus: vi.fn(),
}));

vi.mock('@/hooks/useSyncProgress', () => ({
  useSyncProgress: vi.fn(),
}));

import SyncPage from '@/app/(dashboard)/sync/page';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { useSyncProgress } from '@/hooks/useSyncProgress';

const useSyncStatusMock = vi.mocked(useSyncStatus);
const useSyncProgressMock = vi.mocked(useSyncProgress);

const defaultSyncProgress = {
  startSync: vi.fn(),
  cancelSync: vi.fn(),
  reset: vi.fn(),
  steps: [],
  progress: 0,
  status: 'idle' as const,
  results: null,
  errors: [] as string[],
  isRunning: false,
};

beforeEach(() => {
  useSyncStatusMock.mockReset();
  useSyncProgressMock.mockReset();
});

describe('SyncPage', () => {
  it('muestra estado idle con botón de iniciar', () => {
    useSyncStatusMock.mockReturnValue({
      data: { is_running: false, progress: 100, current_step: null, steps: [], last_sync: null, started_at: null },
      isLoading: false,
      error: null,
    } as any);
    useSyncProgressMock.mockReturnValue(defaultSyncProgress);

    render(<SyncPage />);

    expect(screen.getByText('Sincronización')).toBeInTheDocument();
    expect(screen.getByText('Sin sincronización en curso')).toBeInTheDocument();
    expect(screen.getByText('Iniciar sincronización')).toBeInTheDocument();
  });

  it('muestra progreso de polling cuando SSE está idle pero hay sync activa', () => {
    useSyncStatusMock.mockReturnValue({
      data: {
        is_running: true,
        progress: 50,
        current_step: 'work_items',
        started_at: '2026-03-09T10:00:00Z',
        steps: [
          { id: 'members', label: 'Sincronizando miembros', status: 'completed', records_synced: 5, error: null },
          { id: 'projects', label: 'Sincronizando proyectos', status: 'completed', records_synced: 3, error: null },
          { id: 'work_items', label: 'Sincronizando tareas', status: 'running', records_synced: null, error: null },
          { id: 'github', label: 'Sincronizando GitHub', status: 'pending', records_synced: null, error: null },
        ],
        last_sync: null,
      },
      isLoading: false,
      error: null,
    } as any);
    useSyncProgressMock.mockReturnValue(defaultSyncProgress);

    render(<SyncPage />);

    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Progreso general (reconectando...)')).toBeInTheDocument();
    expect(screen.getByText('Sincronizando miembros')).toBeInTheDocument();
    expect(screen.getByText('Sincronizando tareas')).toBeInTheDocument();
    // Should NOT show start button
    expect(screen.queryByText('Iniciar sincronización')).not.toBeInTheDocument();
  });

  it('oculta botón de inicio cuando polling detecta sync activa', () => {
    useSyncStatusMock.mockReturnValue({
      data: {
        is_running: true, progress: 25, current_step: 'members',
        started_at: '2026-03-09T10:00:00Z',
        steps: [{ id: 'members', label: 'Sincronizando miembros', status: 'running', records_synced: null, error: null }],
        last_sync: null,
      },
      isLoading: false,
      error: null,
    } as any);
    useSyncProgressMock.mockReturnValue(defaultSyncProgress);

    render(<SyncPage />);
    expect(screen.queryByText('Iniciar sincronización')).not.toBeInTheDocument();
  });

  it('prioriza SSE sobre polling cuando SSE está activo', () => {
    useSyncStatusMock.mockReturnValue({
      data: {
        is_running: true, progress: 25, current_step: 'members',
        started_at: '2026-03-09T10:00:00Z',
        steps: [{ id: 'members', label: 'Sincronizando miembros', status: 'running', records_synced: null, error: null }],
        last_sync: null,
      },
      isLoading: false,
      error: null,
    } as any);
    useSyncProgressMock.mockReturnValue({
      ...defaultSyncProgress,
      status: 'running' as const,
      isRunning: true,
      progress: 75,
      steps: [
        { id: 'members', label: 'Sincronizando miembros', status: 'completed' as const, records_synced: 5 },
        { id: 'projects', label: 'Sincronizando proyectos', status: 'completed' as const, records_synced: 3 },
        { id: 'work_items', label: 'Sincronizando tareas', status: 'running' as const },
        { id: 'github', label: 'Sincronizando GitHub', status: 'pending' as const },
      ],
    });

    render(<SyncPage />);

    // SSE progress (75%) should be displayed, not polling (25%)
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.queryByText('25%')).not.toBeInTheDocument();
    expect(screen.getByText('Progreso general')).toBeInTheDocument();
    expect(screen.queryByText('Progreso general (reconectando...)')).not.toBeInTheDocument();
  });

  it('muestra última sincronización', () => {
    useSyncStatusMock.mockReturnValue({
      data: {
        is_running: false, progress: 100, current_step: null, steps: [],
        started_at: null,
        last_sync: {
          id: 1, status: 'completed',
          started_at: '2026-03-09T10:00:00Z',
          completed_at: '2026-03-09T10:05:00Z',
          duration_seconds: 300, error_count: 0,
        },
      },
      isLoading: false,
      error: null,
    } as any);
    useSyncProgressMock.mockReturnValue(defaultSyncProgress);

    render(<SyncPage />);
    expect(screen.getByText('Última sincronización')).toBeInTheDocument();
    expect(screen.getByText('Completada')).toBeInTheDocument();
  });

  it('muestra "Iniciando sincronización..." cuando sync activa sin steps', () => {
    useSyncStatusMock.mockReturnValue({
      data: {
        is_running: true, progress: 0, current_step: null, steps: [],
        started_at: '2026-03-09T10:00:00Z', last_sync: null,
      },
      isLoading: false,
      error: null,
    } as any);
    useSyncProgressMock.mockReturnValue(defaultSyncProgress);

    render(<SyncPage />);
    expect(screen.getByText('Iniciando sincronización...')).toBeInTheDocument();
  });
});
