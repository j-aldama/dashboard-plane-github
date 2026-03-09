'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { PageHeader } from '@/components/PageHeader';
import { MetricCard } from '@/components/MetricCard';
import { DataTable, TableColumn } from '@/components/DataTable';
import { MetricCardSkeleton, TableSkeleton } from '@/components/Skeleton';
import {
  useGitHubOverview,
  useGitHubActivity,
  useGitHubByRepo,
  useGitHubByUser,
  RepoMetrics,
  UserMetrics,
} from '@/hooks/useGitHubMetrics';

// ---------------------------------------------------------------------------
// Row types (satisfy Record<string, unknown> for DataTable)
// ---------------------------------------------------------------------------

type RepoRow = Record<string, unknown> & RepoMetrics;
type UserRow = Record<string, unknown> & UserMetrics;

// ---------------------------------------------------------------------------
// Table column definitions
// ---------------------------------------------------------------------------

const repoColumns: TableColumn<RepoRow>[] = [
  {
    key: 'repo_name',
    label: 'Repositorio',
    sortable: true,
    render: (value) => (
      <span className="font-medium text-slate-800">{String(value)}</span>
    ),
  },
  {
    key: 'commits',
    label: 'Commits',
    sortable: true,
    render: (value) => (
      <span className="font-semibold text-blue-600">{String(value)}</span>
    ),
  },
  {
    key: 'prs',
    label: 'PRs',
    sortable: true,
  },
  {
    key: 'lines_added',
    label: 'Líneas +',
    sortable: true,
    render: (value) => (
      <span className="text-emerald-600 font-medium">+{String(value)}</span>
    ),
  },
  {
    key: 'lines_removed',
    label: 'Líneas -',
    sortable: true,
    render: (value) => (
      <span className="text-rose-500 font-medium">-{String(value)}</span>
    ),
  },
];

const userColumns: TableColumn<UserRow>[] = [
  {
    key: 'name',
    label: 'Persona',
    sortable: true,
    render: (value, row) => (
      <div>
        <span className="font-medium text-slate-800">{String(value)}</span>
        {row.github_username && (
          <span className="ml-2 text-xs text-slate-400">
            @{String(row.github_username)}
          </span>
        )}
      </div>
    ),
  },
  {
    key: 'commits',
    label: 'Commits',
    sortable: true,
    render: (value) => (
      <span className="font-semibold text-blue-600">{String(value)}</span>
    ),
  },
  {
    key: 'prs',
    label: 'PRs',
    sortable: true,
  },
  {
    key: 'prs_merged',
    label: 'PRs Merged',
    sortable: true,
    render: (value) => (
      <span className="text-violet-600 font-medium">{String(value)}</span>
    ),
  },
  {
    key: 'lines_added',
    label: 'Líneas +',
    sortable: true,
    render: (value) => (
      <span className="text-emerald-600 font-medium">+{String(value)}</span>
    ),
  },
  {
    key: 'lines_removed',
    label: 'Líneas -',
    sortable: true,
    render: (value) => (
      <span className="text-rose-500 font-medium">-{String(value)}</span>
    ),
  },
];

// ---------------------------------------------------------------------------
// Shared error + retry UI
// ---------------------------------------------------------------------------

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card p-6 text-center">
      <p className="text-slate-500 text-sm">{message}</p>
      <button
        onClick={onRetry}
        className="mt-3 px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart skeleton
// ---------------------------------------------------------------------------

function ChartSkeleton() {
  return (
    <div className="h-64 flex items-center justify-center">
      <div className="animate-pulse space-y-3 w-full px-4">
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-48 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GitHubPage() {
  const overviewQuery = useGitHubOverview();
  const activityQuery = useGitHubActivity();
  const byRepoQuery = useGitHubByRepo();
  const byUserQuery = useGitHubByUser();

  const overview = overviewQuery.data;
  const activityPoints = activityQuery.data?.activity ?? [];
  const repos = (byRepoQuery.data?.repos ?? []) as RepoRow[];
  const users = (byUserQuery.data?.users ?? []) as UserRow[];

  // Data for bar chart: commits por persona
  const commitsPerPersonData = users.map((u) => ({
    name: String(u.name),
    Commits: u.commits as number,
  }));

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="GitHub"
        subtitle="Actividad y métricas de repositorios"
      />

      {/* ── Metric Cards ─────────────────────────────────────────────────── */}
      <section>
        {overviewQuery.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <MetricCardSkeleton key={i} />
            ))}
          </div>
        ) : overviewQuery.error ? (
          <SectionError
            message="No se pudieron cargar las métricas de GitHub."
            onRetry={() => overviewQuery.refetch()}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <MetricCard
              title="Total Commits"
              value={overview?.total_commits ?? 0}
            />
            <MetricCard
              title="Total PRs"
              value={overview?.total_prs ?? 0}
            />
            <MetricCard
              title="PRs Merged"
              value={overview?.total_prs_merged ?? 0}
            />
            <MetricCard
              title="Líneas Añadidas"
              value={overview?.total_lines_added ?? 0}
            />
            <MetricCard
              title="Líneas Eliminadas"
              value={overview?.total_lines_removed ?? 0}
            />
          </div>
        )}
      </section>

      {/* ── Activity Line Chart ───────────────────────────────────────────── */}
      <section className="card p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-6">
          Actividad Temporal (Commits)
        </h3>
        {activityQuery.isLoading ? (
          <ChartSkeleton />
        ) : activityQuery.error ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <p className="text-slate-500 text-sm">
              No se pudo cargar la gráfica de actividad.
            </p>
            <button
              onClick={() => activityQuery.refetch()}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : activityPoints.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <p className="text-slate-400 text-sm">
              No hay datos de actividad para el período seleccionado.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={activityPoints}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val: string) => {
                  const d = new Date(val);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
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
                labelFormatter={(label: string) => {
                  const d = new Date(label);
                  return d.toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });
                }}
              />
              <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '12px' }} />
              <Line
                type="monotone"
                dataKey="commits"
                name="Commits"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ── Bar Chart: commits por persona ───────────────────────────────── */}
      <section className="card p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-6">
          Commits por Persona
        </h3>
        {byUserQuery.isLoading ? (
          <ChartSkeleton />
        ) : byUserQuery.error ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <p className="text-slate-500 text-sm">
              No se pudo cargar la gráfica por persona.
            </p>
            <button
              onClick={() => byUserQuery.refetch()}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : commitsPerPersonData.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <p className="text-slate-400 text-sm">
              No hay datos de commits por persona para el período seleccionado.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={commitsPerPersonData}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
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
              <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '12px' }} />
              <Bar
                dataKey="Commits"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ── Table: por repositorio ────────────────────────────────────────── */}
      <section>
        <h3 className="text-base font-semibold text-slate-800 mb-4">
          Métricas por Repositorio
        </h3>
        {byRepoQuery.isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : byRepoQuery.error ? (
          <SectionError
            message="No se pudo cargar la tabla de repositorios."
            onRetry={() => byRepoQuery.refetch()}
          />
        ) : (
          <DataTable<RepoRow>
            columns={repoColumns}
            data={repos}
            emptyMessage="No hay datos de repositorios para el período seleccionado."
          />
        )}
      </section>

      {/* ── Table: por persona ────────────────────────────────────────────── */}
      <section>
        <h3 className="text-base font-semibold text-slate-800 mb-4">
          Métricas por Persona
        </h3>
        {byUserQuery.isLoading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : byUserQuery.error ? (
          <SectionError
            message="No se pudo cargar la tabla por persona."
            onRetry={() => byUserQuery.refetch()}
          />
        ) : (
          <DataTable<UserRow>
            columns={userColumns}
            data={users}
            emptyMessage="No hay datos de personas para el período seleccionado."
          />
        )}
      </section>
    </div>
  );
}
