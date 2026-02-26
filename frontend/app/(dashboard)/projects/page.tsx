"use client";

import { useState, useMemo } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { MetricCard } from "@/components/MetricCard";
import { ChartContainer } from "@/components/ChartContainer";
import { Skeleton } from "@/components/Skeleton";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useProjects, useProjectCycles, useProjectCycleAnalysis } from "@/hooks/useProjects";
import { ProjectInfo, ProjectStatusSummary, BurndownPoint, TaskDistribution } from "@/types/projects";
import { CycleInfo } from "@/types/cycles";
import { StatusColor } from "@/types";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";

// ── Traffic light logic ─────────────────────────────────────────────────────

function computeProjectStatus(project: ProjectInfo): StatusColor {
  if (project.project_type === "support") return "blue";
  if (project.status) return project.status;

  const progress = project.progress_pct ?? 0;

  if (!project.start_date || !project.end_date) {
    return progress >= 60 ? "green" : progress >= 30 ? "yellow" : "red";
  }

  const start = new Date(project.start_date).getTime();
  const end = new Date(project.end_date).getTime();
  const now = Date.now();
  const totalDuration = end - start;
  const elapsed = now - start;

  if (totalDuration <= 0) return "green";

  const timeProgress = Math.min(100, (elapsed / totalDuration) * 100);
  const diff = progress - timeProgress;

  if (diff >= -10) return "green";
  if (diff >= -25) return "yellow";
  return "red";
}

function computeStatusSummary(projects: ProjectInfo[]): ProjectStatusSummary {
  const summary: ProjectStatusSummary = { total: projects.length, green: 0, yellow: 0, red: 0, blue: 0 };
  for (const p of projects) {
    const status = computeProjectStatus(p);
    summary[status] += 1;
  }
  return summary;
}

// ── Burndown chart data builder ─────────────────────────────────────────────

function buildBurndownData(cycle: CycleInfo): BurndownPoint[] {
  if (!cycle.start_date || !cycle.end_date) return [];

  const start = new Date(cycle.start_date);
  const end = new Date(cycle.end_date);
  const now = new Date();
  const totalTasks = cycle.tasks_assigned;

  if (totalTasks === 0) return [];

  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const dailyBurn = totalTasks / totalDays;
  const remaining = totalTasks - cycle.tasks_completed;
  const elapsedDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  const points: BurndownPoint[] = [];
  const steps = Math.min(totalDays, 10);
  const stepSize = totalDays / steps;

  for (let i = 0; i <= steps; i++) {
    const day = Math.round(i * stepSize);
    const dateMs = start.getTime() + day * 24 * 60 * 60 * 1000;
    const date = new Date(dateMs);
    const label = date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });

    const idealRemaining = Math.max(0, totalTasks - dailyBurn * day);

    let actualRemaining: number | undefined;
    if (day <= elapsedDays) {
      const progressRatio = elapsedDays > 0 ? day / elapsedDays : 1;
      const completedByDay = cycle.tasks_completed * progressRatio;
      actualRemaining = Math.max(0, totalTasks - completedByDay);
    }

    points.push({
      date: label,
      ideal: Math.round(idealRemaining),
      actual: actualRemaining !== undefined ? Math.round(actualRemaining) : Math.round(idealRemaining),
    });
  }

  return points;
}

// ── Task distribution for a cycle ───────────────────────────────────────────

function buildTaskDistribution(cycle: CycleInfo): TaskDistribution[] {
  const done = cycle.tasks_completed;
  const total = cycle.tasks_assigned;
  const inProgress = Math.round((total - done) * 0.4);
  const backlog = total - done - inProgress;

  return [
    { name: "Completadas", value: done, color: "#22c55e" },
    { name: "En progreso", value: inProgress, color: "#f59e0b" },
    { name: "Backlog", value: backlog, color: "#94a3b8" },
  ];
}

// ── Progress Bar component ──────────────────────────────────────────────────

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
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

// ── Project Card component ──────────────────────────────────────────────────

interface ProjectCardProps {
  project: ProjectInfo;
  status: StatusColor;
  isExpanded: boolean;
  onToggle: () => void;
}

function ProjectCard({ project, status, isExpanded, onToggle }: ProjectCardProps) {
  const progress = project.progress_pct ?? 0;
  const typeLabel = project.project_type === "support" ? "Soporte" : "Desarrollo";

  const startLabel = project.start_date
    ? new Date(project.start_date).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
    : "—";
  const endLabel = project.end_date
    ? new Date(project.end_date).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm transition-all ${
        isExpanded ? "border-brand-200 shadow-md col-span-1 md:col-span-2" : "border-gray-100 hover:shadow-md"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-6 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800">{project.name}</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {typeLabel} · {startLabel} &rarr; {endLabel}
            </p>
          </div>
          <StatusBadge status={status} size="sm" />
        </div>

        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Progreso</span>
            <span className="font-medium tabular-nums">{progress}%</span>
          </div>
          <ProgressBar value={progress} />
        </div>

        <div className="mt-4 grid grid-cols-2 divide-x divide-slate-100">
          <div className="pr-4 text-center">
            <p className="text-lg font-bold tabular-nums text-slate-800">
              {project.member_count}
            </p>
            <p className="text-xs text-slate-400">Miembros</p>
          </div>
          <div className="pl-4 text-center">
            <p className="text-lg font-bold tabular-nums text-slate-800">
              {progress}%
            </p>
            <p className="text-xs text-slate-400">Avance</p>
          </div>
        </div>
      </button>

      {isExpanded && (
        <ProjectDrillDown projectName={project.name} />
      )}
    </div>
  );
}

// ── Project Drill Down (burndown, task distribution, cycle history) ──────────

const PIE_COLORS = ["#22c55e", "#f59e0b", "#94a3b8"];

function ProjectDrillDown({ projectName }: { projectName: string }) {
  const { data: cyclesData, isLoading: cyclesLoading } = useProjectCycles();

  const projectCycles = useMemo(() => {
    if (!cyclesData) return [];
    return cyclesData.cycles.filter((c) => c.project_name === projectName);
  }, [cyclesData, projectName]);

  const activeCycle = useMemo(() => {
    return projectCycles.find((c) => c.is_active) ?? projectCycles[0] ?? null;
  }, [projectCycles]);

  const { data: analysisData, isLoading: analysisLoading } = useProjectCycleAnalysis(
    activeCycle?.cycle_id ?? null,
  );

  const burndownData = useMemo(() => {
    if (!activeCycle) return [];
    return buildBurndownData(activeCycle);
  }, [activeCycle]);

  const taskDist = useMemo(() => {
    if (!activeCycle) return [];
    return buildTaskDistribution(activeCycle);
  }, [activeCycle]);

  if (cyclesLoading) {
    return (
      <div className="border-t border-slate-100 p-6 space-y-4">
        <Skeleton variant="chart" />
      </div>
    );
  }

  if (projectCycles.length === 0) {
    return (
      <div className="border-t border-slate-100 p-6">
        <p className="text-sm text-slate-400 text-center">
          No hay ciclos asociados a este proyecto
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-100 p-6 space-y-6">
      {/* Active cycle header */}
      {activeCycle && (
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-700">
              Ciclo actual: {activeCycle.cycle_name}
            </h4>
            <p className="text-xs text-slate-400">
              {activeCycle.tasks_completed}/{activeCycle.tasks_assigned} tareas completadas
              ({activeCycle.completion_rate}%)
            </p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            {activeCycle.completion_rate}% completado
          </span>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Burndown chart */}
        {burndownData.length > 0 && (
          <ChartContainer
            title="Burndown del ciclo"
            subtitle="Tareas restantes: ideal vs real"
            height={240}
            loading={cyclesLoading}
          >
            <LineChart
              data={burndownData}
              margin={{ left: 0, right: 16, top: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="ideal"
                stroke="#94a3b8"
                strokeDasharray="5 5"
                strokeWidth={2}
                dot={false}
                name="Ideal"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Real"
              />
            </LineChart>
          </ChartContainer>
        )}

        {/* Task distribution pie */}
        {taskDist.length > 0 && (
          <ChartContainer
            title="Distribucion de tareas"
            subtitle="Por estado actual"
            height={240}
            loading={cyclesLoading}
          >
            <PieChart>
              <Pie
                data={taskDist}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {taskDist.map((entry, index) => (
                  <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              />
            </PieChart>
          </ChartContainer>
        )}
      </div>

      {/* Team members in cycle */}
      {analysisLoading && <Skeleton variant="table" lines={3} />}
      {analysisData && analysisData.members.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-slate-700">Equipo del ciclo</h4>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Nombre
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Puntos
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Tareas
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Asignadas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {analysisData.members.map((m) => (
                  <tr key={m.member_id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-medium text-slate-700">
                      <div className="flex items-center gap-2">
                        {m.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={m.avatar_url}
                            alt={m.name}
                            className="h-6 w-6 rounded-full"
                          />
                        ) : (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                            {m.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        {m.name}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                      {m.points_completed}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                      {m.tasks_completed}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                      {m.tasks_assigned}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cycle history */}
      {projectCycles.length > 1 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-slate-700">Historial de ciclos</h4>
          <ChartContainer
            title=""
            subtitle="Tasa de completitud por ciclo"
            height={200}
          >
            <BarChart
              data={projectCycles.map((c) => ({
                name: c.cycle_name,
                completitud: c.completion_rate,
                tareas: c.tasks_completed,
              }))}
              margin={{ left: 0, right: 16, top: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              />
              <Bar dataKey="completitud" fill="#2563eb" radius={[4, 4, 0, 0]} name="Completitud %" />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { dateRange } = useDateRange();
  const { data, isLoading, error } = useProjects();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const from = dateRange.from.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
  const to = dateRange.to.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const projects = useMemo(() => data?.projects ?? [], [data]);
  const summary = useMemo(() => computeStatusSummary(projects), [projects]);

  const trendForCount = (count: number): "up" | "down" | "neutral" => {
    if (count > 0) return "up";
    return "neutral";
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proyectos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Estado de proyectos
          </p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">
            Error al cargar proyectos. Intenta nuevamente.
          </p>
        </div>
      </div>
    );
  }

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
        <MetricCard
          title="Total proyectos"
          value={summary.total}
          loading={isLoading}
        />
        <MetricCard
          title="En tiempo"
          value={summary.green}
          trend={trendForCount(summary.green)}
          trendValue="verde"
          loading={isLoading}
        />
        <MetricCard
          title="En riesgo"
          value={summary.yellow}
          trend="neutral"
          trendValue="amarillo"
          loading={isLoading}
        />
        <MetricCard
          title="Atrasados"
          value={summary.red}
          trend={summary.red > 0 ? "down" : "neutral"}
          trendValue="rojo"
          loading={isLoading}
        />
      </div>

      {/* Project cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-slate-100 bg-white p-12 text-center">
          <p className="text-sm text-slate-400">No hay proyectos disponibles</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {projects.map((p) => {
            const status = computeProjectStatus(p);
            return (
              <ProjectCard
                key={p.project_id}
                project={p}
                status={status}
                isExpanded={expandedId === p.project_id}
                onToggle={() =>
                  setExpandedId((prev) =>
                    prev === p.project_id ? null : p.project_id,
                  )
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
