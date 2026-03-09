import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// ---------------------------------------------------------------------------
// useFilters is a thin proxy over useFilterContext.
// We mock the context directly to avoid mounting FilterProvider, which uses
// next/navigation's useSearchParams inside a useEffect — that combination
// causes an infinite re-render loop in jsdom that exhausts Node heap memory.
// ---------------------------------------------------------------------------

const mockFilterContext = {
  dateFrom: null as string | null,
  dateTo: null as string | null,
  projectIds: [] as string[],
  userIds: [] as string[],
  cycleId: null as string | null,
  activeFilterCount: 0,
  setDateRange: vi.fn(),
  setProjects: vi.fn(),
  setUsers: vi.fn(),
  setCycle: vi.fn(),
  clearFilters: vi.fn(),
  toQueryParams: vi.fn(() => ({})),
};

vi.mock('@/contexts/FilterContext', () => ({
  useFilterContext: () => mockFilterContext,
  FilterProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { useFilters, buildApiParams } from '@/hooks/useFilters';

// ---------------------------------------------------------------------------
// Tests — useFilters (delegates to useFilterContext)
// ---------------------------------------------------------------------------
describe('useFilters', () => {
  it('devuelve el estado de filtros desde el contexto', () => {
    mockFilterContext.dateFrom = null;
    mockFilterContext.dateTo = null;
    mockFilterContext.projectIds = [];
    mockFilterContext.userIds = [];
    mockFilterContext.cycleId = null;
    mockFilterContext.activeFilterCount = 0;

    const { result } = renderHook(() => useFilters());

    expect(result.current.dateFrom).toBeNull();
    expect(result.current.dateTo).toBeNull();
    expect(result.current.projectIds).toEqual([]);
    expect(result.current.userIds).toEqual([]);
    expect(result.current.cycleId).toBeNull();
    expect(result.current.activeFilterCount).toBe(0);
  });

  it('expone las funciones de mutacion del contexto', () => {
    const { result } = renderHook(() => useFilters());

    expect(result.current.setDateRange).toBe(mockFilterContext.setDateRange);
    expect(result.current.setProjects).toBe(mockFilterContext.setProjects);
    expect(result.current.setUsers).toBe(mockFilterContext.setUsers);
    expect(result.current.setCycle).toBe(mockFilterContext.setCycle);
    expect(result.current.clearFilters).toBe(mockFilterContext.clearFilters);
    expect(result.current.toQueryParams).toBe(mockFilterContext.toQueryParams);
  });

  it('refleja el activeFilterCount del contexto', () => {
    mockFilterContext.activeFilterCount = 3;

    const { result } = renderHook(() => useFilters());

    expect(result.current.activeFilterCount).toBe(3);
  });

  it('refleja dateFrom y dateTo del contexto', () => {
    mockFilterContext.dateFrom = '2024-01-01';
    mockFilterContext.dateTo = '2024-06-30';

    const { result } = renderHook(() => useFilters());

    expect(result.current.dateFrom).toBe('2024-01-01');
    expect(result.current.dateTo).toBe('2024-06-30');
  });

  it('refleja projectIds del contexto', () => {
    mockFilterContext.projectIds = ['10', '20', '30'];

    const { result } = renderHook(() => useFilters());

    expect(result.current.projectIds).toEqual(['10', '20', '30']);
  });

  it('refleja userIds del contexto', () => {
    mockFilterContext.userIds = ['u1', 'u2'];

    const { result } = renderHook(() => useFilters());

    expect(result.current.userIds).toEqual(['u1', 'u2']);
  });

  it('refleja cycleId del contexto', () => {
    mockFilterContext.cycleId = 'sprint-7';

    const { result } = renderHook(() => useFilters());

    expect(result.current.cycleId).toBe('sprint-7');
  });

  it('toQueryParams devuelve el resultado del contexto', () => {
    const expected = { dateFrom: '2024-01-01', projectIds: '1,2' };
    mockFilterContext.toQueryParams.mockReturnValueOnce(expected);

    const { result } = renderHook(() => useFilters());

    expect(result.current.toQueryParams()).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Tests — buildApiParams (pure function, no context needed)
// ---------------------------------------------------------------------------
describe('buildApiParams', () => {
  it('fusiona extraParams y filterParams en un solo objeto', () => {
    const result = buildApiParams(
      { limit: '10' },
      { dateFrom: '2024-01-01', dateTo: '2024-03-31' },
    );

    expect(result).toEqual({
      limit: '10',
      dateFrom: '2024-01-01',
      dateTo: '2024-03-31',
    });
  });

  it('extraParams sobreescribe filterParams en caso de colision de clave', () => {
    const result = buildApiParams(
      { dateFrom: 'override-date' },
      { dateFrom: 'original-date' },
    );

    expect(result.dateFrom).toBe('override-date');
  });

  it('devuelve objeto vacio cuando ambos params estan vacios', () => {
    expect(buildApiParams({}, {})).toEqual({});
  });

  it('funciona con solo filterParams', () => {
    const result = buildApiParams({}, { cycleId: 'c-5', userIds: 'u1,u2' });

    expect(result).toEqual({ cycleId: 'c-5', userIds: 'u1,u2' });
  });

  it('funciona con solo extraParams', () => {
    const result = buildApiParams({ page: '2', limit: '20' }, {});

    expect(result).toEqual({ page: '2', limit: '20' });
  });

  it('no muta los objetos originales', () => {
    const extra = { a: '1' };
    const filters = { b: '2' };

    buildApiParams(extra, filters);

    expect(extra).toEqual({ a: '1' });
    expect(filters).toEqual({ b: '2' });
  });

  it('preserva multiples claves de ambos params', () => {
    const result = buildApiParams(
      { projectIds: '42', limit: '5' },
      { dateFrom: '2024-01-01', dateTo: '2024-12-31', userIds: 'u9' },
    );

    expect(result.projectIds).toBe('42');
    expect(result.limit).toBe('5');
    expect(result.dateFrom).toBe('2024-01-01');
    expect(result.dateTo).toBe('2024-12-31');
    expect(result.userIds).toBe('u9');
  });
});
