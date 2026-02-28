'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PageHeader } from '@/components/PageHeader';
import { MetricCard } from '@/components/MetricCard';
import { DataTable, TableColumn } from '@/components/DataTable';
import { MetricCardSkeleton, TableSkeleton, Skeleton } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { usePersonMetrics, usePersonGitHubActivity, PersonTask, PersonPR } from '@/hooks/usePersonData';

// ---------------------------------------------------------------------------
// Row types (must extend Record<string, unknown>)
// ---------------------------------------------------------------------------

type TaskRow = Record<string, unknown> & {
  id: number;
  title: string;
  project: string;
  state: string;
  points: number | null;
  cycle: string | null;
  is_bug: boolean;
};

type PRRow = Record<string, unknown> & {
  id: number;
  title: string;
  repo: string;
  state: string;
  merged_at: string | null;
  created_at: string;
  url: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toTaskRow(t: PersonTask): TaskRow {
  return { ...t } as TaskRow;
}

function toPRRow(p: PersonPR): PRRow {
  return { ...p } as PRRow;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function stateVariant(
  state: string,
): 'done' | 'in-progress' | 'pending' | 'cancelled' | 'neutral' {
  const lower = state.toLowerCase();
  if (lower.includes('done') || lower.includes('completad')) return 'done';
  if (lower.includes('progress') || lower.includes('progreso')) return 'in-progress';
  if (lower.includes('cancel')) return 'cancelled';
  if (lower.includes('pend') || lower.includes('backlog') || lower.includes('todo'))
    return 'pending';
  return 'neutral';
}

function prStateVariant(state: string): 'done' | 'in-progress' | 'cancelled' | 'neutral' {
  const lower = state.toLowerCase();
  if (lower === 'merged') return 'done';
  if (lower === 'open') return 'in-progress';
  if (lower === 'closed') return 'cancelled';
  return 'neutral';
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const taskColumns: TableColumn<TaskRow>[] = [
  {
    key: 'title',
    label: 'Tarea',
    sortable: true,
    render: (value, row) => (
      <div className="max-w-xs">
        <span className="font-medium text-slate-800 line-clamp-2">{String(value)}</span>
        {(row.is_bug as boolean) && (
          <span className="inline-flex items-center px-1.5 py-0 rounded text-xs font-medium bg-red-100 text-red-600 mt-0.5">
            Bug
          </span>
        )}
      </div>
    ),
  },
  {
    key: 'project',
    label: 'Proyecto',
    sortable: true,
    render: (value) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 text-slate-600">
        {String(value)}
      </span>
    ),
  },
  {
    key: 'state',
    label: 'Estado',
    sortable: true,
    render: (value) => (
      <StatusBadge label={String(value)} variant={stateVariant(String(value))} />
    ),
  },
  {
    key: 'points',
    label: 'Puntos',
    sortable: true,
    render: (value) =>
      value !== null ? (
        <span className="font-semibold text-slate-800 tabular-nums">{String(value)}</span>
      ) : (
        <span className="text-slate-400 text-xs">—</span>
      ),
  },
  {
    key: 'cycle',
    label: 'Ciclo',
    render: (value) =>
      value ? (
        <span className="text-slate-600 text-sm truncate max-w-[10rem] block">{String(value)}</span>
      ) : (
        <span className="text-slate-400 text-xs italic">Sin ciclo</span>
      ),
  },
];

const prColumns: TableColumn<PRRow>[] = [
  {
    key: 'title',
    label: 'Título',
    sortable: true,
    render: (value, row) => (
      <div className="max-w-xs">
        {(row.url as string | null) ? (
          <a
            href={String(row.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 hover:underline line-clamp-2"
          >
            {String(value)}
          </a>
        ) : (
          <span className="font-medium text-slate-800 line-clamp-2">{String(value)}</span>
        )}
      </div>
    ),
  },
  {
    key: 'repo',
    label: 'Repo',
    sortable: true,
    render: (value) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-600">
        {String(value)}
      </span>
    ),
  },
  {
    key: 'state',
    label: 'Estado',
    sortable: true,
    render: (value) => {
      const label =
        String(value) === 'merged'
          ? 'Merged'
          : String(value) === 'open'
          ? 'Abierto'
          : String(value) === 'closed'
          ? 'Cerrado'
          : String(value);
      return <StatusBadge label={label} variant={prStateVariant(String(value))} />;
    },
  },
  {
    key: 'merged_at',
    label: 'Fecha Merge',
    sortable: true,
    render: (value) => (
      <span className="text-slate-600 tabular-nums">{formatDate(value as string | null)}</span>
    ),
  },
];

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Plane section */}
      <div>
        <Skeleton className="h-5 w-24 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
      </div>

      <TableSkeleton rows={5} cols={5} />

      {/* GitHub section */}
      <div>
        <Skeleton className="h-5 w-24 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
      </div>

      <Skeleton className="h-56 w-full rounded-xl" />
      <TableSkeleton rows={5} cols={4} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task filter
// ---------------------------------------------------------------------------

type TaskStateFilter = 'all' | 'active' | 'done';

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PersonDetailPage() {
  const params = useParams();
  const userId = String(params.id ?? '');

  const {
    data: metricsData,
    isLoading: metricsLoading,
    isError: metricsError,
    refetch: refetchMetrics,
  } = usePersonMetrics(userId);

  const {
    data: githubData,
    isLoading: githubLoading,
    isError: githubError,
    refetch: refetchGitHub,
  } = usePersonGitHubActivity(userId);

  const [taskFilter, setTaskFilter] = useState<TaskStateFilter>('all');
  const [taskSearch, setTaskSearch] = useState('');

  const isLoading = metricsLoading || githubLoading;
  const isError = (metricsError && githubError) || (!metricsLoading && metricsError);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const allTasks = metricsData?.assigned_tasks ?? [];

  const filteredTasks = useMemo(() => {
    let result = [...allTasks];

    if (taskSearch.trim()) {
      const q = taskSearch.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.project.toLowerCase().includes(q),
      );
    }

    if (taskFilter === 'active') {
      result = result.filter((t) => !stateVariant(t.state).includes('done'));
    } else if (taskFilter === 'done') {
      result = result.filter((t) => stateVariant(t.state) === 'done');
    }

    return result;
  }, [allTasks, taskSearch, taskFilter]);

  const recentPRs = githubData?.recent_prs ?? [];
  const weeklyCommits = githubData?.weekly_commits ?? [];

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return <PageSkeleton />;
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (isError || !metricsData) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="Detalle de Persona" />
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
          <p className="text-slate-600 font-medium">No se pudieron cargar los datos del miembro</p>
          <p className="text-sm text-slate-400 mt-1">
            Verifica que el usuario exista o intenta de nuevo.
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => {
                refetchMetrics();
                refetchGitHub();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Reintentar
            </button>
            <Link
              href="/person"
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Volver a Personas
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const initials = getInitials(metricsData.display_name);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-8">
      {/* ----------------------------------------------------------------
          Header — avatar + datos del miembro
      ---------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          {metricsData.avatar_url ? (
            <img
              src={metricsData.avatar_url}
              alt={metricsData.display_name}
              className="w-16 h-16 rounded-full object-cover flex-shrink-0 border-2 border-slate-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 border-2 border-slate-200">
              <span className="text-white text-xl font-bold">{initials}</span>
            </div>
          )}

          {/* Info */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{metricsData.display_name}</h2>
            {metricsData.email && (
              <p className="text-sm text-slate-500 mt-0.5">{metricsData.email}</p>
            )}
            {metricsData.github_username && (
              <a
                href={`https://github.com/${metricsData.github_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                @{metricsData.github_username}
              </a>
            )}
          </div>
        </div>

        {/* Back link */}
        <Link
          href="/person"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors self-start"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Personas
        </Link>
      </div>

      {/* ----------------------------------------------------------------
          Sección Plane — MetricCards
      ---------------------------------------------------------------- */}
      <section>
        <h3 className="text-base font-semibold text-slate-800 mb-4">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Plane
          </span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCard
            title="Tareas Completadas"
            value={metricsData.completed_tasks}
          />
          <MetricCard
            title="Puntos"
            value={metricsData.completed_points}
          />
          <MetricCard
            title="Carga Activa"
            value={metricsData.active_tasks}
          />
          <MetricCard
            title="Atrasadas"
            value={metricsData.overdue_tasks}
          />
          <MetricCard
            title="Bugs"
            value={metricsData.bug_tasks}
          />
        </div>
      </section>

      {/* ----------------------------------------------------------------
          Tabla de tareas asignadas
      ---------------------------------------------------------------- */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-base font-semibold text-slate-800">
            Tareas Asignadas
            <span className="ml-2 inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
              {filteredTasks.length}
            </span>
          </h3>

          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search */}
            <div className="relative">
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
                placeholder="Buscar tarea o proyecto..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="w-full sm:w-56 pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* State filter tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {(
                [
                  { value: 'all', label: 'Todas' },
                  { value: 'active', label: 'Activas' },
                  { value: 'done', label: 'Completadas' },
                ] as { value: TaskStateFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setTaskFilter(tab.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    taskFilter === tab.value
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DataTable<TaskRow>
          columns={taskColumns}
          data={filteredTasks.map(toTaskRow)}
          emptyMessage="No hay tareas asignadas para los filtros seleccionados."
        />
      </section>

      {/* ----------------------------------------------------------------
          Sección GitHub — MetricCards
      ---------------------------------------------------------------- */}
      <section>
        <h3 className="text-base font-semibold text-slate-800 mb-4">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </span>
        </h3>

        {githubError || !githubData ? (
          <div className="card p-8 text-center">
            <svg
              className="w-10 h-10 text-slate-200 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-slate-500 text-sm font-medium">
              No hay datos de GitHub disponibles
            </p>
            <p className="text-xs text-slate-400 mt-1">
              El usuario puede no tener un username de GitHub asociado.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <MetricCard
                title="Commits"
                value={githubData.commits}
              />
              <MetricCard
                title="Pull Requests"
                value={githubData.pull_requests}
              />
              <MetricCard
                title="PRs Mergeados"
                value={githubData.prs_merged}
              />
              <MetricCard
                title="Líneas Escritas"
                value={githubData.lines_added.toLocaleString('es-AR')}
              />
              <MetricCard
                title="Líneas Eliminadas"
                value={githubData.lines_deleted.toLocaleString('es-AR')}
              />
            </div>

            {/* ----------------------------------------------------------------
                Gráfica de actividad temporal — commits por semana
            ---------------------------------------------------------------- */}
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">
                Actividad semanal — últimos 3 meses
              </h4>
              {weeklyCommits.length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="text-slate-400 text-sm">Sin datos de actividad semanal.</p>
                </div>
              ) : (
                <div className="card p-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={weeklyCommits}
                      margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        width={32}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#1e293b',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#f8fafc',
                          fontSize: '12px',
                          padding: '8px 12px',
                        }}
                        labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                        formatter={(value: number) => [value, 'Commits']}
                      />
                      <Line
                        type="monotone"
                        dataKey="commits"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: '#2563eb', strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* ----------------------------------------------------------------
                Tabla de PRs recientes
            ---------------------------------------------------------------- */}
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">
                Pull Requests recientes
              </h4>
              <DataTable<PRRow>
                columns={prColumns}
                data={recentPRs.map(toPRRow)}
                emptyMessage="No hay pull requests recientes."
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
