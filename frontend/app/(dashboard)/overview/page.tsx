"use client";

import { useMemo } from "react";
import { MetricCard } from "@/components/MetricCard";
import { ChartContainer } from "@/components/ChartContainer";
import { RankingTable, Column, Row } from "@/components/RankingTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/Skeleton";
import {
  CheckCircleIcon,
  ClockIcon,
  GitPullRequestIcon,
  FolderIcon,
} from "@/components/icons";
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
} from "recharts";
import {
  usePlaneTeamMetrics,
  useGitHubTeamMetrics,
  mergeMembers,
} from "@/hooks/useOverviewData";

// ── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = ["#1e40af", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"];

const PRIORITY_COLORS: Record<string, string> = {
  Alta: "#ef4444",
  Media: "#f59e0b",
  Baja: "#22c55e",
  "Sin asignar": "#94a3b8",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getEffortStatus(effort: number): "green" | "yellow" | "red" {
  if (effort >= 25) return "green";
  if (effort >= 15) return "yellow";
  return "red";
}

interface PrioritySlice {
  name: string;
  value: number;
  color: string;
}

function buildPriorityDistribution(
  members: { priority_avg: number; tasks_completed: number }[],
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
    { name: "Sin asignar", value: sinAsignar, color: PRIORITY_COLORS["Sin asignar"] },
  ].filter((s) => s.value > 0);
}

// ── Custom tooltip for donut chart ───────────────────────────────────────────

interface DonutPayloadEntry {
  name: string;
  value: number;
  payload: { name: string; value: number; color: string };
}

interface DonutTooltipProps {
  active?: boolean;
  payload?: DonutPayloadEntry[];
}

function DonutTooltip({ active, payload }: DonutTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-slate-700">{entry.name}</p>
      <p className="tabular-nums text-slate-500">{entry.value} tareas</p>
    </div>
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
    label: "PRs Mergeados",
    sortable: true,
    render: (_v, row) => (
      <span className="tabular-nums text-slate-600">
        {String(row.prs_merged)}
      </span>
    ),
  },
  {
    key: "status",
    label: "Tendencia",
    render: (_v, row) => (
      <StatusBadge
        status={row.status as "green" | "yellow" | "red"}
        size="sm"
      />
    ),
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const planeQuery = usePlaneTeamMetrics();
  const githubQuery = useGitHubTeamMetrics();

  const isLoading = planeQuery.isLoading || githubQuery.isLoading;
  const isError = planeQuery.isError || githubQuery.isError;

  // Merge Plane + GitHub members
  const unified = useMemo(() => {
    if (!planeQuery.data || !githubQuery.data) return [];
    return mergeMembers(planeQuery.data.members, githubQuery.data.members);
  }, [planeQuery.data, githubQuery.data]);

  // KPI values
  const totalTasksCompleted = planeQuery.data?.total_tasks_completed ?? 0;
  const totalStoryPoints = planeQuery.data?.total_story_points ?? 0;
  const memberCount = planeQuery.data?.members.length ?? 0;
  const avgStoryPoints =
    memberCount > 0 ? (totalStoryPoints / memberCount).toFixed(1) : "0";
  const totalPrsMerged = useMemo(
    () =>
      githubQuery.data?.members.reduce((acc, m) => acc + m.prs_merged, 0) ?? 0,
    [githubQuery.data],
  );

  // Bar chart data — sorted by story points descending
  const barChartData = useMemo(() => {
    return [...unified]
      .sort((a, b) => b.story_points - a.story_points)
      .map((m) => ({
        name: m.initials,
        fullName: m.name,
        points: m.story_points,
      }));
  }, [unified]);

  // Donut chart data — task distribution by priority
  const donutData = useMemo(() => {
    if (!unified.length) return [];
    return buildPriorityDistribution(unified);
  }, [unified]);

  // Table rows
  const tableRows: Row[] = useMemo(() => {
    return [...unified]
      .sort((a, b) => b.story_points - a.story_points)
      .map((m, i) => ({
        rank: i + 1,
        initials: m.initials,
        name: m.name,
        github_username: m.github_username,
        story_points: m.story_points,
        tasks_completed: m.tasks_completed,
        prs_merged: m.prs_merged,
        status: getEffortStatus(m.relative_effort),
      }));
  }, [unified]);

  // Error state
  if (isError && !isLoading) {
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Vista General del Equipo
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Metricas del periodo seleccionado
        </p>
      </div>

      {/* KPI Metric cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Tareas Completadas"
          value={totalTasksCompleted}
          trend="neutral"
          trendValue="periodo actual"
          icon={<CheckCircleIcon size={18} />}
          loading={isLoading}
        />
        <MetricCard
          title="Story Points Promedio"
          value={avgStoryPoints}
          trend="neutral"
          trendValue="por miembro"
          icon={<ClockIcon size={18} />}
          loading={isLoading}
        />
        <MetricCard
          title="PRs Mergeados"
          value={totalPrsMerged}
          trend="neutral"
          trendValue="periodo actual"
          icon={<GitPullRequestIcon size={18} />}
          loading={isLoading}
        />
        <MetricCard
          title="Miembros Activos"
          value={memberCount}
          trend="neutral"
          trendValue="en el equipo"
          icon={<FolderIcon size={18} />}
          loading={isLoading}
        />
      </div>

      {/* Chart row: bar chart + donut chart */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <ChartContainer
            title="Story Points por Persona"
            subtitle="Ranking del periodo"
            height={Math.max(200, barChartData.length * 44)}
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
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
                formatter={(value: number) => [`${value} pts`, "Story Points"]}
                labelFormatter={(label: string) => {
                  const match = barChartData.find((d) => d.name === label);
                  return match ? match.fullName : label;
                }}
              />
              <Bar dataKey="points" radius={[0, 4, 4, 0]}>
                {barChartData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>

        <div className="xl:col-span-2">
          {isLoading ? (
            <Skeleton variant="chart" />
          ) : donutData.length > 0 ? (
            <ChartContainer
              title="Distribucion por Prioridad"
              subtitle="Tareas completadas"
              height={220}
            >
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
                >
                  {donutData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ChartContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-400">
                Sin datos de prioridad disponibles
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Team summary table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            Ranking del Equipo
          </h2>
          {planeQuery.data?.is_cached && (
            <span className="text-xs text-slate-400">datos en cache</span>
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
