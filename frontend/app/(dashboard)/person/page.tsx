"use client";

import { useState, useMemo } from "react";
import { MetricCard } from "@/components/MetricCard";
import { ChartContainer } from "@/components/ChartContainer";
import { Skeleton } from "@/components/Skeleton";
import { CheckCircleIcon, GitPullRequestIcon, ClockIcon } from "@/components/icons";
import { useDateRange } from "@/contexts/DateRangeContext";
import {
  usePlaneTeamMetrics,
  useGitHubTeamMetrics,
  useGitHubMemberDetail,
  usePersonCycles,
  usePersonCycleAnalysis,
} from "@/hooks/usePerson";
import { PlaneTeamMemberMetrics } from "@/types/overview";
import { PointsPerCycle, TasksByPriority } from "@/types/person";
import { CycleInfo } from "@/types/cycles";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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
  RadialBarChart,
  RadialBar,
} from "recharts";

// ── Helper: generate initials ───────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ── Helper: priority distribution ───────────────────────────────────────────

const PRIORITY_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#94a3b8"];
const PRIORITY_LABELS = ["Urgente", "Alta", "Media", "Baja", "Sin prioridad"];

function buildPriorityDistribution(priorityAvg: number, tasksAssigned: number): TasksByPriority[] {
  if (tasksAssigned === 0) return [];

  // Estimate distribution from average priority (1=urgent, 5=none)
  // Lower avg = more urgent tasks. We create a rough distribution.
  const normalized = Math.max(1, Math.min(5, priorityAvg));
  const weights = PRIORITY_LABELS.map((_, i) => {
    const center = i + 1;
    const dist = Math.abs(normalized - center);
    return Math.max(0.05, 1 - dist * 0.3);
  });
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  return PRIORITY_LABELS.map((label, i) => ({
    name: label,
    value: Math.round((weights[i] / totalWeight) * tasksAssigned),
    color: PRIORITY_COLORS[i],
  })).filter((d) => d.value > 0);
}

// ── Unified member type ─────────────────────────────────────────────────────

interface UnifiedPerson {
  id: string;
  name: string;
  initials: string;
  avatar_url: string | null;
  github_username: string | null;
  // Plane
  story_points: number;
  tasks_completed: number;
  tasks_assigned: number;
  priority_avg: number;
  relative_effort: number;
  // GitHub
  prs_open: number;
  prs_merged: number;
  prs_rejected: number;
  commits: number;
  lines_added: number;
  lines_removed: number;
  lines_net: number;
}

// ── Member Selector ─────────────────────────────────────────────────────────

interface MemberSelectorProps {
  members: UnifiedPerson[];
  selectedId: string;
  onSelect: (id: string) => void;
}

function MemberSelector({ members, selectedId, onSelect }: MemberSelectorProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {members.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
            selectedId === m.id
              ? "border-brand-600 bg-brand-50 shadow-sm"
              : "border-gray-100 bg-white shadow-sm hover:border-brand-200 hover:bg-blue-50"
          }`}
        >
          {m.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={m.avatar_url}
              alt={m.name}
              className={`h-9 w-9 flex-shrink-0 rounded-full object-cover ${
                selectedId === m.id ? "ring-2 ring-brand-600" : ""
              }`}
            />
          ) : (
            <div
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                selectedId === m.id
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {m.initials}
            </div>
          )}
          <div>
            <p
              className={`text-sm font-semibold ${
                selectedId === m.id ? "text-brand-700" : "text-slate-800"
              }`}
            >
              {m.name}
            </p>
            {m.github_username && (
              <p className="text-xs text-slate-400">@{m.github_username}</p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Profile Header ──────────────────────────────────────────────────────────

function ProfileHeader({ member }: { member: UnifiedPerson }) {
  const completionRate =
    member.tasks_assigned > 0
      ? Math.round((member.tasks_completed / member.tasks_assigned) * 100)
      : 0;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      {member.avatar_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={member.avatar_url}
          alt={member.name}
          className="h-12 w-12 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
          {member.initials}
        </div>
      )}
      <div className="flex-1">
        <h2 className="text-lg font-bold text-slate-900">{member.name}</h2>
        <p className="text-sm text-slate-500">
          {member.github_username ? `@${member.github_username}` : "Equipo"}
          {" · "}Esfuerzo relativo: {Math.round(member.relative_effort * 100)}%
        </p>
      </div>
      <div className="text-right">
        <p className="text-2xl font-bold tabular-nums text-brand-600">
          {completionRate}%
        </p>
        <p className="text-xs text-slate-400">Tasa de completitud</p>
      </div>
    </div>
  );
}

// ── Points Per Cycle Chart ──────────────────────────────────────────────────

function PointsPerCycleChart({
  data,
  loading,
  memberName,
}: {
  data: PointsPerCycle[];
  loading: boolean;
  memberName: string;
}) {
  return (
    <ChartContainer
      title="Puntos por ciclo"
      subtitle={`Evolucion temporal de ${memberName}`}
      height={240}
      loading={loading}
    >
      <LineChart
        data={data}
        margin={{ left: 0, right: 16, top: 8, bottom: 4 }}
      >
        <defs>
          <linearGradient id="gradPointsCycle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="cycle" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
          }}
        />
        <Line
          type="monotone"
          dataKey="points"
          stroke="#2563eb"
          strokeWidth={2}
          dot={{ r: 4, fill: "#2563eb" }}
          name="Story Points"
        />
      </LineChart>
    </ChartContainer>
  );
}

// ── Priority Distribution Chart ─────────────────────────────────────────────

function PriorityChart({
  data,
  loading,
}: {
  data: TasksByPriority[];
  loading: boolean;
}) {
  return (
    <ChartContainer
      title="Tareas por prioridad"
      subtitle="Distribucion estimada"
      height={240}
      loading={loading}
    >
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={75}
          paddingAngle={3}
          dataKey="value"
          nameKey="name"
          label={({ name, value }) => `${name}: ${value}`}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
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
  );
}

// ── Relative Effort Gauge ───────────────────────────────────────────────────

function EffortGauge({
  effort,
  loading,
}: {
  effort: number;
  loading: boolean;
}) {
  const pct = Math.round(effort * 100);
  const gaugeData = [
    { name: "Esfuerzo", value: pct, fill: "#2563eb" },
  ];

  return (
    <ChartContainer
      title="Esfuerzo relativo"
      subtitle="vs promedio del equipo"
      height={240}
      loading={loading}
    >
      <RadialBarChart
        cx="50%"
        cy="50%"
        innerRadius="60%"
        outerRadius="90%"
        data={gaugeData}
        startAngle={180}
        endAngle={0}
        barSize={16}
      >
        <RadialBar
          background
          dataKey="value"
          cornerRadius={8}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-slate-700 text-xl font-bold"
        >
          {pct}%
        </text>
      </RadialBarChart>
    </ChartContainer>
  );
}

// ── PRs by State Chart ──────────────────────────────────────────────────────

function PrsByStateChart({
  member,
  loading,
}: {
  member: UnifiedPerson;
  loading: boolean;
}) {
  const data = [
    {
      label: member.name,
      Abiertas: member.prs_open,
      Mergeadas: member.prs_merged,
      Rechazadas: member.prs_rejected,
    },
  ];

  return (
    <ChartContainer
      title="PRs por estado"
      subtitle="Distribucion de Pull Requests"
      height={240}
      loading={loading}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 16, top: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis dataKey="label" type="category" tick={{ fontSize: 10 }} width={80} />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Abiertas" stackId="prs" fill="#3b82f6" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Mergeadas" stackId="prs" fill="#22c55e" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Rechazadas" stackId="prs" fill="#ef4444" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

// ── Commits History Chart ───────────────────────────────────────────────────

function CommitsHistoryChart({
  history,
  loading,
}: {
  history: Array<{ week: string; commits: number }>;
  loading: boolean;
}) {
  return (
    <ChartContainer
      title="Commits por semana"
      subtitle="Actividad en GitHub"
      height={220}
      loading={loading}
    >
      <AreaChart
        data={history}
        margin={{ left: 0, right: 16, top: 8, bottom: 4 }}
      >
        <defs>
          <linearGradient id="gradCommits" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="week" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
          }}
        />
        <Area
          type="monotone"
          dataKey="commits"
          stroke="#22c55e"
          strokeWidth={2}
          fill="url(#gradCommits)"
          name="Commits"
        />
      </AreaChart>
    </ChartContainer>
  );
}

// ── Lines Ratio Indicator ───────────────────────────────────────────────────

function LinesRatioIndicator({
  linesAdded,
  linesRemoved,
}: {
  linesAdded: number;
  linesRemoved: number;
}) {
  const total = linesAdded + linesRemoved;
  const addedPct = total > 0 ? Math.round((linesAdded / total) * 100) : 50;
  const removedPct = 100 - addedPct;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">Lineas de codigo</h3>
      <p className="mt-0.5 text-xs text-slate-400">Ratio agregadas / eliminadas</p>

      <div className="mt-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${addedPct}%` }}
            />
            <div
              className="bg-red-400 transition-all"
              style={{ width: `${removedPct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <span className="font-medium text-green-600">
              +{linesAdded.toLocaleString()} ({addedPct}%)
            </span>
            <span className="font-medium text-red-500">
              -{linesRemoved.toLocaleString()} ({removedPct}%)
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 text-center">
        <p className="text-2xl font-bold tabular-nums text-slate-800">
          {(linesAdded - linesRemoved).toLocaleString()}
        </p>
        <p className="text-xs text-slate-400">Lineas netas</p>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PersonPage() {
  const { dateRange } = useDateRange();
  const { data: planeData, isLoading: planeLoading } = usePlaneTeamMetrics();
  const { data: githubData, isLoading: githubLoading } = useGitHubTeamMetrics();
  const { data: cyclesData, isLoading: cyclesLoading } = usePersonCycles();

  const isLoading = planeLoading || githubLoading;

  // Build unified members from Plane + GitHub data
  const members = useMemo<UnifiedPerson[]>(() => {
    const planeMembers = planeData?.members ?? [];
    const githubMembers = githubData?.members ?? [];

    return planeMembers.map((pm: PlaneTeamMemberMetrics) => {
      const ghMatch = githubMembers.find(
        (gm) => gm.plane_member_id === pm.member_id,
      );

      return {
        id: pm.member_id,
        name: pm.name,
        initials: getInitials(pm.name),
        avatar_url: pm.avatar_url,
        github_username: ghMatch?.username ?? null,
        story_points: pm.story_points_completed,
        tasks_completed: pm.tasks_completed,
        tasks_assigned: pm.tasks_assigned,
        priority_avg: pm.priority_avg,
        relative_effort: pm.relative_effort,
        prs_open: ghMatch?.prs_open ?? 0,
        prs_merged: ghMatch?.prs_merged ?? 0,
        prs_rejected: ghMatch?.prs_rejected ?? 0,
        commits: ghMatch?.commits_total ?? 0,
        lines_added: ghMatch?.lines_added ?? 0,
        lines_removed: ghMatch?.lines_removed ?? 0,
        lines_net: ghMatch?.lines_net ?? 0,
      };
    });
  }, [planeData, githubData]);

  const [selectedId, setSelectedId] = useState<string>("");

  // Auto-select first member when data loads
  const effectiveSelectedId = selectedId || members[0]?.id || "";
  const member = members.find((m) => m.id === effectiveSelectedId) ?? members[0];

  // GitHub detail for snapshot history
  const { data: ghDetail, isLoading: ghDetailLoading } = useGitHubMemberDetail(
    member?.github_username ?? null,
  );

  // Build commits-per-week from snapshot history
  const commitsHistory = useMemo(() => {
    if (!ghDetail?.snapshot_history) return [];
    return ghDetail.snapshot_history.map((snap) => ({
      week: new Date(snap.snapshot_date).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
      }),
      commits: snap.commits_count,
    }));
  }, [ghDetail]);

  // Build points per cycle from cycle analysis data
  const cycleAnalysisQueries = useMemo(() => {
    const cycles = cyclesData?.cycles ?? [];
    return cycles.slice(0, 6).map((c) => c.cycle_id);
  }, [cyclesData]);

  // Query each cycle's analysis (up to 6 for historical view)
  const c0 = usePersonCycleAnalysis(cycleAnalysisQueries[0] ?? null);
  const c1 = usePersonCycleAnalysis(cycleAnalysisQueries[1] ?? null);
  const c2 = usePersonCycleAnalysis(cycleAnalysisQueries[2] ?? null);
  const c3 = usePersonCycleAnalysis(cycleAnalysisQueries[3] ?? null);
  const c4 = usePersonCycleAnalysis(cycleAnalysisQueries[4] ?? null);
  const c5 = usePersonCycleAnalysis(cycleAnalysisQueries[5] ?? null);

  const c0Data = c0.data;
  const c1Data = c1.data;
  const c2Data = c2.data;
  const c3Data = c3.data;
  const c4Data = c4.data;
  const c5Data = c5.data;

  const pointsPerCycle = useMemo<PointsPerCycle[]>(() => {
    if (!member) return [];

    const analysisResults = [c0Data, c1Data, c2Data, c3Data, c4Data, c5Data];

    return cycleAnalysisQueries
      .map((_cycleId, index) => {
        const analysis = analysisResults[index];
        if (!analysis) return null;

        const memberData = analysis.members.find(
          (m) => m.member_id === member.id,
        );
        if (!memberData) return null;

        return {
          cycle: analysis.cycle_name,
          points: memberData.points_completed,
        };
      })
      .filter((d): d is PointsPerCycle => d !== null);
  }, [member, cycleAnalysisQueries, c0Data, c1Data, c2Data, c3Data, c4Data, c5Data]);

  // Priority distribution
  const priorityData = useMemo(() => {
    if (!member) return [];
    return buildPriorityDistribution(member.priority_avg, member.tasks_assigned);
  }, [member]);

  const from = dateRange.from.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
  const to = dateRange.to.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Por Persona</h1>
          <p className="mt-1 text-sm text-slate-500">Cargando datos...</p>
        </div>
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="card" className="w-48" />
          ))}
        </div>
        <Skeleton variant="card" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Por Persona</h1>
          <p className="mt-1 text-sm text-slate-500">
            Metricas individuales del periodo seleccionado
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-12 text-center">
          <p className="text-sm text-slate-400">No hay miembros disponibles</p>
        </div>
      </div>
    );
  }

  if (!member) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Por Persona</h1>
        <p className="mt-1 text-sm text-slate-500">
          Metricas individuales · {from} — {to}
        </p>
      </div>

      {/* Member selector */}
      <MemberSelector
        members={members}
        selectedId={effectiveSelectedId}
        onSelect={setSelectedId}
      />

      {/* Profile header */}
      <ProfileHeader member={member} />

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          title="Story Points"
          value={member.story_points}
          icon={<ClockIcon size={18} />}
        />
        <MetricCard
          title="Tareas completadas"
          value={member.tasks_completed}
          icon={<CheckCircleIcon size={18} />}
        />
        <MetricCard
          title="PRs mergeados"
          value={member.prs_merged}
          icon={<GitPullRequestIcon size={18} />}
        />
        <MetricCard
          title="Commits"
          value={member.commits}
        />
      </div>

      {/* Plane section: Points per cycle + Priority + Effort gauge */}
      <div>
        <h3 className="mb-4 text-base font-semibold text-slate-800">
          Plane - Gestion de Proyectos
        </h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PointsPerCycleChart
              data={pointsPerCycle}
              loading={cyclesLoading}
              memberName={member.name}
            />
          </div>
          {priorityData.length > 0 && (
            <PriorityChart data={priorityData} loading={false} />
          )}
        </div>
        <div className="mt-4">
          <EffortGauge effort={member.relative_effort} loading={false} />
        </div>
      </div>

      {/* GitHub section: PRs by state + Commits per week + Lines ratio */}
      <div>
        <h3 className="mb-4 text-base font-semibold text-slate-800">
          GitHub - Actividad de Codigo
        </h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PrsByStateChart member={member} loading={false} />
          <CommitsHistoryChart
            history={commitsHistory}
            loading={ghDetailLoading}
          />
        </div>
        <div className="mt-4">
          <LinesRatioIndicator
            linesAdded={member.lines_added}
            linesRemoved={member.lines_removed}
          />
        </div>
      </div>

      {/* Historical evolution summary */}
      {commitsHistory.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">
            Evolucion historica
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Productividad de los ultimos {commitsHistory.length} periodos registrados
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="text-center">
              <p className="text-xl font-bold tabular-nums text-slate-800">
                {member.story_points}
              </p>
              <p className="text-xs text-slate-400">Puntos totales</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold tabular-nums text-slate-800">
                {member.tasks_completed}/{member.tasks_assigned}
              </p>
              <p className="text-xs text-slate-400">Tareas</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold tabular-nums text-slate-800">
                {member.prs_merged}
              </p>
              <p className="text-xs text-slate-400">PRs mergeados</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold tabular-nums text-slate-800">
                {(member.lines_added - member.lines_removed).toLocaleString()}
              </p>
              <p className="text-xs text-slate-400">Lineas netas</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
