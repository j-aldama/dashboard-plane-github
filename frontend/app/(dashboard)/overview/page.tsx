'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PageHeader } from '@/components/PageHeader';
import { MetricCard } from '@/components/MetricCard';
import { DataTable, TableColumn } from '@/components/DataTable';
import { MetricCardSkeleton, TableSkeleton } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { useOverviewMetrics, useProjectsMetrics, ProjectMetrics } from '@/hooks/useOverviewData';

type ProjectRow = Record<string, unknown> & {
  id: number;
  name: string;
  identifier: string;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  total_points: number;
  completed_points: number;
  total_bugs: number;
  active_cycle: string | null;
  is_support: boolean;
};

const projectColumns: TableColumn<ProjectRow>[] = [
  {
    key: 'name',
    label: 'Proyecto',
    sortable: true,
    render: (value, row) => (
      <div>
        <span className="font-medium text-slate-800">{String(value)}</span>
        <span className="ml-2 text-xs text-slate-400">{row.identifier as string}</span>
      </div>
    ),
  },
  {
    key: 'total_tasks',
    label: 'Tareas',
    sortable: true,
  },
  {
    key: 'completed_tasks',
    label: 'Completadas',
    sortable: true,
    render: (value) => (
      <span className="text-emerald-600 font-medium">{String(value)}</span>
    ),
  },
  {
    key: 'pending_tasks',
    label: 'Pendientes',
    sortable: true,
    render: (value) => (
      <span className="text-rose-500 font-medium">{String(value)}</span>
    ),
  },
  {
    key: 'completed_points',
    label: 'Puntos',
    sortable: true,
    render: (value, row) => (
      <span>
        {String(value)}<span className="text-slate-400">/{String(row.total_points)}</span>
      </span>
    ),
  },
  {
    key: 'total_bugs',
    label: 'Bugs',
    sortable: true,
    render: (value) => {
      const bugs = value as number;
      return (
        <span className={bugs > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}>
          {bugs}
        </span>
      );
    },
  },
  {
    key: 'active_cycle',
    label: 'Ciclo Actual',
    render: (value) => {
      if (!value) return <span className="text-slate-400 text-xs">Sin ciclo</span>;
      return <StatusBadge label={String(value)} variant="in-progress" />;
    },
  },
  {
    key: 'is_support',
    label: 'Tipo',
    render: (value) => (
      value
        ? <StatusBadge label="Soporte" variant="warning" />
        : <StatusBadge label="Producto" variant="info" />
    ),
  },
];

function toProjectRow(p: ProjectMetrics): ProjectRow {
  return { ...p } as ProjectRow;
}

export default function OverviewPage() {
  const metricsQuery = useOverviewMetrics();
  const projectsQuery = useProjectsMetrics();

  const metrics = metricsQuery.data;
  const projects = projectsQuery.data?.projects ?? [];

  const isLoadingMetrics = metricsQuery.isLoading;
  const isLoadingProjects = projectsQuery.isLoading;

  const metricsError = metricsQuery.error;
  const projectsError = projectsQuery.error;

  const chartData = projects.map((p) => ({
    name: p.identifier || p.name,
    Completadas: p.completed_tasks,
    Pendientes: p.pending_tasks,
  }));

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Overview"
        subtitle="Resumen de métricas del equipo"
      />

      {/* Metric Cards */}
      <section>
        {isLoadingMetrics ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <MetricCardSkeleton key={i} />
            ))}
          </div>
        ) : metricsError ? (
          <div className="card p-6 text-center">
            <p className="text-slate-500 text-sm">No se pudieron cargar las métricas generales.</p>
            <button
              onClick={() => metricsQuery.refetch()}
              className="mt-3 px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard
              title="Total Tareas"
              value={metrics?.total_tasks ?? 0}
            />
            <MetricCard
              title="Completadas"
              value={metrics?.completed_tasks ?? 0}
            />
            <MetricCard
              title="Pendientes"
              value={metrics?.pending_tasks ?? 0}
            />
            <MetricCard
              title="Puntos Completados"
              value={metrics?.completed_points ?? 0}
              subtitle={`de ${metrics?.total_points ?? 0} totales`}
            />
            <MetricCard
              title="Ciclos Activos"
              value={metrics?.active_cycles ?? 0}
              subtitle={`de ${metrics?.total_cycles ?? 0} totales`}
            />
            <MetricCard
              title="Bugs"
              value={metrics?.total_bugs ?? 0}
            />
          </div>
        )}
      </section>

      {/* Bar Chart */}
      <section className="card p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-6">
          Tareas por Proyecto
        </h3>
        {isLoadingProjects ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse space-y-3 w-full px-4">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-48 bg-slate-100 rounded" />
            </div>
          </div>
        ) : projectsError ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <p className="text-slate-500 text-sm">No se pudo cargar la gráfica de proyectos.</p>
            <button
              onClick={() => projectsQuery.refetch()}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <p className="text-slate-400 text-sm">No hay datos de proyectos disponibles.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '13px', paddingTop: '12px' }}
              />
              <Bar dataKey="Completadas" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Pendientes" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Projects Table */}
      <section>
        <h3 className="text-base font-semibold text-slate-800 mb-4">
          Resumen por Proyecto
        </h3>
        {isLoadingProjects ? (
          <TableSkeleton rows={5} cols={8} />
        ) : projectsError ? (
          <div className="card p-6 text-center">
            <p className="text-slate-500 text-sm">No se pudo cargar la tabla de proyectos.</p>
            <button
              onClick={() => projectsQuery.refetch()}
              className="mt-3 px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <DataTable<ProjectRow>
            columns={projectColumns}
            data={projects.map(toProjectRow)}
            emptyMessage="No hay proyectos disponibles para el período seleccionado."
          />
        )}
      </section>
    </div>
  );
}
