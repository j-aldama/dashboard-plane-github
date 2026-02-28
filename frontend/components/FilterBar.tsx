'use client';

import { useFilterContext } from '@/contexts/FilterContext';
import { DateRangePicker } from '@/components/DateRangePicker';
import { ProjectFilter } from '@/components/ProjectFilter';
import { UserFilter } from '@/components/UserFilter';
import { CycleFilter } from '@/components/CycleFilter';

export function FilterBar() {
  const { clearFilters, activeFilterCount } = useFilterContext();

  return (
    <div className="bg-white border-b border-slate-200 px-4 lg:px-6 py-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Filter icon label */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mr-1 flex-shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span>Filtros</span>
          {activeFilterCount > 0 && (
            <span className="flex items-center justify-center w-4 h-4 text-xs bg-blue-600 text-white rounded-full font-semibold">
              {activeFilterCount}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-slate-200 flex-shrink-0" />

        {/* Filter controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker />
          <ProjectFilter />
          <UserFilter />
          <CycleFilter />
        </div>

        {/* Clear button — only shown when there are active filters */}
        {activeFilterCount > 0 && (
          <>
            <div className="h-5 w-px bg-slate-200 flex-shrink-0 ml-1" />
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-colors whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Limpiar filtros
            </button>
          </>
        )}
      </div>
    </div>
  );
}
