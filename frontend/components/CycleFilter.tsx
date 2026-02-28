'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useFilterContext } from '@/contexts/FilterContext';

interface Cycle {
  id: string;
  name: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}

interface CyclesResponse {
  cycles: Cycle[];
}

export function CycleFilter() {
  const { projectIds, cycleId, setCycle } = useFilterContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const hasProject = projectIds.length > 0;

  const { data, isLoading, isError } = useQuery<CyclesResponse>({
    queryKey: ['filter-cycles', projectIds],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (projectIds.length > 0) {
        params.project_ids = projectIds.join(',');
      }
      return apiGet<CyclesResponse>('/metrics/cycles', params);
    },
    enabled: hasProject,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  const cycles = data?.cycles ?? [];

  // Clear cycle selection when projects change and selected cycle is no longer valid
  useEffect(() => {
    if (cycleId && cycles.length > 0) {
      const cycleExists = cycles.some((c) => c.id === cycleId);
      if (!cycleExists) {
        setCycle(null);
      }
    }
  }, [cycles, cycleId, setCycle]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectCycle(id: string | null) {
    setCycle(id === cycleId ? null : id);
    setOpen(false);
  }

  function getLabel(): string {
    if (!hasProject) return 'Ciclo';
    if (!cycleId) return 'Ciclo';
    const cycle = cycles.find((c) => c.id === cycleId);
    return cycle ? cycle.name : 'Ciclo';
  }

  const hasValue = Boolean(cycleId);
  const isDisabled = !hasProject;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !isDisabled && setOpen((prev) => !prev)}
        disabled={isDisabled}
        title={isDisabled ? 'Selecciona un proyecto primero' : undefined}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors whitespace-nowrap
          ${isDisabled
            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
            : hasValue
              ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
              : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800'
          }`}
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>
          {isDisabled ? 'Selecciona un proyecto' : getLabel()}
        </span>
        {!isDisabled && (
          <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && !isDisabled && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
          <div className="p-2">
            <p className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ciclos</p>

            {isLoading && (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">
                <div className="inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin mr-2" />
                Cargando ciclos...
              </div>
            )}

            {isError && (
              <div className="px-3 py-3 text-sm text-slate-400 text-center">
                No se pudieron cargar los ciclos
              </div>
            )}

            {!isLoading && !isError && cycles.length === 0 && (
              <div className="px-3 py-3 text-sm text-slate-400 text-center">
                No hay ciclos para este proyecto
              </div>
            )}

            {!isLoading && cycles.length > 0 && (
              <div className="mt-1 max-h-52 overflow-y-auto space-y-0.5">
                {/* "None" option */}
                {hasValue && (
                  <button
                    onClick={() => selectCycle(null)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors text-left text-slate-500 hover:bg-slate-50 hover:text-slate-700 italic"
                  >
                    Todos los ciclos
                  </button>
                )}
                {cycles.map((cycle) => {
                  const selected = cycleId === cycle.id;
                  return (
                    <button
                      key={cycle.id}
                      onClick={() => selectCycle(cycle.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors text-left
                        ${selected
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                    >
                      <span className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center
                        ${selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                        {selected && (
                          <span className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="truncate block">{cycle.name}</span>
                        {cycle.status && (
                          <span className="text-xs text-slate-400">{cycle.status}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
