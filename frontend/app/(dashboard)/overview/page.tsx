"use client";

import { MetricCard } from "@/components/MetricCard";
import { ChartContainer } from "@/components/ChartContainer";
import { RankingTable, Column, Row } from "@/components/RankingTable";
import { StatusBadge } from "@/components/StatusBadge";
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
} from "recharts";

// ── Mock data ──────────────────────────────────────────────────────────────────

const teamChartData = [
  { name: "Ana R.", points: 34 },
  { name: "Luis M.", points: 28 },
  { name: "Carlos P.", points: 22 },
  { name: "María T.", points: 19 },
  { name: "Jorge S.", points: 15 },
];

const chartColors = ["#1e40af", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"];

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
          <p className="text-xs text-slate-400">{String(row.role)}</p>
        </div>
      </div>
    ),
  },
  {
    key: "points",
    label: "Story Points",
    sortable: true,
    render: (_v, row) => (
      <span className="font-semibold tabular-nums text-slate-700">
        {String(row.points)}
      </span>
    ),
  },
  {
    key: "tasks",
    label: "Tareas",
    sortable: true,
    render: (_v, row) => (
      <span className="tabular-nums text-slate-600">{String(row.tasks)}</span>
    ),
  },
  {
    key: "prs",
    label: "PRs",
    sortable: true,
    render: (_v, row) => (
      <span className="tabular-nums text-slate-600">{String(row.prs)}</span>
    ),
  },
  {
    key: "status",
    label: "Estado",
    render: (_v, row) => (
      <StatusBadge
        status={row.status as "green" | "yellow" | "red" | "blue"}
        size="sm"
      />
    ),
  },
];

const memberRows: Row[] = [
  {
    rank: 1,
    initials: "AR",
    name: "Ana Rodríguez",
    role: "Senior Dev",
    points: 34,
    tasks: 12,
    prs: 8,
    status: "green",
  },
  {
    rank: 2,
    initials: "LM",
    name: "Luis Martínez",
    role: "Full Stack Dev",
    points: 28,
    tasks: 10,
    prs: 6,
    status: "green",
  },
  {
    rank: 3,
    initials: "CP",
    name: "Carlos Pérez",
    role: "Frontend Dev",
    points: 22,
    tasks: 9,
    prs: 4,
    status: "yellow",
  },
  {
    rank: 4,
    initials: "MT",
    name: "María Torres",
    role: "Backend Dev",
    points: 19,
    tasks: 7,
    prs: 3,
    status: "yellow",
  },
  {
    rank: 5,
    initials: "JS",
    name: "Jorge Sánchez",
    role: "QA Engineer",
    points: 15,
    tasks: 6,
    prs: 2,
    status: "red",
  },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Vista General del Equipo
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Métricas del período seleccionado — datos de ejemplo
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Tareas Completadas"
          value={54}
          trend="up"
          trendValue="+12% vs período anterior"
          icon={<CheckCircleIcon size={18} />}
        />
        <MetricCard
          title="Story Points Promedio"
          value="23.6"
          trend="up"
          trendValue="+5 puntos"
          icon={<ClockIcon size={18} />}
        />
        <MetricCard
          title="PRs Mergeados"
          value={23}
          trend="neutral"
          trendValue="igual que antes"
          icon={<GitPullRequestIcon size={18} />}
        />
        <MetricCard
          title="Proyectos Activos"
          value={4}
          trend="down"
          trendValue="-1 proyecto"
          icon={<FolderIcon size={18} />}
        />
      </div>

      {/* Chart + Table */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <ChartContainer
            title="Story Points por Persona"
            subtitle="Ranking del período"
            height={260}
          >
            <BarChart
              data={teamChartData}
              layout="vertical"
              margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                width={64}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              />
              <Bar dataKey="points" radius={[0, 4, 4, 0]}>
                {teamChartData.map((_, index) => (
                  <Cell key={index} fill={chartColors[index]} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>

        <div className="xl:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Ranking del Equipo
            </h2>
          </div>
          <RankingTable
            columns={memberColumns}
            data={memberRows}
            defaultSort="points"
          />
        </div>
      </div>
    </div>
  );
}
