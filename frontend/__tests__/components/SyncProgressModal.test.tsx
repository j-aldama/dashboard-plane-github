import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncProgressModal } from '@/components/SyncProgressModal';
import type { SyncStep, SyncStatus, SyncResults } from '@/hooks/useSyncProgress';

// Mock the useSyncProgress hook
const mockStartSync = vi.fn();
const mockCancelSync = vi.fn();
const mockReset = vi.fn();

let mockHookReturn: {
  startSync: typeof mockStartSync;
  cancelSync: typeof mockCancelSync;
  reset: typeof mockReset;
  steps: SyncStep[];
  progress: number;
  status: SyncStatus;
  results: SyncResults | null;
  errors: string[];
  isRunning: boolean;
};

vi.mock('@/hooks/useSyncProgress', () => ({
  useSyncProgress: () => mockHookReturn,
}));

// Wrap in QueryClientProvider since the component uses hooks that may need it
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

function setMockState(overrides: Partial<typeof mockHookReturn>) {
  mockHookReturn = {
    startSync: mockStartSync,
    cancelSync: mockCancelSync,
    reset: mockReset,
    steps: [],
    progress: 0,
    status: 'idle',
    results: null,
    errors: [],
    isRunning: false,
    ...overrides,
  };
}

describe('SyncProgressModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockState({});
  });

  it('no renderiza nada cuando isOpen es false', () => {
    const { container } = render(
      <SyncProgressModal isOpen={false} onClose={vi.fn()} />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('renderiza el modal cuando isOpen es true', () => {
    setMockState({ status: 'running', isRunning: true });

    render(<SyncProgressModal isOpen={true} onClose={vi.fn()} />);

    expect(
      screen.getByText(/Sincronizaci[oó]n en progreso/),
    ).toBeInTheDocument();
  });

  it('llama a startSync al abrir el modal', () => {
    setMockState({ status: 'idle' });

    render(<SyncProgressModal isOpen={true} onClose={vi.fn()} />);

    expect(mockStartSync).toHaveBeenCalled();
  });

  it('muestra barra de progreso con porcentaje', () => {
    setMockState({
      status: 'running',
      isRunning: true,
      progress: 42,
    });

    render(<SyncProgressModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '42',
    );
  });

  it('muestra mensaje de inicio cuando no hay steps', () => {
    setMockState({
      status: 'running',
      isRunning: true,
      steps: [],
    });

    render(<SyncProgressModal isOpen={true} onClose={vi.fn()} />);

    expect(
      screen.getByText(/Iniciando sincronizaci[oó]n/),
    ).toBeInTheDocument();
  });

  it('renderiza steps con sus labels', () => {
    const steps: SyncStep[] = [
      { id: 'plane_projects', label: 'Sincronizando proyectos de Plane', status: 'completed', records_synced: 5 },
      { id: 'plane_issues', label: 'Sincronizando issues de Plane', status: 'running' },
      { id: 'github_repos', label: 'Sincronizando repositorios de GitHub', status: 'pending' },
    ];

    setMockState({
      status: 'running',
      isRunning: true,
      progress: 33,
      steps,
    });

    render(<SyncProgressModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Sincronizando proyectos de Plane')).toBeInTheDocument();
    expect(screen.getByText('Sincronizando issues de Plane')).toBeInTheDocument();
    expect(screen.getByText('Sincronizando repositorios de GitHub')).toBeInTheDocument();
  });

  it('muestra registros sincronizados en steps completados', () => {
    const steps: SyncStep[] = [
      { id: 'plane_projects', label: 'Sincronizando proyectos de Plane', status: 'completed', records_synced: 15 },
    ];

    setMockState({
      status: 'running',
      isRunning: true,
      progress: 50,
      steps,
    });

    render(<SyncProgressModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('15 registros sincronizados')).toBeInTheDocument();
  });

  it('muestra error en step con error', () => {
    const steps: SyncStep[] = [
      { id: 'github_repos', label: 'Sincronizando repositorios de GitHub', status: 'error', error: 'Timeout' },
    ];

    setMockState({
      status: 'running',
      isRunning: true,
      progress: 50,
      steps,
    });

    render(<SyncProgressModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Timeout')).toBeInTheDocument();
  });

  it('muestra resumen de sincronizacion completada exitosamente', () => {
    const results: SyncResults = {
      total_steps: 7,
      completed_steps: 7,
      failed_steps: 0,
      duration_seconds: 12.3,
    };

    setMockState({
      status: 'completed',
      isRunning: false,
      progress: 100,
      results,
      errors: [],
    });

    render(<SyncProgressModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Sincronizaci[oó]n completada/)).toBeInTheDocument();
    expect(screen.getByText('7 completados')).toBeInTheDocument();
    expect(screen.getByText('12.3s')).toBeInTheDocument();
  });

  it('muestra resumen con errores parciales', () => {
    const results: SyncResults = {
      total_steps: 7,
      completed_steps: 5,
      failed_steps: 2,
      duration_seconds: 15.0,
    };

    setMockState({
      status: 'completed',
      isRunning: false,
      progress: 100,
      results,
      errors: ['Error en github_repos'],
    });

    render(<SyncProgressModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Sincronizaci[oó]n completada con errores/)).toBeInTheDocument();
    expect(screen.getByText('5 completados')).toBeInTheDocument();
    expect(screen.getByText('2 fallidos')).toBeInTheDocument();
  });

  it('muestra sincronizacion fallida en estado error', () => {
    const results: SyncResults = {
      total_steps: 7,
      completed_steps: 0,
      failed_steps: 7,
    };

    setMockState({
      status: 'error',
      isRunning: false,
      progress: 100,
      results,
      errors: ['Error de conexion'],
    });

    render(<SyncProgressModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Sincronizaci[oó]n fallida/)).toBeInTheDocument();
  });

  it('deshabilita boton Cerrar mientras esta sincronizando', () => {
    setMockState({
      status: 'running',
      isRunning: true,
      progress: 50,
    });

    render(<SyncProgressModal isOpen={true} onClose={vi.fn()} />);

    const closeButtons = screen.getAllByRole('button');
    const footerButton = closeButtons.find(
      (btn) => btn.textContent === 'Sincronizando...',
    );
    expect(footerButton).toBeDisabled();
  });

  it('habilita boton Cerrar cuando termina la sincronizacion', () => {
    setMockState({
      status: 'completed',
      isRunning: false,
      progress: 100,
      results: { total_steps: 7, completed_steps: 7, failed_steps: 0 },
    });

    render(<SyncProgressModal isOpen={true} onClose={vi.fn()} />);

    const closeButtons = screen.getAllByRole('button');
    const footerButton = closeButtons.find(
      (btn) => btn.textContent === 'Cerrar',
    );
    expect(footerButton).not.toBeDisabled();
  });

  it('llama a onClose al hacer click en Cerrar cuando esta completado', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    setMockState({
      status: 'completed',
      isRunning: false,
      progress: 100,
      results: { total_steps: 7, completed_steps: 7, failed_steps: 0 },
    });

    render(<SyncProgressModal isOpen={true} onClose={onClose} />);

    const closeButtons = screen.getAllByRole('button');
    const footerButton = closeButtons.find(
      (btn) => btn.textContent === 'Cerrar',
    );
    await user.click(footerButton!);

    expect(onClose).toHaveBeenCalled();
  });

  it('tiene atributos de accesibilidad del dialog', () => {
    setMockState({ status: 'running', isRunning: true });

    render(<SyncProgressModal isOpen={true} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'sync-modal-title');
  });

  it('muestra lista de errores cuando hay errores sin results', () => {
    setMockState({
      status: 'error',
      isRunning: false,
      progress: 50,
      errors: ['Error en paso 1', 'Error en paso 2'],
      results: null,
    });

    render(<SyncProgressModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Errores encontrados')).toBeInTheDocument();
    expect(screen.getByText('Error en paso 1')).toBeInTheDocument();
    expect(screen.getByText('Error en paso 2')).toBeInTheDocument();
  });
});
