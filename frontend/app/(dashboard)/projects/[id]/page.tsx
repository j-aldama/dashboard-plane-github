'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { MetricCard } from '@/components/MetricCard';
import { DataTable, TableColumn } from '@/components/DataTable';
import { MetricCardSkeleton, TableSkeleton, Skeleton } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { useProjectDetail, CycleTask, LabelBreakdown } from '@/hooks/useProjectDetail';

// ---------------------------------------------------------------------------
// Types for DataTable rows (must extend Record<string, unknown>)
// ---------------------------------------------------------------------------

type CycleTaskRow = Record<string, unknown> & {
  id: number;
  title: string;
  state: string;
  assignee: string | null;
  priority: string | null;
  is_bug: boolean;
  is_client_blocker: boolean;
};

type LabelRow = Record<string, unknown> & {
  label: string;
  count: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toCycleTaskRow(t: CycleTask): CycleTaskRow {
  return { ...t } as CycleTaskRow;
}

function toLabelRow(l: LabelBreakdown): LabelRow {
  return { ...l } as LabelRow;
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

function daysRemaining(endDate: string | null): number | null {
  if (!endDate) return null;
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function priorityVariant(priority: string | null): 'error' | 'warning' | 'info' | 'neutral' {
  switch (priority?.toLowerCase()) {
    case 'urgent':
      return 'error';
    case 'high':
      return 'warning';
    case 'medium':
      return 'info';
    default:
      return 'neutral';
  }
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

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const taskColumns: TableColumn<CycleTaskRow>[] = [
  {
    key: 'title',
    label: 'Tarea',
    sortable: true,
    render: (value, row) => (
      <div className="max-w-xs">
        <span className="font-medium text-slate-800 line-clamp-2">{String(value)}</span>
        <div className="flex items-center gap-1 mt-0.5">
          {(row.is_bug as boolean) && (
            <span className="inline-flex items-center px-1.5 py-0 rounded text-xs font-medium bg-red-100 text-red-600">
              Bug
            </span>
          )}
          {(row.is_client_blocker as boolean) && (
            <span className="inline-flex items-center px-1.5 py-0 rounded text-xs font-medium bg-orange-100 text-orange-600">
              Bloqueo
            </span>
          )}
        </div>
      </div>
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
    key: 'assignee',
    label: 'Asignado',
    render: (value) =>
      value ? (
        <span className="text-slate-700">{String(value)}</span>
      ) : (
        <span className="text-slate-400 text-xs italic">Sin asignar</span>
      ),
  },
  {
    key: 'priority',
    label: 'Prioridad',
    sortable: true,
    render: (value) => {
      if (!value) return <span className="text-slate-400 text-xs">—</span>;
      return <StatusBadge label={String(value)} variant={priorityVariant(String(value))} />;
    },
  },
];

const labelColumns: TableColumn<LabelRow>[] = [
  {
    key: 'label',
    label: 'Etiqueta',
    sortable: true,
    render: (value) => (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        {String(value)}
      </span>
    ),
  },
  {
    key: 'count',
    label: 'Tareas',
    sortable: true,
    render: (value) => (
      <span className="font-semibold text-slate-800 tabular-nums">{String(value)}</span>
    ),
  },
];

// ---------------------------------------------------------------------------
// Skeleton for the cycle section
// ---------------------------------------------------------------------------

function CycleSectionSkeleton() {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type TabId = 'tasks' | 'labels' | 'bugs' | 'blockers';

const TABS: { id: TabId; label: string }[] = [
  { id: 'tasks', label: 'Tareas del Ciclo' },
  { id: 'labels', label: 'Labels' },
  { id: 'bugs', label: 'Bugs' },
  { id: 'blockers', label: 'Bloqueos Cliente' },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = String(params.id ?? '');

  const { data, isLoading, isError, refetch } = useProjectDetail(projectId);

  const [activeTab, setActiveTab] = useState<TabId>('tasks');

  // Filtered lists derived from cycle_tasks
  const allTasks = data?.cycle_tasks ?? [];
  const bugTasks = allTasks.filter((t) => t.is_bug);
  const blockerTasks = allTasks.filter((t) => t.is_client_blocker);
  const labelBreakdown = data?.label_breakdown ?? [];

  const cycle = data?.active_cycle ?? null;
  const cyclePct =
    cycle && cycle.total_tasks > 0
      ? Math.round((cycle.completed_tasks / cycle.total_tasks) * 100)
      : 0;

  const daysLeft = cycle ? daysRemaining(cycle.end_date) : null;

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="p-6 space-y-8">
        {/* Header skeleton */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20 rounded" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        {/* Metric cards skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[...Array(7)].map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>

        {/* Cycle section skeleton */}
        <CycleSectionSkeleton />

        {/* Table skeleton */}
        <TableSkeleton rows={6} cols={4} />
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Error state
  // ------------------------------------------------------------------

  if (isError || !data) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="Detalle de Proyecto" />
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
          <p className="text-slate-600 font-medium">No se pudo cargar el proyecto</p>
          <p className="text-sm text-slate-400 mt-1">
            Verifica que el proyecto exista o intenta de nuevo.
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => refetch()}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Reintentar
            </button>
            <Link
              href="/projects"
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Volver a Proyectos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="p-6 space-y-8">
      {/* ----------------------------------------------------------------
          Header
      ---------------------------------------------------------------- */}
      <PageHeader
        title={data.name}
        subtitle={`Detalle del proyecto — ${data.identifier}`}
      >
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-semibold bg-slate-100 text-slate-600">
          {data.identifier}
        </span>
        <StatusBadge
          label={data.is_support ? 'Soporte' : 'Producto'}
          variant={data.is_support ? 'warning' : 'info'}
        />
        <Link
          href="/projects"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Proyectos
        </Link>
      </PageHeader>

      {/* ----------------------------------------------------------------
          Metric Cards (7)
      ---------------------------------------------------------------- */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <MetricCard
          title="Tareas Totales"
          value={data.total_tasks}
        />
        <MetricCard
          title="Completadas"
          value={data.completed_tasks}
        />
        <MetricCard
          title="Pendientes"
          value={data.pending_tasks}
        />
        <MetricCard
          title="Puntos Totales"
          value={data.total_points}
        />
        <MetricCard
          title="Puntos Completados"
          value={data.completed_points}
          subtitle={data.total_points > 0 ? `${Math.round((data.completed_points / data.total_points) * 100)}% completado` : undefined}
        />
        <MetricCard
          title="Bugs"
          value={data.total_bugs}
        />
        <MetricCard
          title="Bloqueos Cliente"
          value={data.total_client_blockers}
        />
      </section>

      {/* ----------------------------------------------------------------
          Ciclo activo
      ---------------------------------------------------------------- */}
      <section>
        <h3 className="text-base font-semibold text-slate-800 mb-3">Ciclo Activo</h3>
        {cycle ? (
          <div className="card p-6 space-y-4">
            {/* Cycle header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-blue-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="font-semibold text-slate-900">{cycle.name}</span>
                <StatusBadge label="Activo" variant="in-progress" />
              </div>
              {daysLeft !== null && (
                <span
                  className={`text-sm font-medium ${daysLeft < 0 ? 'text-red-500' : daysLeft <= 3 ? 'text-amber-500' : 'text-slate-500'}`}
                >
                  {daysLeft < 0
                    ? `Vencido hace ${Math.abs(daysLeft)} día${Math.abs(daysLeft) !== 1 ? 's' : ''}`
                    : daysLeft === 0
                    ? 'Vence hoy'
                    : `${daysLeft} día${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`}
                </span>
              )}
            </div>

            {/* Cycle dates */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
              <span>
                <span className="font-medium text-slate-700">Inicio:</span>{' '}
                {formatDate(cycle.start_date)}
              </span>
              <span>
                <span className="font-medium text-slate-700">Fin:</span>{' '}
                {formatDate(cycle.end_date)}
              </span>
              <span>
                <span className="font-medium text-slate-700">Tareas:</span>{' '}
                {cycle.completed_tasks}
                <span className="text-slate-400">/{cycle.total_tasks}</span>
              </span>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-500">Progreso del ciclo</span>
                <span className="text-xs font-semibold text-slate-700">{cyclePct}%</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${cyclePct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-emerald-600">
                  {cycle.completed_tasks} completada{cycle.completed_tasks !== 1 ? 's' : ''}
                </span>
                <span className="text-xs text-slate-400">
                  {cycle.total_tasks - cycle.completed_tasks} pendiente
                  {cycle.total_tasks - cycle.completed_tasks !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-8 text-center">
            <svg
              className="w-10 h-10 text-slate-200 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <p className="text-slate-500 text-sm font-medium">Sin ciclo activo</p>
            <p className="text-xs text-slate-400 mt-1">
              Este proyecto no tiene un ciclo en curso.
            </p>
          </div>
        )}
      </section>

      {/* ----------------------------------------------------------------
          Tabs + Tables
      ---------------------------------------------------------------- */}
      <section>
        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
          {TABS.map((tab) => {
            const count =
              tab.id === 'tasks'
                ? allTasks.length
                : tab.id === 'labels'
                ? labelBreakdown.length
                : tab.id === 'bugs'
                ? bugTasks.length
                : blockerTasks.length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }
                `}
              >
                {tab.label}
                <span
                  className={`
                    inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-semibold
                    ${activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}
                  `}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'tasks' && (
          <DataTable<CycleTaskRow>
            columns={taskColumns}
            data={allTasks.map(toCycleTaskRow)}
            emptyMessage="No hay tareas en el ciclo activo."
          />
        )}

        {activeTab === 'labels' && (
          <DataTable<LabelRow>
            columns={labelColumns}
            data={labelBreakdown.map(toLabelRow)}
            emptyMessage="No hay etiquetas registradas para este proyecto."
          />
        )}

        {activeTab === 'bugs' && (
          <DataTable<CycleTaskRow>
            columns={taskColumns}
            data={bugTasks.map(toCycleTaskRow)}
            emptyMessage="No hay bugs en el ciclo activo."
          />
        )}

        {activeTab === 'blockers' && (
          <DataTable<CycleTaskRow>
            columns={taskColumns}
            data={blockerTasks.map(toCycleTaskRow)}
            emptyMessage="No hay bloqueos de cliente en el ciclo activo."
          />
        )}
      </section>
    </div>
  );
}
