'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/Skeleton';
import { useCycles, CycleItem } from '@/hooks/useCycles';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcDaysRemaining(endDate: string | null): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function daysRemainingColor(days: number): string {
  if (days > 10) return 'text-emerald-600';
  if (days >= 5) return 'text-amber-500';
  return 'text-red-500';
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CycleCardSkeleton() {
  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  );
}

// ─── Task detail table ─────────────────────────────────────────────────────────

function CycleDetailTable({ cycle }: { cycle: CycleItem }) {
  const rows = [
    { label: 'Tareas totales', value: cycle.total_tasks, colorClass: 'text-slate-700' },
    { label: 'Completadas', value: cycle.completed_tasks, colorClass: 'text-emerald-600' },
    { label: 'Pendientes', value: cycle.pending_tasks, colorClass: 'text-amber-500' },
    { label: 'Puntos totales', value: cycle.total_points, colorClass: 'text-slate-700' },
    { label: 'Puntos completados', value: cycle.completed_points, colorClass: 'text-emerald-600' },
    {
      label: 'Puntos pendientes',
      value: cycle.total_points - cycle.completed_points,
      colorClass: 'text-amber-500',
    },
  ];

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Detalle del ciclo
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 bg-slate-50 rounded-tl-lg">
                Métrica
              </th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 bg-slate-50 rounded-tr-lg">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
              >
                <td className="py-2.5 px-3 text-slate-600">{row.label}</td>
                <td className={`py-2.5 px-3 text-right font-semibold tabular-nums ${row.colorClass}`}>
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Cycle Card ───────────────────────────────────────────────────────────────

function CycleCard({ cycle }: { cycle: CycleItem }) {
  const [expanded, setExpanded] = useState(false);

  const completionPct =
    cycle.total_tasks > 0
      ? Math.round((cycle.completed_tasks / cycle.total_tasks) * 100)
      : 0;

  const pointsPct =
    cycle.total_points > 0
      ? Math.round((cycle.completed_points / cycle.total_points) * 100)
      : 0;

  const daysRemaining = calcDaysRemaining(cycle.end_date);

  return (
    <div
      className={`card p-5 flex flex-col gap-4 transition-all duration-150 border-l-4 ${
        cycle.is_active ? 'border-l-blue-500' : 'border-l-transparent'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-slate-900 truncate">{cycle.name}</h4>
            {cycle.is_active && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                En curso
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <StatusBadge
            label={cycle.is_active ? 'Activo' : 'Finalizado'}
            variant={cycle.is_active ? 'success' : 'neutral'}
          />
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Contraer detalle' : 'Expandir detalle'}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Tareas</p>
          <p className="text-lg font-bold text-slate-800 tabular-nums">
            {cycle.completed_tasks}
            <span className="text-sm font-normal text-slate-400">/{cycle.total_tasks}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Pendientes</p>
          <p className="text-lg font-bold text-amber-500 tabular-nums">{cycle.pending_tasks}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Puntos</p>
          <p className="text-lg font-bold text-slate-800 tabular-nums">
            {cycle.completed_points}
            <span className="text-sm font-normal text-slate-400">/{cycle.total_points}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Días restantes</p>
          {daysRemaining === null ? (
            <p className="text-lg font-bold text-slate-400">—</p>
          ) : daysRemaining < 0 ? (
            <p className="text-lg font-bold text-slate-400 text-sm">Finalizado</p>
          ) : (
            <p className={`text-lg font-bold tabular-nums ${daysRemainingColor(daysRemaining)}`}>
              {daysRemaining}d
            </p>
          )}
        </div>
      </div>

      {/* Task progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">Progreso tareas</span>
          <span className="text-xs font-medium text-slate-600">{completionPct}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              cycle.is_active ? 'bg-blue-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Points progress bar — only when there are points */}
      {cycle.total_points > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Progreso puntos</span>
            <span className="text-xs font-medium text-slate-600">{pointsPct}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                cycle.is_active ? 'bg-blue-300' : 'bg-emerald-300'
              }`}
              style={{ width: `${pointsPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Inline detail */}
      {expanded && <CycleDetailTable cycle={cycle} />}
    </div>
  );
}

// ─── Project Group ─────────────────────────────────────────────────────────────

function ProjectGroup({ projectName, cycles }: { projectName: string; cycles: CycleItem[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const activeCount = cycles.filter((c) => c.is_active).length;

  return (
    <section>
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-3 mb-3 group text-left"
      >
        <svg
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
            collapsed ? '-rotate-90' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <h3 className="font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
          {projectName}
        </h3>
        <span className="text-xs text-slate-400 font-normal">
          {cycles.length} ciclo{cycles.length !== 1 ? 's' : ''}
          {activeCount > 0 && (
            <span className="ml-1.5 text-blue-600 font-medium">
              · {activeCount} activo{activeCount !== 1 ? 's' : ''}
            </span>
          )}
        </span>
      </button>

      {!collapsed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pl-7">
          {cycles.map((cycle) => (
            <CycleCard key={cycle.id} cycle={cycle} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CyclesPage() {
  const { data, isLoading, isError } = useCycles();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [onlyActive, setOnlyActive] = useState(false);

  const allCycles = data?.cycles ?? [];

  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    allCycles.forEach((c) => {
      if (!seen.has(c.project_id)) seen.set(c.project_id, c.project_name);
    });
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCycles]);

  const filtered = useMemo(() => {
    let result = [...allCycles];
    if (selectedProjectId !== 'all') {
      result = result.filter((c) => c.project_id === selectedProjectId);
    }
    if (onlyActive) {
      result = result.filter((c) => c.is_active);
    }
    return result;
  }, [allCycles, selectedProjectId, onlyActive]);

  const grouped = useMemo(() => {
    const groups = new Map<string, { projectName: string; cycles: CycleItem[] }>();
    filtered.forEach((cycle) => {
      const existing = groups.get(cycle.project_id);
      if (existing) {
        existing.cycles.push(cycle);
      } else {
        groups.set(cycle.project_id, { projectName: cycle.project_name, cycles: [cycle] });
      }
    });
    return Array.from(groups.entries())
      .sort(([, a], [, b]) => a.projectName.localeCompare(b.projectName))
      .map(([projectId, group]) => ({ projectId, ...group }));
  }, [filtered]);

  const activeTotal = allCycles.filter((c) => c.is_active).length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Ciclos"
        subtitle="Sprints y ciclos de trabajo agrupados por proyecto"
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Project filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="project-filter" className="text-xs text-slate-500 whitespace-nowrap">
            Proyecto
          </label>
          <select
            id="project-filter"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={isLoading || projectOptions.length === 0}
            className="text-sm border border-slate-200 rounded-lg bg-white text-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="all">Todos los proyectos</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Active-only toggle */}
        <button
          onClick={() => setOnlyActive((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
            onlyActive
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800'
          }`}
        >
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
              onlyActive ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
            }`}
          >
            {onlyActive && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          Solo Activos
          {activeTotal > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
              {activeTotal}
            </span>
          )}
        </button>
      </div>

      {/* Summary count */}
      {!isLoading && !isError && (
        <p className="text-sm text-slate-500">
          {filtered.length === allCycles.length
            ? `${allCycles.length} ciclo${allCycles.length !== 1 ? 's' : ''} en ${grouped.length} proyecto${grouped.length !== 1 ? 's' : ''}`
            : `${filtered.length} de ${allCycles.length} ciclos`}
        </p>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-8">
          {[...Array(2)].map((_, gi) => (
            <div key={gi}>
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pl-7">
                {[...Array(2)].map((_, i) => (
                  <CycleCardSkeleton key={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="card p-10 text-center">
          <svg
            className="w-12 h-12 text-red-300 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-slate-600 font-medium">No se pudieron cargar los ciclos</p>
          <p className="text-sm text-slate-400 mt-1">Intenta recargar la página</p>
        </div>
      )}

      {/* Empty — no data at all */}
      {!isLoading && !isError && allCycles.length === 0 && (
        <div className="card p-14 text-center">
          <svg
            className="w-16 h-16 text-slate-200 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <p className="text-slate-600 font-semibold text-lg">No hay ciclos sincronizados</p>
          <p className="text-sm text-slate-400 mt-1">Ejecuta una sincronización primero.</p>
        </div>
      )}

      {/* Empty after filters */}
      {!isLoading && !isError && allCycles.length > 0 && filtered.length === 0 && (
        <div className="card p-10 text-center">
          <svg
            className="w-12 h-12 text-slate-200 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
            />
          </svg>
          <p className="text-slate-600 font-medium">Sin resultados</p>
          <p className="text-sm text-slate-400 mt-1">
            Ningún ciclo coincide con los filtros aplicados.
          </p>
        </div>
      )}

      {/* Grouped cycle list */}
      {!isLoading && !isError && grouped.length > 0 && (
        <div className="space-y-8">
          {grouped.map(({ projectId, projectName, cycles }) => (
            <ProjectGroup key={projectId} projectName={projectName} cycles={cycles} />
          ))}
        </div>
      )}
    </div>
  );
}
