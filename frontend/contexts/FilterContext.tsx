'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export interface FilterState {
  dateFrom: string | null;
  dateTo: string | null;
  projectIds: string[];
  userIds: string[];
  cycleId: string | null;
}

export interface FilterContextValue extends FilterState {
  setDateRange: (from: string | null, to: string | null) => void;
  setProjects: (ids: string[]) => void;
  setUsers: (ids: string[]) => void;
  setCycle: (id: string | null) => void;
  clearFilters: () => void;
  toQueryParams: () => Record<string, string>;
  activeFilterCount: number;
}

const defaultFilterState: FilterState = {
  dateFrom: null,
  dateTo: null,
  projectIds: [],
  userIds: [],
  cycleId: null,
};

const FilterContext = createContext<FilterContextValue | null>(null);

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').filter(Boolean);
}

interface FilterProviderProps {
  children: React.ReactNode;
}

export function FilterProvider({ children }: FilterProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<FilterState>(() => ({
    dateFrom: searchParams.get('dateFrom'),
    dateTo: searchParams.get('dateTo'),
    projectIds: parseList(searchParams.get('projectIds')),
    userIds: parseList(searchParams.get('userIds')),
    cycleId: searchParams.get('cycleId'),
  }));

  // Sync from URL on navigation
  useEffect(() => {
    setFilters({
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      projectIds: parseList(searchParams.get('projectIds')),
      userIds: parseList(searchParams.get('userIds')),
      cycleId: searchParams.get('cycleId'),
    });
  }, [searchParams]);

  const pushToUrl = useCallback((newFilters: FilterState) => {
    const params = new URLSearchParams();

    if (newFilters.dateFrom) params.set('dateFrom', newFilters.dateFrom);
    if (newFilters.dateTo) params.set('dateTo', newFilters.dateTo);
    if (newFilters.projectIds.length > 0) params.set('projectIds', newFilters.projectIds.join(','));
    if (newFilters.userIds.length > 0) params.set('userIds', newFilters.userIds.join(','));
    if (newFilters.cycleId) params.set('cycleId', newFilters.cycleId);

    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(url, { scroll: false });
  }, [pathname, router]);

  const setDateRange = useCallback((from: string | null, to: string | null) => {
    setFilters((prev) => {
      const next = { ...prev, dateFrom: from, dateTo: to };
      pushToUrl(next);
      return next;
    });
  }, [pushToUrl]);

  const setProjects = useCallback((ids: string[]) => {
    setFilters((prev) => {
      // When project changes, clear dependent cycle filter
      const next = { ...prev, projectIds: ids, cycleId: null };
      pushToUrl(next);
      return next;
    });
  }, [pushToUrl]);

  const setUsers = useCallback((ids: string[]) => {
    setFilters((prev) => {
      const next = { ...prev, userIds: ids };
      pushToUrl(next);
      return next;
    });
  }, [pushToUrl]);

  const setCycle = useCallback((id: string | null) => {
    setFilters((prev) => {
      const next = { ...prev, cycleId: id };
      pushToUrl(next);
      return next;
    });
  }, [pushToUrl]);

  const clearFilters = useCallback(() => {
    const next = { ...defaultFilterState };
    setFilters(next);
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const toQueryParams = useCallback((): Record<string, string> => {
    const params: Record<string, string> = {};
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filters.projectIds.length > 0) params.projectIds = filters.projectIds.join(',');
    if (filters.userIds.length > 0) params.userIds = filters.userIds.join(',');
    if (filters.cycleId) params.cycleId = filters.cycleId;
    return params;
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.projectIds.length > 0) count++;
    if (filters.userIds.length > 0) count++;
    if (filters.cycleId) count++;
    return count;
  }, [filters]);

  const value = useMemo<FilterContextValue>(() => ({
    ...filters,
    setDateRange,
    setProjects,
    setUsers,
    setCycle,
    clearFilters,
    toQueryParams,
    activeFilterCount,
  }), [filters, setDateRange, setProjects, setUsers, setCycle, clearFilters, toQueryParams, activeFilterCount]);

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilterContext(): FilterContextValue {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilterContext must be used inside FilterProvider');
  }
  return context;
}
