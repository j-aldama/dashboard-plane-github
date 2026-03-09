import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock child filter components so FilterBar tests stay isolated
vi.mock('@/components/DateRangePicker', () => ({
  DateRangePicker: () => <div data-testid="date-range-picker" />,
}));

vi.mock('@/components/ProjectFilter', () => ({
  ProjectFilter: () => <div data-testid="project-filter" />,
}));

vi.mock('@/components/UserFilter', () => ({
  UserFilter: () => <div data-testid="user-filter" />,
}));

vi.mock('@/components/CycleFilter', () => ({
  CycleFilter: () => <div data-testid="cycle-filter" />,
}));

// Provide a controllable mock for the FilterContext
const mockClearFilters = vi.fn();
let mockActiveFilterCount = 0;

vi.mock('@/contexts/FilterContext', () => ({
  useFilterContext: () => ({
    dateFrom: null,
    dateTo: null,
    projectIds: [],
    userIds: [],
    cycleId: null,
    setDateRange: vi.fn(),
    setProjects: vi.fn(),
    setUsers: vi.fn(),
    setCycle: vi.fn(),
    clearFilters: mockClearFilters,
    toQueryParams: () => ({}),
    activeFilterCount: mockActiveFilterCount,
  }),
}));

import { FilterBar } from '@/components/FilterBar';

describe('FilterBar', () => {
  beforeEach(() => {
    mockActiveFilterCount = 0;
    mockClearFilters.mockClear();
  });

  // ------------------------------------------------------------------ //
  // 1. Structure
  // ------------------------------------------------------------------ //
  it('renderiza la etiqueta "Filtros"', () => {
    render(<FilterBar />);

    expect(screen.getByText('Filtros')).toBeInTheDocument();
  });

  it('renderiza los cuatro controles de filtro', () => {
    render(<FilterBar />);

    expect(screen.getByTestId('date-range-picker')).toBeInTheDocument();
    expect(screen.getByTestId('project-filter')).toBeInTheDocument();
    expect(screen.getByTestId('user-filter')).toBeInTheDocument();
    expect(screen.getByTestId('cycle-filter')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------ //
  // 2. Active filter count badge
  // ------------------------------------------------------------------ //
  it('no muestra el badge de conteo cuando activeFilterCount es 0', () => {
    mockActiveFilterCount = 0;
    render(<FilterBar />);

    // The badge renders the count as a number inside a small span
    // When count is 0 there is no badge element
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('muestra el badge con el conteo cuando hay filtros activos', () => {
    mockActiveFilterCount = 3;
    render(<FilterBar />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('el badge tiene clases bg-blue-600 y text-white', () => {
    mockActiveFilterCount = 2;
    render(<FilterBar />);

    const badge = screen.getByText('2');
    expect(badge).toHaveClass('bg-blue-600');
    expect(badge).toHaveClass('text-white');
  });

  // ------------------------------------------------------------------ //
  // 3. Clear-filters button
  // ------------------------------------------------------------------ //
  it('no muestra el boton "Limpiar filtros" cuando no hay filtros activos', () => {
    mockActiveFilterCount = 0;
    render(<FilterBar />);

    expect(screen.queryByText('Limpiar filtros')).not.toBeInTheDocument();
  });

  it('muestra el boton "Limpiar filtros" cuando hay filtros activos', () => {
    mockActiveFilterCount = 1;
    render(<FilterBar />);

    expect(screen.getByText('Limpiar filtros')).toBeInTheDocument();
  });

  it('llama a clearFilters al hacer click en el boton', async () => {
    mockActiveFilterCount = 2;
    const user = userEvent.setup();
    render(<FilterBar />);

    await user.click(screen.getByText('Limpiar filtros'));

    expect(mockClearFilters).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------ //
  // 4. Layout
  // ------------------------------------------------------------------ //
  it('renderiza dentro de un contenedor con borde inferior', () => {
    const { container } = render(<FilterBar />);

    const wrapper = container.querySelector('.border-b');
    expect(wrapper).toBeInTheDocument();
  });
});
