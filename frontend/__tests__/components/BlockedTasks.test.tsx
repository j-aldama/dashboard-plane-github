import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock hooks BEFORE importing the component
vi.mock('@/hooks/useBlockedTasks', () => ({
  useBlockedTasks: vi.fn(),
  useWorkItemComments: vi.fn(),
}));

import { BlockedTasks } from '@/components/BlockedTasks';
import { useBlockedTasks, useWorkItemComments } from '@/hooks/useBlockedTasks';

const useBlockedTasksMock = vi.mocked(useBlockedTasks);
const useWorkItemCommentsMock = vi.mocked(useWorkItemComments);

const mockBlockedData = {
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

beforeEach(() => {
  useBlockedTasksMock.mockReset();
  useWorkItemCommentsMock.mockReset();
  // Default: comments hook returns loading
  useWorkItemCommentsMock.mockReturnValue({
    data: undefined,
    isLoading: true,
    error: null,
  } as any);
});

describe('BlockedTasks', () => {
  it('muestra título mientras carga', () => {
    useBlockedTasksMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<BlockedTasks />);
    expect(screen.getByText('Tareas Bloqueadas')).toBeInTheDocument();
  });

  it('muestra mensaje cuando no hay tareas bloqueadas', () => {
    useBlockedTasksMock.mockReturnValue({
      data: { count: 0, tasks: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<BlockedTasks />);
    expect(screen.getByText('No hay tareas bloqueadas.')).toBeInTheDocument();
  });

  it('muestra contador de tareas bloqueadas', () => {
    useBlockedTasksMock.mockReturnValue({
      data: mockBlockedData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<BlockedTasks />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('muestra título de cada tarea', () => {
    useBlockedTasksMock.mockReturnValue({
      data: mockBlockedData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<BlockedTasks />);
    expect(screen.getByText('Tarea bloqueada por cliente')).toBeInTheDocument();
    expect(screen.getByText('Esperando API externa')).toBeInTheDocument();
  });

  it('muestra proyecto y asignado', () => {
    useBlockedTasksMock.mockReturnValue({
      data: mockBlockedData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<BlockedTasks />);
    expect(screen.getByText('ALPHA')).toBeInTheDocument();
    expect(screen.getByText('Ana García')).toBeInTheDocument();
    expect(screen.getByText('BETA')).toBeInTheDocument();
  });

  it('muestra prioridad y estado como badges', () => {
    useBlockedTasksMock.mockReturnValue({
      data: mockBlockedData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<BlockedTasks />);
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('muestra error y botón de reintentar', () => {
    useBlockedTasksMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: vi.fn(),
    } as any);

    render(<BlockedTasks />);
    expect(screen.getByText('No se pudieron cargar las tareas bloqueadas.')).toBeInTheDocument();
    expect(screen.getByText('Reintentar')).toBeInTheDocument();
  });

  it('expande tarea para mostrar comentarios', async () => {
    useBlockedTasksMock.mockReturnValue({
      data: mockBlockedData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    useWorkItemCommentsMock.mockReturnValue({
      data: mockComments,
      isLoading: false,
      error: null,
    } as any);

    render(<BlockedTasks />);

    const user = userEvent.setup();
    await user.click(screen.getByText('Tarea bloqueada por cliente'));

    await waitFor(() => {
      expect(screen.getByText('Comentarios')).toBeInTheDocument();
      expect(screen.getByText('Bloqueada porque el cliente no responde')).toBeInTheDocument();
    });
  });

  it('muestra mensaje cuando no hay comentarios', async () => {
    useBlockedTasksMock.mockReturnValue({
      data: mockBlockedData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    useWorkItemCommentsMock.mockReturnValue({
      data: { comments: [] },
      isLoading: false,
      error: null,
    } as any);

    render(<BlockedTasks />);

    const user = userEvent.setup();
    await user.click(screen.getByText('Tarea bloqueada por cliente'));

    await waitFor(() => {
      expect(screen.getByText('Sin comentarios.')).toBeInTheDocument();
    });
  });
});
