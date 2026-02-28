'use client';

import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, TableColumn } from '@/components/DataTable';
import { TableSkeleton } from '@/components/Skeleton';
import { useComparative, MemberComparative } from '@/hooks/useComparative';

/* ───────────────────────── Types ───────────────────────── */

type MemberRow = Record<string, unknown> & MemberComparative;

type MetricKey =
  | 'tasks_completed'
  | 'points_completed'
  | 'avg_complexity'
  | 'active_workload'
  | 'overdue_tasks'
  | 'commits'
  | 'prs_merged'
  | 'lines_written';

interface MetricOption {
  key: MetricKey;
  label: string;
  shortLabel: string;
}

/* ───────────────────────── Constants ───────────────────── */

const METRIC_OPTIONS: MetricOption[] = [
  { key: 'tasks_completed', label: 'Tareas Completadas', shortLabel: 'Tareas' },
  { key: 'points_completed', label: 'Puntos Completados', shortLabel: 'Puntos' },
  { key: 'avg_complexity', label: 'Complejidad Promedio', shortLabel: 'Complejidad' },
  { key: 'active_workload', label: 'Carga Activa', shortLabel: 'Carga' },
  { key: 'overdue_tasks', label: 'Tareas Atrasadas', shortLabel: 'Atrasadas' },
  { key: 'commits', label: 'Commits', shortLabel: 'Commits' },
  { key: 'prs_merged', label: 'PRs Mergeados', shortLabel: 'PRs' },
  { key: 'lines_written', label: 'Lineas Escritas', shortLabel: 'Lineas' },
];

const MEDAL_COLORS = {
  1: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', hex: '#FFD700' },
  2: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', hex: '#C0C0C0' },
  3: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', hex: '#CD7F32' },
} as const;

const RADAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

/* ───────────────────────── Helpers ───────────────────────── */

function getRankBadge(rank: number | undefined) {
  if (!rank || rank > 3) return null;
  const medal = MEDAL_COLORS[rank as 1 | 2 | 3];
  const labels: Record<number, string> = { 1: '1ro', 2: '2do', 3: '3ro' };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold border ${medal.bg} ${medal.text} ${medal.border}`}
    >
      {labels[rank]}
    </span>
  );
}

function renderMetricWithRank(metricKey: string, value: unknown, row: MemberRow) {
  const numValue = value as number;
  const rank = row.rankings?.[metricKey];
  return (
    <span className="flex items-center gap-2">
      <span className="font-medium tabular-nums">{numValue}</span>
      {getRankBadge(rank)}
    </span>
  );
}

function toMemberRow(m: MemberComparative): MemberRow {
  return { ...m } as MemberRow;
}

/* ───────────────────────── Table columns ────────────────── */

const memberColumns: TableColumn<MemberRow>[] = [
  {
    key: 'name',
    label: 'Miembro',
    sortable: true,
    render: (value, row) => (
      <div className="flex items-center gap-3">
        {row.avatar_url ? (
          <img
            src={row.avatar_url as string}
            alt={String(value)}
            className="w-8 h-8 rounded-full border border-slate-200"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
            {String(value).charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <span className="font-medium text-slate-800">{String(value)}</span>
          {row.github_username && (
            <span className="ml-2 text-xs text-slate-400">@{row.github_username as string}</span>
          )}
        </div>
      </div>
    ),
  },
  {
    key: 'tasks_completed',
    label: 'Tareas',
    sortable: true,
    render: (value, row) => renderMetricWithRank('tasks_completed', value, row),
  },
  {
    key: 'points_completed',
    label: 'Puntos',
    sortable: true,
    render: (value, row) => renderMetricWithRank('points_completed', value, row),
  },
  {
    key: 'avg_complexity',
    label: 'Complejidad',
    sortable: true,
    render: (value, row) => {
      const num = value as number;
      return (
        <span className="flex items-center gap-2">
          <span className="font-medium tabular-nums">{num.toFixed(1)}</span>
          {getRankBadge(row.rankings?.avg_complexity)}
        </span>
      );
    },
  },
  {
    key: 'active_workload',
    label: 'Carga',
    sortable: true,
    render: (value, row) => renderMetricWithRank('active_workload', value, row),
  },
  {
    key: 'overdue_tasks',
    label: 'Atrasadas',
    sortable: true,
    render: (value, row) => {
      const num = value as number;
      return (
        <span className="flex items-center gap-2">
          <span className={`font-medium tabular-nums ${num > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
            {num}
          </span>
          {getRankBadge(row.rankings?.overdue_tasks)}
        </span>
      );
    },
  },
  {
    key: 'commits',
    label: 'Commits',
    sortable: true,
    render: (value, row) => renderMetricWithRank('commits', value, row),
  },
  {
    key: 'prs_merged',
    label: 'PRs',
    sortable: true,
    render: (value, row) => renderMetricWithRank('prs_merged', value, row),
  },
  {
    key: 'lines_written',
    label: 'Lineas',
    sortable: true,
    render: (value, row) => {
      const num = value as number;
      return (
        <span className="flex items-center gap-2">
          <span className="font-medium tabular-nums">{num.toLocaleString()}</span>
          {getRankBadge(row.rankings?.lines_written)}
        </span>
      );
    },
  },
];

/* ───────────────────────── Component ────────────────────── */

export default function ComparativePage() {
  const { data, isLoading, error, refetch } = useComparative();

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('tasks_completed');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

  const members = data?.members ?? [];

  // Client-side sorting
  const sortedMembers = useMemo(() => {
    const rows = members.map(toMemberRow);
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [members, sortKey, sortDir]);

  function handleSort(key: string, direction: 'asc' | 'desc') {
    setSortKey(key);
    setSortDir(direction);
  }

  // Auto-select first 3 members for radar when data loads
  const radarMembers = useMemo(() => {
    if (selectedMembers.size > 0) return selectedMembers;
    const auto = new Set<string>();
    members.slice(0, 3).forEach((m) => auto.add(m.id));
    return auto;
  }, [members, selectedMembers]);

  function toggleMember(id: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      // If no manual selection yet, seed from auto
      if (prev.size === 0) {
        members.slice(0, 3).forEach((m) => next.add(m.id));
      }
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Bar chart data: one metric across all members, sorted desc
  const barChartData = useMemo(() => {
    return [...members]
      .sort((a, b) => (b[selectedMetric] as number) - (a[selectedMetric] as number))
      .map((m) => ({
        name: m.name.split(' ')[0],
        value: m[selectedMetric] as number,
        fullName: m.name,
      }));
  }, [members, selectedMetric]);

  // Radar chart data: normalize metrics for selected members
  const radarChartData = useMemo(() => {
    const activeMemberIds = Array.from(radarMembers);
    const activeMembers = members.filter((m) => activeMemberIds.includes(m.id));
    if (activeMembers.length === 0) return [];

    return METRIC_OPTIONS.map((opt) => {
      const entry: Record<string, string | number> = { metric: opt.shortLabel };
      const maxVal = Math.max(...members.map((m) => m[opt.key] as number), 1);
      activeMembers.forEach((m) => {
        // Normalize to 0-100 scale for radar
        entry[m.name] = Math.round(((m[opt.key] as number) / maxVal) * 100);
      });
      return entry;
    });
  }, [members, radarMembers]);

  const radarMemberNames = useMemo(() => {
    return members
      .filter((m) => radarMembers.has(m.id))
      .map((m) => m.name);
  }, [members, radarMembers]);

  const currentMetricLabel = METRIC_OPTIONS.find((o) => o.key === selectedMetric)?.label ?? '';

  /* ───────── Error state ───────── */
  if (error) {
    return (
      <div className="p-6 space-y-8">
        <PageHeader
          title="Comparativa"
          subtitle="Comparacion de metricas entre miembros del equipo"
        />
        <div className="card p-6 text-center">
          <p className="text-slate-500 text-sm">No se pudieron cargar los datos comparativos.</p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Comparativa"
        subtitle="Comparacion de metricas entre miembros del equipo"
      />

      {/* ───────── Table Section ───────── */}
      <section>
        <h3 className="text-base font-semibold text-slate-800 mb-4">
          Ranking por Miembro
        </h3>
        {isLoading ? (
          <TableSkeleton rows={5} cols={9} />
        ) : (
          <DataTable<MemberRow>
            columns={memberColumns}
            data={sortedMembers}
            onSort={handleSort}
            emptyMessage="No hay datos comparativos para el periodo seleccionado."
          />
        )}
      </section>

      {/* ───────── Charts Section ───────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-semibold text-slate-800">
              Comparativa por Metrica
            </h3>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MetricKey)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {METRIC_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {isLoading ? (
            <div className="h-72 flex items-center justify-center">
              <div className="animate-pulse space-y-3 w-full px-4">
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-56 bg-slate-100 rounded" />
              </div>
            </div>
          ) : barChartData.length === 0 ? (
            <div className="h-72 flex items-center justify-center">
              <p className="text-slate-400 text-sm">No hay datos disponibles.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={barChartData}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                  formatter={(value: number) => [value, currentMetricLabel]}
                  labelFormatter={(label: string) => {
                    const item = barChartData.find((d) => d.name === label);
                    return item?.fullName ?? label;
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="#6366f1"
                  radius={[0, 4, 4, 0]}
                  name={currentMetricLabel}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Radar Chart */}
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">
            Perfil Multi-Metrica
          </h3>

          {/* Member selection checkboxes */}
          <div className="flex flex-wrap gap-2 mb-4">
            {members.map((m, idx) => {
              const isSelected = radarMembers.has(m.id);
              const colorIdx = idx % RADAR_COLORS.length;
              return (
                <label
                  key={m.id}
                  className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors border
                    ${isSelected
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleMember(m.id)}
                    className="sr-only"
                  />
                  {isSelected && (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: RADAR_COLORS[colorIdx] }}
                    />
                  )}
                  {m.name.split(' ')[0]}
                </label>
              );
            })}
          </div>

          {isLoading ? (
            <div className="h-72 flex items-center justify-center">
              <div className="animate-pulse space-y-3 w-full px-4">
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-56 bg-slate-100 rounded" />
              </div>
            </div>
          ) : radarChartData.length === 0 || radarMemberNames.length === 0 ? (
            <div className="h-72 flex items-center justify-center">
              <p className="text-slate-400 text-sm">Selecciona al menos un miembro para ver el perfil.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarChartData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                />
                {radarMemberNames.map((name, idx) => {
                  const memberIndex = members.findIndex((m) => m.name === name);
                  const colorIdx = (memberIndex >= 0 ? memberIndex : idx) % RADAR_COLORS.length;
                  return (
                    <Radar
                      key={name}
                      name={name}
                      dataKey={name}
                      stroke={RADAR_COLORS[colorIdx]}
                      fill={RADAR_COLORS[colorIdx]}
                      fillOpacity={0.15}
                    />
                  );
                })}
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                  formatter={(value: number) => [`${value}%`, '']}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}
