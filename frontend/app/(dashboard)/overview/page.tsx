"use client";

import { useMemo } from "react";
import { MetricCard } from "@/components/MetricCard";
import { ChartContainer } from "@/components/ChartContainer";
import { RankingTable, Column, Row } from "@/components/RankingTable";
import { Skeleton } from "@/components/Skeleton";
import {
  CheckCircleIcon,
  ClockIcon,
  GitPullRequestIcon,
  FolderIcon,
  TrendUpIcon,
  TrendDownIcon,
} from "@/components/icons";
import {
  useTeamOverview,
  memberTrendDirection,
} from "@/hooks/useTeamOverview";
import { UnifiedMember, TrendDirection } from "@/types/overview";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  ResponsiveContainer,
} from "recharts";

// ── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#1e40af",
  "#2563eb",
  "#3b82f6",
  "#60a5fa",
  "#93c5fd",
  "#bfdbfe",
  "#7c3aed",
  "#a78bfa",
];

const PRIORITY_COLORS: Record<string, string> = {
  Alta: "#ef4444",
  Media: "#f59e0b",
  Baja: "#22c55e",
  "Sin asignar": "#94a3b8",
};

// ── Chart data builders ──────────────────────────────────────────────────────

interface BarDataEntry {
  name: string;
  fullName: string;
  points: number;
}

function buildBarData(members: UnifiedMember[]): BarDataEntry[] {
  return members
    .filter((m) => m.story_points > 0)
    .sort((a, b) => b.story_points - a.story_points)
    .slice(0, 8)
    .map((m) => ({
      name: m.initials,
      fullName: m.name,
      points: m.story_points,
    }));
}

interface PrioritySlice {
  name: string;
  value: number;
  color: string;
}

function buildPriorityDistribution(
  members: UnifiedMember[],
): PrioritySlice[] {
  let alta = 0;
  let media = 0;
  let baja = 0;
  let sinAsignar = 0;

  for (const m of members) {
    const avg = m.priority_avg;
    const tasks = m.tasks_completed;
    if (avg === 0) {
      sinAsignar += tasks;
    } else if (avg >= 3) {
      alta += tasks;
    } else if (avg >= 2) {
      media += tasks;
    } else {
      baja += tasks;
    }
  }

  return [
    { name: "Alta", value: alta, color: PRIORITY_COLORS["Alta"] },
    { name: "Media", value: media, color: PRIORITY_COLORS["Media"] },
    { name: "Baja", value: baja, color: PRIORITY_COLORS["Baja"] },
    {
      name: "Sin asignar",
      value: sinAsignar,
      color: PRIORITY_COLORS["Sin asignar"],
    },
  ].filter((s) => s.value > 0);
}

// ── Custom tooltip for horizontal bar chart ──────────────────────────────────

interface BarTooltipPayloadItem {
  payload: BarDataEntry;
}

function BarChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: BarTooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-800">{data.fullName}</p>
      <p className="text-slate-500">
        Story Points:{" "}
        <span className="font-bold text-blue-700">{data.points}</span>
      </p>
    </div>
  );
}

// ── Custom tooltip for donut chart ───────────────────────────────────────────

interface DonutPayloadEntry {
  name: string;
  value: number;
  payload: PrioritySlice;
}

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: DonutPayloadEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-slate-700">{entry.name}</p>
      <p className="tabular-nums text-slate-500">{entry.value} tareas</p>
    </div>
  );
}

// ── Trend arrow component ────────────────────────────────────────────────────

function MemberTrendArrow({ direction }: { direction: TrendDirection }) {
  if (direction === "up") {
    return (
      <span className="inline-flex items-center text-green-600">
        <TrendUpIcon size={14} />
      </span>
    );
  }
  if (direction === "down") {
    return (
      <span className="inline-flex items-center text-red-500">
        <TrendDownIcon size={14} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-slate-400">
      <span className="text-base leading-none">--</span>
    </span>
  );
}

// ── Table columns ────────────────────────────────────────────────────────────

const memberColumns: Column[] = [
  {
    key: "rank",
    label: "#",
    render: (_v, row) => (
      <span className="font-bold text-slate-400">{String(row.rank)}</span>
    ),
  },
  {
    key: "name",
    label: "Miembro",
    render: (_v, row) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
          {String(row.initials)}
        </div>
        <div>
          <p className="font-medium text-slate-800">{String(row.name)}</p>
          {typeof row.github_username === "string" && row.github_username && (
            <p className="text-xs text-slate-400">
              @{row.github_username}
            </p>
          )}
        </div>
      </div>
    ),
  },
  {
    key: "story_points",
    label: "Story Points",
    sortable: true,
    render: (_v, row) => (
      <span className="font-semibold tabular-nums text-slate-700">
        {String(row.story_points)}
      </span>
    ),
  },
  {
    key: "tasks_completed",
    label: "Tareas",
    sortable: true,
    render: (_v, row) => (
      <span className="tabular-nums text-slate-600">
        {String(row.tasks_completed)}
      </span>
    ),
  },
  {
    key: "prs_merged",
    label: "PRs Merged",
    sortable: true,
    render: (_v, row) => (
      <span className="tabular-nums text-slate-600">
        {String(row.prs_merged)}
      </span>
    ),
  },
  {
    key: "commits",
    label: "Commits",
    sortable: true,
    render: (_v, row) => (
      <span className="tabular-nums text-slate-600">
        {String(row.commits)}
      </span>
    ),
  },
  {
    key: "trend",
    label: "Tendencia",
    render: (_v, row) => (
      <MemberTrendArrow direction={row.trend_direction as TrendDirection} />
    ),
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { members, kpis, trends, isLoading, isError } = useTeamOverview();

  const barChartData = useMemo(() => buildBarData(members), [members]);
  const donutData = useMemo(
    () => buildPriorityDistribution(members),
    [members],
  );

  const tableRows: Row[] = useMemo(
    () =>
      members.map((m, i) => ({
        rank: i + 1,
        name: m.name,
        avatar_url: m.avatar_url,
        initials: m.initials,
        github_username: m.github_username,
        story_points: m.story_points,
        tasks_completed: m.tasks_completed,
        prs_merged: m.prs_merged,
        commits: m.commits,
        trend_direction: memberTrendDirection(m),
      })),
    [members],
  );

  // Error state
  if (isError && !isLoading && members.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Vista General del Equipo
          </h1>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">
            No se pudieron cargar los datos
          </p>
          <p className="mt-1 text-xs text-red-500">
            Verifica que el backend este corriendo e intenta de nuevo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Vista General del Equipo
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Metricas agregadas del periodo seleccionado
        </p>
      </div>

      {/* KPI Metric cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Tareas Completadas"
          value={kpis.totalTasksCompleted}
          trend={trends.tasks.direction}
          trendValue={trends.tasks.label}
          icon={<CheckCircleIcon size={18} />}
          loading={isLoading}
        />
        <MetricCard
          title="Story Points Promedio"
          value={kpis.avgStoryPoints}
          trend={trends.points.direction}
          trendValue={trends.points.label}
          icon={<ClockIcon size={18} />}
          loading={isLoading}
        />
        <MetricCard
          title="PRs Mergeados"
          value={kpis.totalPrsMerged}
          trend={trends.prs.direction}
          trendValue={trends.prs.label}
          icon={<GitPullRequestIcon size={18} />}
          loading={isLoading}
        />
        <MetricCard
          title="Proyectos Activos"
          value={kpis.activeProjects}
          trend={trends.projects.direction}
          trendValue={trends.projects.label}
          icon={<FolderIcon size={18} />}
          loading={isLoading}
        />
      </div>

      {/* Chart row: horizontal bar chart + donut chart */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Horizontal bar chart: ranking by fibonacci points */}
        <div className="xl:col-span-3">
          <ChartContainer
            title="Ranking por Story Points (Fibonacci)"
            subtitle="Top miembros del periodo"
            height={Math.max(220, barChartData.length * 44)}
            loading={isLoading}
          >
            <BarChart
              data={barChartData}
              layout="vertical"
              margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                width={48}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                content={<BarChartTooltip />}
                cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
              />
              <Bar
                dataKey="points"
                radius={[0, 4, 4, 0]}
                name="Story Points"
              >
                {barChartData.map((_, index) => (
                  <Cell
                    key={`bar-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>

        {/* Donut chart: task distribution by priority */}
        <div className="xl:col-span-2">
          {isLoading ? (
            <Skeleton variant="chart" />
          ) : donutData.length > 0 ? (
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-700">
                  Distribucion por Prioridad
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Tareas completadas por nivel de prioridad
                </p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    strokeWidth={2}
                    stroke="#fff"
                  >
                    {donutData.map((entry, idx) => (
                      <Cell key={`pie-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="mt-2 flex flex-wrap justify-center gap-4">
                {donutData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-xs text-slate-500">
                      {entry.name} ({entry.value})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-400">
                Sin datos de prioridad disponibles
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Summary table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">
              Resumen del Equipo
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Metricas unificadas Plane + GitHub por miembro
            </p>
          </div>
          {!isLoading && (
            <span className="text-xs text-slate-400">
              {members.length} miembro{members.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <RankingTable
          columns={memberColumns}
          data={tableRows}
          defaultSort="story_points"
          loading={isLoading}
        />
      </div>
    </div>
  );
}
