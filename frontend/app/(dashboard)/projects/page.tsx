"use client";

import { StatusBadge } from "@/components/StatusBadge";
import { MetricCard } from "@/components/MetricCard";
import { useDateRange } from "@/contexts/DateRangeContext";

// ── Mock data ──────────────────────────────────────────────────────────────────

const projects = [
  {
    id: "p1",
    name: "Portal de Clientes v2",
    type: "dev",
    status: "green" as const,
    progress: 78,
    start: "2026-01-15",
    end: "2026-03-31",
    tasksTotal: 42,
    tasksDone: 33,
    teamSize: 3,
  },
  {
    id: "p2",
    name: "API de Pagos",
    type: "dev",
    status: "yellow" as const,
    progress: 45,
    start: "2026-01-01",
    end: "2026-02-28",
    tasksTotal: 28,
    tasksDone: 13,
    teamSize: 2,
  },
  {
    id: "p3",
    name: "Migración de Infraestructura",
    type: "dev",
    status: "red" as const,
    progress: 20,
    start: "2025-12-01",
    end: "2026-02-15",
    tasksTotal: 35,
    tasksDone: 7,
    teamSize: 4,
  },
  {
    id: "p4",
    name: "Soporte Tier 1",
    type: "support",
    status: "blue" as const,
    progress: 90,
    start: "2026-01-01",
    end: "2026-12-31",
    tasksTotal: 120,
    tasksDone: 108,
    teamSize: 2,
  },
];

function ProgressBar({ value }: { value: number }) {
  const color =
    value >= 70
      ? "bg-green-500"
      : value >= 40
      ? "bg-yellow-400"
      : "bg-red-500";
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100">
      <div
        className={`h-1.5 rounded-full transition-all ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { dateRange } = useDateRange();

  const from = dateRange.from.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
  const to = dateRange.to.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Proyectos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Estado de proyectos · {from} — {to}
        </p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard title="Total proyectos" value={4} />
        <MetricCard title="En tiempo" value={1} trend="up" trendValue="verde" />
        <MetricCard title="En riesgo" value={1} trend="neutral" trendValue="amarillo" />
        <MetricCard title="Atrasados" value={1} trend="down" trendValue="rojo" />
      </div>

      {/* Project cards grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {projects.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-800">{p.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {p.type === "support" ? "Soporte" : "Desarrollo"} ·{" "}
                  {p.start} → {p.end}
                </p>
              </div>
              <StatusBadge status={p.status} size="sm" />
            </div>

            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Progreso</span>
                <span className="font-medium tabular-nums">{p.progress}%</span>
              </div>
              <ProgressBar value={p.progress} />
            </div>

            <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100">
              <div className="pr-4 text-center">
                <p className="text-lg font-bold tabular-nums text-slate-800">
                  {p.tasksDone}
                </p>
                <p className="text-xs text-slate-400">Completadas</p>
              </div>
              <div className="px-4 text-center">
                <p className="text-lg font-bold tabular-nums text-slate-800">
                  {p.tasksTotal - p.tasksDone}
                </p>
                <p className="text-xs text-slate-400">Pendientes</p>
              </div>
              <div className="pl-4 text-center">
                <p className="text-lg font-bold tabular-nums text-slate-800">
                  {p.teamSize}
                </p>
                <p className="text-xs text-slate-400">Miembros</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
