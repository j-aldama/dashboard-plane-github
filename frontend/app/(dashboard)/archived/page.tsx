'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/Skeleton';
import { useProjects, ProjectItem } from '@/hooks/useProjects';

type SortField = 'name' | 'total_tasks' | 'completed_tasks' | 'total_bugs';
type SortDirection = 'asc' | 'desc';

function ProjectCardSkeleton() {
  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchivedProjectCard({ project }: { project: ProjectItem }) {
  const completionPct =
    project.total_tasks > 0
      ? Math.round((project.completed_tasks / project.total_tasks) * 100)
      : 0;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="card p-5 flex flex-col gap-4 hover:shadow-md hover:border-blue-200 transition-all duration-150 cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
            {project.name}
          </h3>
          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 text-slate-500">
            {project.identifier}
          </span>
        </div>
        <StatusBadge label="Archivado" variant="neutral" />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Tareas</p>
          <p className="text-lg font-bold text-slate-800 tabular-nums">{project.total_tasks}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Completadas</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{project.completed_tasks}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Pendientes</p>
          <p className="text-lg font-bold text-amber-500 tabular-nums">{project.pending_tasks}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Puntos</p>
          <p className="text-lg font-bold text-slate-700 tabular-nums">{project.total_points}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Pts. completados</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{project.completed_points}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Bugs</p>
          <p className="text-lg font-bold text-red-500 tabular-nums">{project.total_bugs}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">Progreso</span>
          <span className="text-xs font-medium text-slate-600">{completionPct}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Dates */}
      {(project.project_start_date || project.project_end_date) && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 border-t border-slate-100 pt-3 -mb-1">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>
            {project.project_start_date
              ? new Date(project.project_start_date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
              : '--'}
            {' -> '}
            {project.project_end_date
              ? new Date(project.project_end_date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
              : '--'}
          </span>
        </div>
      )}
    </Link>
  );
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'name', label: 'Nombre' },
  { value: 'completed_tasks', label: 'Completadas' },
  { value: 'total_bugs', label: 'Bugs' },
  { value: 'total_tasks', label: 'Total tareas' },
];

export default function ArchivedProjectsPage() {
  const { data, isLoading, isError } = useProjects();

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const allProjects = data?.projects ?? [];

  const archived = useMemo(() => {
    let result = allProjects.filter((p) => p.is_archived);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.identifier.toLowerCase().includes(q),
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else {
        cmp = (a[sortField] as number) - (b[sortField] as number);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [allProjects, search, sortField, sortDir]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Proyectos Terminados"
        subtitle="Proyectos archivados que ya no tienen actividad"
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o identificador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">Ordenar por</label>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="text-sm border border-slate-200 rounded-lg bg-white text-slate-700 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 bg-white"
          >
            {sortDir === 'asc' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Results count */}
      {!isLoading && !isError && (
        <p className="text-sm text-slate-500">
          {archived.length} proyecto{archived.length !== 1 ? 's' : ''} terminado{archived.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="card p-8 text-center">
          <svg className="w-12 h-12 text-red-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-slate-600 font-medium">No se pudieron cargar los proyectos</p>
          <p className="text-sm text-slate-400 mt-1">Intenta recargar la pagina</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && archived.length === 0 && (
        <div className="card p-12 text-center">
          <svg className="w-16 h-16 text-slate-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <p className="text-slate-600 font-semibold text-lg">No hay proyectos archivados</p>
          <p className="text-sm text-slate-400 mt-1">
            Los proyectos archivados en Plane aparecen aqui.
          </p>
        </div>
      )}

      {/* Grid */}
      {!isLoading && !isError && archived.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {archived.map((project) => (
            <ArchivedProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
