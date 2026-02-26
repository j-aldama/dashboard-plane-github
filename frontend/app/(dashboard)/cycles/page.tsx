"use client";

import { useState, useMemo, useCallback } from "react";
import { MetricCard } from "@/components/MetricCard";
import { ChartContainer } from "@/components/ChartContainer";
import { RankingTable, Column, Row } from "@/components/RankingTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/Skeleton";
import {
  CheckCircleIcon,
  ClockIcon,
  BarChart3Icon,
} from "@/components/icons";
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
  ReferenceLine,
} from "recharts";
import { useCycles, useCycleAnalysis } from "@/hooks/useCycles";
import { CycleInfo, MemberCyclePerformance } from "@/types/cycles";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

function formatDateFull(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function completionColor(rate: number): string {
  if (rate >= 80) return "text-green-600";
  if (rate >= 50) return "text-yellow-600";
  return "text-red-600";
}

function progressBarColor(rate: number): string {
  if (rate >= 80) return "bg-green-500";
  if (rate >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

/** Build simulated burndown data from a cycle's dates and task count. */
function buildBurndownData(cycle: CycleInfo) {
  if (!cycle.start_date || !cycle.end_date) return [];

  const start = new Date(cycle.start_date);
  const end = new Date(cycle.end_date);
  const today = new Date();
  const totalDays = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const totalTasks = cycle.tasks_assigned;
  const completedSoFar = cycle.tasks_completed;

  const points: { day: string; ideal: number; actual: number }[] = [];
  const numPoints = Math.min(totalDays + 1, 30);
  const stepDays = totalDays / (numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    const dayOffset = Math.round(stepDays * i);
    const pointDate = new Date(start.getTime() + dayOffset * 86400000);
    const label = pointDate.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
    });

    const idealRemaining = Math.max(
      0,
      totalTasks - (totalTasks * dayOffset) / totalDays,
    );

    let actualRemaining: number;
    if (pointDate <= today) {
      const progress = dayOffset / totalDays;
      const completedAtPoint = Math.round(completedSoFar * progress);
      actualRemaining = totalTasks - completedAtPoint;
    } else {
      actualRemaining = totalTasks - completedSoFar;
    }

    points.push({
      day: label,
      ideal: Math.round(idealRemaining * 10) / 10,
      actual: Math.max(0, actualRemaining),
    });
  }

  return points;
}

/** Compute 3-cycle moving average. */
function computeMovingAverage(
  cycles: CycleInfo[],
): { name: string; rate: number; movingAvg: number | null }[] {
  const sorted = [...cycles].sort((a, b) => {
    const da = a.start_date ?? "";
    const db = b.start_date ?? "";
    return da.localeCompare(db);
  });

  return sorted.map((c, idx) => {
    let avg: number | null = null;
    if (idx >= 2) {
      const sum =
        sorted[idx].completion_rate +
        sorted[idx - 1].completion_rate +
        sorted[idx - 2].completion_rate;
      avg = Math.round((sum / 3) * 10) / 10;
    }
    return {
      name: c.cycle_name,
      rate: c.completion_rate,
      movingAvg: avg,
    };
  });
}

// ── Medal rendering ──────────────────────────────────────────────────────────

const MEDAL_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];
const MEDAL_LABELS = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];

function MedalBadge({ position }: { position: number }) {
  if (position < 3) {
    return (
      <span className="text-lg leading-none" role="img" aria-label={`Posicion ${position + 1}`}>
        {MEDAL_LABELS[position]}
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
      {position + 1}
    </span>
  );
}

function AttentionIndicator() {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">
      !
    </span>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CycleCard({
  cycle,
  selected,
  onSelect,
}: {
  cycle: CycleInfo;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const borderClass = cycle.is_active
    ? "border-green-400 ring-2 ring-green-100"
    : selected
      ? "border-blue-400 ring-2 ring-blue-100"
      : "border-gray-100 hover:border-gray-200";

  return (
    <button
      type="button"
      onClick={() => onSelect(cycle.cycle_id)}
      className={`w-full rounded-xl border bg-white p-5 shadow-sm text-left transition-all ${borderClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-800">
              {cycle.cycle_name}
            </h3>
            {cycle.is_active && (
              <StatusBadge status="green" label="ACTIVO" size="sm" />
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {cycle.project_name}
          </p>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${completionColor(cycle.completion_rate)}`}>
          {Math.round(cycle.completion_rate)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${progressBarColor(cycle.completion_rate)}`}
            style={{ width: `${Math.min(100, cycle.completion_rate)}%` }}
          />
        </div>
      </div>

      {/* Footer: dates + task count */}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}
        </span>
        <span className="tabular-nums">
          {cycle.tasks_completed}/{cycle.tasks_assigned} tareas
        </span>
      </div>
    </button>
  );
}

function BurndownSection({ cycle }: { cycle: CycleInfo }) {
  const data = useMemo(() => buildBurndownData(cycle), [cycle]);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-400">
          No hay datos suficientes para generar el burndown chart.
        </p>
      </div>
    );
  }

  return (
    <ChartContainer
      title="Burndown Chart"
      subtitle={`${cycle.cycle_name} — ${formatDateFull(cycle.start_date)} a ${formatDateFull(cycle.end_date)}`}
      height={280}
    >
      <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="ideal"
          name="Ideal"
          stroke="#94a3b8"
          strokeDasharray="5 5"
          dot={false}
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="actual"
          name="Real"
          stroke="#2563eb"
          dot={false}
          strokeWidth={2}
        />
      </LineChart>
    </ChartContainer>
  );
}

function MemberProgressTable({
  members,
  loading,
}: {
  members: MemberCyclePerformance[];
  loading: boolean;
}) {
  const columns: Column[] = useMemo(
    () => [
      {
        key: "name",
        label: "Miembro",
        render: (_v, row) => (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              {String(row.initials)}
            </div>
            <span className="font-medium text-slate-800">
              {String(row.name)}
            </span>
          </div>
        ),
      },
      {
        key: "points_completed",
        label: "Puntos",
        sortable: true,
        render: (v) => (
          <span className="font-semibold tabular-nums text-slate-700">
            {String(v)}
          </span>
        ),
      },
      {
        key: "tasks_completed",
        label: "Completadas",
        sortable: true,
        render: (v) => (
          <span className="tabular-nums text-slate-600">{String(v)}</span>
        ),
      },
      {
        key: "tasks_assigned",
        label: "Asignadas",
        sortable: true,
        render: (v) => (
          <span className="tabular-nums text-slate-600">{String(v)}</span>
        ),
      },
      {
        key: "completion_pct",
        label: "% Completitud",
        sortable: true,
        render: (_v, row) => {
          const assigned = Number(row.tasks_assigned) || 1;
          const completed = Number(row.tasks_completed) || 0;
          const pct = Math.round((completed / assigned) * 100);
          return (
            <span className={`font-semibold tabular-nums ${completionColor(pct)}`}>
              {pct}%
            </span>
          );
        },
      },
      {
        key: "avg_task_complexity",
        label: "Complejidad Prom.",
        sortable: true,
        render: (v) => (
          <span className="tabular-nums text-slate-600">
            {Number(v).toFixed(1)}
          </span>
        ),
      },
    ],
    [],
  );

  const rows: Row[] = useMemo(
    () =>
      members.map((m) => ({
        ...m,
        initials: getInitials(m.name),
        completion_pct:
          m.tasks_assigned > 0
            ? Math.round((m.tasks_completed / m.tasks_assigned) * 100)
            : 0,
      })),
    [members],
  );

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">
        Progreso por Miembro
      </h3>
      <RankingTable
        columns={columns}
        data={rows}
        defaultSort="points_completed"
        loading={loading}
      />
    </div>
  );
}

// ── Rankings section (medals) ────────────────────────────────────────────────

interface RankingCategory {
  title: string;
  memberKey: string;
  isReverse: boolean;
}

const RANKING_CATEGORIES: RankingCategory[] = [
  { title: "Mas Puntos", memberKey: "points_completed", isReverse: false },
  { title: "Mas Tareas", memberKey: "tasks_completed", isReverse: false },
  {
    title: "Mayor Complejidad",
    memberKey: "max_task_complexity",
    isReverse: false,
  },
  { title: "Menos Puntos", memberKey: "points_completed", isReverse: true },
  { title: "Menos Tareas", memberKey: "tasks_completed", isReverse: true },
  {
    title: "Menor Complejidad",
    memberKey: "max_task_complexity",
    isReverse: true,
  },
];

function RankingCategoryCard({
  category,
  members,
}: {
  category: RankingCategory;
  members: MemberCyclePerformance[];
}) {
  const sorted = useMemo(() => {
    const copy = [...members];
    copy.sort((a, b) => {
      const aVal = Number(a[category.memberKey as keyof MemberCyclePerformance]) || 0;
      const bVal = Number(b[category.memberKey as keyof MemberCyclePerformance]) || 0;
      return category.isReverse ? aVal - bVal : bVal - aVal;
    });
    return copy.slice(0, 3);
  }, [members, category]);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        {category.isReverse && <AttentionIndicator />}
        <h4 className="text-sm font-semibold text-slate-700">
          {category.title}
        </h4>
      </div>
      <div className="space-y-2">
        {sorted.map((member, idx) => (
          <div
            key={member.member_id}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5"
            style={
              !category.isReverse && idx < 3
                ? { backgroundColor: `${MEDAL_COLORS[idx]}10` }
                : undefined
            }
          >
            {category.isReverse ? (
              <AttentionIndicator />
            ) : (
              <MedalBadge position={idx} />
            )}
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
              {getInitials(member.name)}
            </div>
            <span className="flex-1 truncate text-sm text-slate-700">
              {member.name}
            </span>
            <span className="tabular-nums text-sm font-semibold text-slate-800">
              {Number(
                member[category.memberKey as keyof MemberCyclePerformance],
              )}
            </span>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="py-2 text-center text-xs text-slate-400">Sin datos</p>
        )}
      </div>
    </div>
  );
}

function CycleRankingsSection({
  members,
}: {
  members: MemberCyclePerformance[];
}) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold text-slate-700">
        Rankings del Ciclo
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {RANKING_CATEGORIES.map((cat) => (
          <RankingCategoryCard
            key={`${cat.title}-${cat.isReverse}`}
            category={cat}
            members={members}
          />
        ))}
      </div>
    </div>
  );
}

// ── Historical chart ─────────────────────────────────────────────────────────

function HistoricalChart({ cycles }: { cycles: CycleInfo[] }) {
  const data = useMemo(() => computeMovingAverage(cycles), [cycles]);

  if (data.length === 0) return null;

  return (
    <ChartContainer
      title="Historico de Completitud"
      subtitle="Tasa de completitud por ciclo con promedio movil de 3 ciclos"
      height={280}
    >
      <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
          }}
          formatter={(value: number, name: string) => [
            `${value}%`,
            name === "rate" ? "Completitud" : "Prom. Movil (3)",
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value: string) =>
            value === "rate" ? "Completitud" : "Prom. Movil (3)"
          }
        />
        <ReferenceLine
          y={80}
          stroke="#22c55e"
          strokeDasharray="3 3"
          label={{ value: "Meta 80%", fontSize: 10, fill: "#22c55e" }}
        />
        <Line
          type="monotone"
          dataKey="rate"
          name="rate"
          stroke="#2563eb"
          strokeWidth={2}
          dot={{ r: 4, fill: "#2563eb" }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="movingAvg"
          name="movingAvg"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={false}
          connectNulls={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

// ── Cycle comparison ─────────────────────────────────────────────────────────

function CycleComparisonSection({ cycles }: { cycles: CycleInfo[] }) {
  const [cycleA, setCycleA] = useState<string>("");
  const [cycleB, setCycleB] = useState<string>("");
  const [expanded, setExpanded] = useState(false);

  const { data: analysisA } = useCycleAnalysis(cycleA || null);
  const { data: analysisB } = useCycleAnalysis(cycleB || null);

  const comparisonChartData = useMemo(() => {
    const ca = cycles.find((c) => c.cycle_id === cycleA);
    const cb = cycles.find((c) => c.cycle_id === cycleB);
    if (!ca || !cb) return null;

    return [
      {
        metric: "Asignadas",
        [ca.cycle_name]: ca.tasks_assigned,
        [cb.cycle_name]: cb.tasks_assigned,
      },
      {
        metric: "Completadas",
        [ca.cycle_name]: ca.tasks_completed,
        [cb.cycle_name]: cb.tasks_completed,
      },
    ];
  }, [cycles, cycleA, cycleB]);

  const cycleAInfo = cycles.find((c) => c.cycle_id === cycleA);
  const cycleBInfo = cycles.find((c) => c.cycle_id === cycleB);

  const memberDiffRows: Row[] = useMemo(() => {
    if (!analysisA || !analysisB) return [];

    const memberMap = new Map<
      string,
      { name: string; initials: string; pointsA: number; pointsB: number; tasksA: number; tasksB: number }
    >();

    for (const m of analysisA.members) {
      memberMap.set(m.member_id, {
        name: m.name,
        initials: getInitials(m.name),
        pointsA: m.points_completed,
        pointsB: 0,
        tasksA: m.tasks_completed,
        tasksB: 0,
      });
    }

    for (const m of analysisB.members) {
      const existing = memberMap.get(m.member_id);
      if (existing) {
        existing.pointsB = m.points_completed;
        existing.tasksB = m.tasks_completed;
      } else {
        memberMap.set(m.member_id, {
          name: m.name,
          initials: getInitials(m.name),
          pointsA: 0,
          pointsB: m.points_completed,
          tasksA: 0,
          tasksB: m.tasks_completed,
        });
      }
    }

    return Array.from(memberMap.values()).map((m) => ({
      ...m,
      pointsDiff: m.pointsB - m.pointsA,
      tasksDiff: m.tasksB - m.tasksA,
    }));
  }, [analysisA, analysisB]);

  const memberDiffColumns: Column[] = useMemo(
    () => [
      {
        key: "name",
        label: "Miembro",
        render: (_v, row) => (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
              {String(row.initials)}
            </div>
            <span className="text-sm font-medium text-slate-800">
              {String(row.name)}
            </span>
          </div>
        ),
      },
      {
        key: "pointsA",
        label: cycleAInfo?.cycle_name ? `Pts (${cycleAInfo.cycle_name})` : "Pts Ciclo A",
        sortable: true,
        render: (v) => (
          <span className="tabular-nums text-slate-600">{String(v)}</span>
        ),
      },
      {
        key: "pointsB",
        label: cycleBInfo?.cycle_name ? `Pts (${cycleBInfo.cycle_name})` : "Pts Ciclo B",
        sortable: true,
        render: (v) => (
          <span className="tabular-nums text-slate-600">{String(v)}</span>
        ),
      },
      {
        key: "pointsDiff",
        label: "Dif. Puntos",
        sortable: true,
        render: (v) => {
          const diff = Number(v);
          const cls =
            diff > 0
              ? "text-green-600"
              : diff < 0
                ? "text-red-600"
                : "text-slate-400";
          return (
            <span className={`font-semibold tabular-nums ${cls}`}>
              {diff > 0 ? "+" : ""}
              {diff}
            </span>
          );
        },
      },
      {
        key: "tasksDiff",
        label: "Dif. Tareas",
        sortable: true,
        render: (v) => {
          const diff = Number(v);
          const cls =
            diff > 0
              ? "text-green-600"
              : diff < 0
                ? "text-red-600"
                : "text-slate-400";
          return (
            <span className={`font-semibold tabular-nums ${cls}`}>
              {diff > 0 ? "+" : ""}
              {diff}
            </span>
          );
        },
      },
    ],
    [cycleAInfo, cycleBInfo],
  );

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <h3 className="text-sm font-semibold text-slate-700">
          Comparar Ciclos
        </h3>
        <span className="text-xs text-slate-400">
          {expanded ? "Cerrar" : "Expandir"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-6 border-t border-slate-100 p-5">
          {/* Selectors */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="cycle-a-select"
                className="mb-1 block text-xs font-medium text-slate-500"
              >
                Ciclo A
              </label>
              <select
                id="cycle-a-select"
                value={cycleA}
                onChange={(e) => setCycleA(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Seleccionar ciclo...</option>
                {cycles.map((c) => (
                  <option key={c.cycle_id} value={c.cycle_id}>
                    {c.cycle_name} ({Math.round(c.completion_rate)}%)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="cycle-b-select"
                className="mb-1 block text-xs font-medium text-slate-500"
              >
                Ciclo B
              </label>
              <select
                id="cycle-b-select"
                value={cycleB}
                onChange={(e) => setCycleB(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Seleccionar ciclo...</option>
                {cycles.map((c) => (
                  <option key={c.cycle_id} value={c.cycle_id}>
                    {c.cycle_name} ({Math.round(c.completion_rate)}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison content */}
          {cycleA && cycleB && cycleAInfo && cycleBInfo && (
            <div className="space-y-6">
              {/* Key metrics side by side */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-4 text-center">
                  <p className="text-xs font-medium text-slate-500">
                    Completitud
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-3">
                    <span className={`text-xl font-bold tabular-nums ${completionColor(cycleAInfo.completion_rate)}`}>
                      {Math.round(cycleAInfo.completion_rate)}%
                    </span>
                    <span className="text-slate-400">vs</span>
                    <span className={`text-xl font-bold tabular-nums ${completionColor(cycleBInfo.completion_rate)}`}>
                      {Math.round(cycleBInfo.completion_rate)}%
                    </span>
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 text-center">
                  <p className="text-xs font-medium text-slate-500">
                    Total Tareas
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-3">
                    <span className="text-xl font-bold tabular-nums text-slate-800">
                      {cycleAInfo.tasks_assigned}
                    </span>
                    <span className="text-slate-400">vs</span>
                    <span className="text-xl font-bold tabular-nums text-slate-800">
                      {cycleBInfo.tasks_assigned}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 text-center">
                  <p className="text-xs font-medium text-slate-500">
                    Completadas
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-3">
                    <span className="text-xl font-bold tabular-nums text-slate-800">
                      {cycleAInfo.tasks_completed}
                    </span>
                    <span className="text-slate-400">vs</span>
                    <span className="text-xl font-bold tabular-nums text-slate-800">
                      {cycleBInfo.tasks_completed}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grouped bar chart */}
              {comparisonChartData && (
                <ChartContainer
                  title="Tareas: Asignadas vs Completadas"
                  subtitle={`${cycleAInfo.cycle_name} vs ${cycleBInfo.cycle_name}`}
                  height={220}
                >
                  <BarChart
                    data={comparisonChartData}
                    margin={{ left: 0, right: 16, top: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey={cycleAInfo.cycle_name}
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey={cycleBInfo.cycle_name}
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              )}

              {/* Member diff table */}
              {memberDiffRows.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-slate-700">
                    Diferencias por Miembro
                  </h4>
                  <RankingTable
                    columns={memberDiffColumns}
                    data={memberDiffRows}
                    defaultSort="pointsDiff"
                  />
                </div>
              )}
            </div>
          )}

          {cycleA && cycleB && cycleA === cycleB && (
            <p className="text-center text-sm text-slate-400">
              Selecciona dos ciclos diferentes para comparar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CyclesPage() {
  const { data: cyclesData, isLoading: cyclesLoading } = useCycles();
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  // Auto-select active cycle when data loads
  const activeCycle = useMemo(
    () => cyclesData?.cycles.find((c) => c.is_active) ?? null,
    [cyclesData],
  );

  const effectiveCycleId = selectedCycleId ?? activeCycle?.cycle_id ?? null;

  const { data: analysisData, isLoading: analysisLoading } =
    useCycleAnalysis(effectiveCycleId);

  const selectedCycle = useMemo(
    () => cyclesData?.cycles.find((c) => c.cycle_id === effectiveCycleId) ?? null,
    [cyclesData, effectiveCycleId],
  );

  // Sort cycles: active first, then by start_date descending
  const sortedCycles = useMemo(() => {
    if (!cyclesData) return [];
    return [...cyclesData.cycles].sort((a, b) => {
      if (a.is_active && !b.is_active) return -1;
      if (!a.is_active && b.is_active) return 1;
      const da = a.start_date ?? "";
      const db = b.start_date ?? "";
      return db.localeCompare(da);
    });
  }, [cyclesData]);

  const handleSelectCycle = useCallback((id: string) => {
    setSelectedCycleId(id);
  }, []);

  // Summary metrics
  const totalCycles = cyclesData?.cycles.length ?? 0;
  const avgCompletion =
    totalCycles > 0
      ? Math.round(
          (cyclesData!.cycles.reduce((sum, c) => sum + c.completion_rate, 0) /
            totalCycles) *
            10,
        ) / 10
      : 0;
  const totalTasksCompleted = cyclesData?.cycles.reduce(
    (sum, c) => sum + c.tasks_completed,
    0,
  ) ?? 0;

  if (cyclesLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Analisis de Ciclos
          </h1>
          <p className="mt-1 text-sm text-slate-500">Cargando datos...</p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
        <Skeleton variant="chart" />
        <Skeleton variant="table" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Analisis de Ciclos
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Metricas de completitud, burndown y rankings por ciclo sprint
        </p>
      </div>

      {/* Summary metric cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Ciclos"
          value={totalCycles}
          icon={<BarChart3Icon size={18} />}
        />
        <MetricCard
          title="Completitud Promedio"
          value={`${avgCompletion}%`}
          trend={avgCompletion >= 80 ? "up" : avgCompletion >= 50 ? "neutral" : "down"}
          trendValue={avgCompletion >= 80 ? "Buen ritmo" : "Necesita mejora"}
          icon={<CheckCircleIcon size={18} />}
        />
        <MetricCard
          title="Tareas Completadas (Total)"
          value={totalTasksCompleted}
          icon={<CheckCircleIcon size={18} />}
        />
        {activeCycle && (
          <MetricCard
            title="Ciclo Activo"
            value={`${Math.round(activeCycle.completion_rate)}%`}
            trend={
              activeCycle.completion_rate >= 80
                ? "up"
                : activeCycle.completion_rate >= 50
                  ? "neutral"
                  : "down"
            }
            trendValue={activeCycle.cycle_name}
            icon={<ClockIcon size={18} />}
          />
        )}
      </div>

      {/* Section A: Cycles list */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Ciclos del Proyecto
        </h2>
        {sortedCycles.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-slate-400">
              No se encontraron ciclos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sortedCycles.map((cycle) => (
              <CycleCard
                key={cycle.cycle_id}
                cycle={cycle}
                selected={cycle.cycle_id === effectiveCycleId}
                onSelect={handleSelectCycle}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section B: Active cycle burndown */}
      {activeCycle && (
        <div className="space-y-6">
          <BurndownSection cycle={activeCycle} />
        </div>
      )}

      {/* Section B (cont): Member progress for selected cycle */}
      {effectiveCycleId && (
        <MemberProgressTable
          members={analysisData?.members ?? []}
          loading={analysisLoading}
        />
      )}

      {/* Section C: Rankings (only for non-100% cycles) */}
      {selectedCycle &&
        selectedCycle.completion_rate < 100 &&
        analysisData &&
        analysisData.members.length > 0 && (
          <CycleRankingsSection members={analysisData.members} />
        )}

      {/* Section D: Historical chart */}
      {cyclesData && cyclesData.cycles.length > 1 && (
        <HistoricalChart cycles={cyclesData.cycles} />
      )}

      {/* Section E: Cycle comparison */}
      {cyclesData && cyclesData.cycles.length >= 2 && (
        <CycleComparisonSection cycles={cyclesData.cycles} />
      )}
    </div>
  );
}
