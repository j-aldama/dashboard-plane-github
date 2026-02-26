"use client";

import { useMemo, useState, useCallback } from "react";
import { ChartContainer } from "@/components/ChartContainer";
import { RankingTable, Column, Row } from "@/components/RankingTable";
import { Skeleton } from "@/components/Skeleton";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  usePlaneTeamMetrics,
  useGitHubTeamMetrics,
  mergeMembers,
} from "@/hooks/useOverviewData";
import { UnifiedMember } from "@/types/overview";

// ── Constants ────────────────────────────────────────────────────────────────

const MEMBER_COLORS = ["#1e40af", "#16a34a", "#ea580c", "#7c3aed", "#0891b2"];
const MIN_SELECTED = 2;
const MAX_SELECTED = 5;

// ── Metric configurations ────────────────────────────────────────────────────

interface MetricConfig {
  key: keyof UnifiedMember;
  label: string;
}

const RADAR_METRICS: MetricConfig[] = [
  { key: "story_points", label: "Story Points" },
  { key: "tasks_completed", label: "Tareas" },
  { key: "prs_merged", label: "PRs" },
  { key: "commits", label: "Commits" },
  { key: "priority_avg", label: "Complejidad" },
];

const BAR_METRICS: MetricConfig[] = [
  { key: "story_points", label: "Points" },
  { key: "tasks_completed", label: "Tareas" },
  { key: "prs_merged", label: "PRs" },
  { key: "commits", label: "Commits" },
];

const TABLE_METRICS: { label: string; key: keyof UnifiedMember }[] = [
  { label: "Story Points", key: "story_points" },
  { label: "Tareas completadas", key: "tasks_completed" },
  { label: "Tareas asignadas", key: "tasks_assigned" },
  { label: "PRs mergeados", key: "prs_merged" },
  { label: "PRs abiertos", key: "prs_open" },
  { label: "Commits", key: "commits" },
  { label: "Lineas netas", key: "lines_net" },
  { label: "Complejidad promedio", key: "priority_avg" },
];

// ── Data builders ────────────────────────────────────────────────────────────

function normalizeValues(values: number[]): number[] {
  const max = Math.max(...values, 1);
  return values.map((v) => Math.round((v / max) * 100));
}

function buildRadarData(
  selected: UnifiedMember[],
): Record<string, string | number>[] {
  return RADAR_METRICS.map((metric) => {
    const rawValues = selected.map((m) => Number(m[metric.key]) || 0);
    const normalized = normalizeValues(rawValues);

    const point: Record<string, string | number> = {
      metric: metric.label,
      fullMark: 100,
    };
    selected.forEach((m, i) => {
      point[m.id] = normalized[i];
    });
    return point;
  });
}

function buildGroupedBarData(
  selected: UnifiedMember[],
): Record<string, string | number>[] {
  return BAR_METRICS.map((metric) => {
    const point: Record<string, string | number> = { metric: metric.label };
    selected.forEach((m) => {
      point[m.id] = Number(m[metric.key]) || 0;
    });
    return point;
  });
}

function buildComparisonRows(selected: UnifiedMember[]): Row[] {
  return TABLE_METRICS.map((metric) => {
    const row: Row = { metric: metric.label };
    const values: number[] = [];
    selected.forEach((m) => {
      const val = Number(m[metric.key]) || 0;
      row[m.id] = val;
      values.push(val);
    });

    const max = Math.max(...values);
    const min = Math.min(...values);
    // Only mark best/worst if there is actual variance
    const allSame = max === min;
    row._best = allSame ? -1 : max;
    row._worst = allSame ? -1 : min;

    return row;
  });
}

// ── Custom radar tooltip ─────────────────────────────────────────────────────

interface RadarPayloadEntry {
  name: string;
  value: number;
  color: string;
}

function RadarTooltipContent({
  active,
  label,
  payload,
  memberNames,
}: {
  active?: boolean;
  label?: string;
  payload?: RadarPayloadEntry[];
  memberNames: Map<string, string>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-slate-700">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-500">
            {memberNames.get(entry.name) ?? entry.name}:
          </span>
          <span className="tabular-nums font-medium text-slate-700">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Custom grouped bar tooltip ───────────────────────────────────────────────

interface BarPayloadEntry {
  name: string;
  value: number;
  color: string;
}

function GroupedBarTooltip({
  active,
  label,
  payload,
  memberNames,
}: {
  active?: boolean;
  label?: string;
  payload?: BarPayloadEntry[];
  memberNames: Map<string, string>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-slate-700">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-500">
            {memberNames.get(entry.name) ?? entry.name}:
          </span>
          <span className="tabular-nums font-medium text-slate-700">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ComparativePage() {
  const planeQuery = usePlaneTeamMetrics();
  const githubQuery = useGitHubTeamMetrics();

  const isLoading = planeQuery.isLoading || githubQuery.isLoading;
  const isError = planeQuery.isError && githubQuery.isError;

  // Merge members
  const unified = useMemo(() => {
    if (!planeQuery.data && !githubQuery.data) return [];
    return mergeMembers(
      planeQuery.data?.members ?? [],
      githubQuery.data?.members ?? [],
    );
  }, [planeQuery.data, githubQuery.data]);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Default selection: first 3 members once data loads
  const effectiveSelectedIds = useMemo(() => {
    if (selectedIds.size > 0) return selectedIds;
    if (unified.length === 0) return new Set<string>();
    return new Set(
      unified.slice(0, Math.min(3, unified.length)).map((m) => m.id),
    );
  }, [selectedIds, unified]);

  const selectedMembers = useMemo(
    () => unified.filter((m) => effectiveSelectedIds.has(m.id)),
    [unified, effectiveSelectedIds],
  );

  const toggleMember = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev.size > 0 ? prev : effectiveSelectedIds);
        if (next.has(id)) {
          if (next.size <= MIN_SELECTED) return next;
          next.delete(id);
        } else {
          if (next.size >= MAX_SELECTED) return next;
          next.add(id);
        }
        return new Set(next);
      });
    },
    [effectiveSelectedIds],
  );

  // Map member id -> display name for tooltips
  const memberNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of unified) {
      map.set(m.id, m.name);
    }
    return map;
  }, [unified]);

  // Color map: member id -> color (stable based on selection order)
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    selectedMembers.forEach((m, i) => {
      map.set(m.id, MEMBER_COLORS[i % MEMBER_COLORS.length]);
    });
    return map;
  }, [selectedMembers]);

  // Chart data
  const radarData = useMemo(
    () => buildRadarData(selectedMembers),
    [selectedMembers],
  );
  const groupedBarData = useMemo(
    () => buildGroupedBarData(selectedMembers),
    [selectedMembers],
  );
  const comparisonRows = useMemo(
    () => buildComparisonRows(selectedMembers),
    [selectedMembers],
  );

  // Comparison table columns — dynamic based on selected members
  const comparisonColumns: Column[] = useMemo(() => {
    const cols: Column[] = [
      {
        key: "metric",
        label: "Metrica",
        render: (_v, row) => (
          <span className="font-medium text-slate-700">
            {String(row.metric)}
          </span>
        ),
      },
    ];

    selectedMembers.forEach((m, i) => {
      const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
      cols.push({
        key: m.id,
        label: m.initials,
        sortable: true,
        render: (_v, row) => {
          const val = Number(row[m.id]) ?? 0;
          const isBest = val === row._best && row._best !== -1;
          const isWorst = val === row._worst && row._worst !== -1;
          let textClass = "text-slate-700";
          if (isBest) textClass = "text-green-700 font-bold";
          if (isWorst) textClass = "text-red-600";

          return (
            <span
              className={`tabular-nums font-semibold ${textClass}`}
              style={{ borderLeft: `3px solid ${color}`, paddingLeft: 8 }}
            >
              {val % 1 === 0 ? val : val.toFixed(1)}
            </span>
          );
        },
      });
    });

    return cols;
  }, [selectedMembers]);

  // Error state
  if (isError && !isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Comparativa</h1>
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
        <h1 className="text-2xl font-bold text-slate-900">Comparativa</h1>
        <p className="mt-1 text-sm text-slate-500">
          Comparacion de rendimiento entre miembros del equipo
        </p>
      </div>

      {/* Member multi-selector with checkboxes */}
      {isLoading ? (
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="card" className="h-14 w-48" />
          ))}
        </div>
      ) : (
        <div>
          <p className="mb-2 text-xs text-slate-400">
            Selecciona entre {MIN_SELECTED} y {MAX_SELECTED} miembros para
            comparar ({effectiveSelectedIds.size} seleccionados)
          </p>
          <div className="flex flex-wrap gap-3">
            {unified.map((m) => {
              const isSelected = effectiveSelectedIds.has(m.id);
              const memberColor = isSelected
                ? colorMap.get(m.id) ?? MEMBER_COLORS[0]
                : "#94a3b8";
              const canDeselect = effectiveSelectedIds.size > MIN_SELECTED;
              const canSelect = effectiveSelectedIds.size < MAX_SELECTED;
              const canToggle = isSelected ? canDeselect : canSelect;

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMember(m.id)}
                  disabled={!canToggle && !isSelected}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 shadow-sm transition-all ${
                    isSelected
                      ? "border-transparent bg-white"
                      : "border-gray-100 bg-white opacity-60 hover:opacity-100"
                  } ${!canToggle && !isSelected ? "cursor-not-allowed" : "cursor-pointer"}`}
                  style={
                    isSelected
                      ? {
                          boxShadow: `0 0 0 2px ${memberColor}`,
                        }
                      : undefined
                  }
                >
                  {/* Checkbox */}
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      isSelected
                        ? "border-transparent text-white"
                        : "border-slate-300 bg-white"
                    }`}
                    style={
                      isSelected
                        ? { backgroundColor: memberColor }
                        : undefined
                    }
                  >
                    {isSelected && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="2 6 5 9 10 3" />
                      </svg>
                    )}
                  </div>
                  {/* Avatar */}
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: memberColor }}
                  >
                    {m.initials}
                  </div>
                  {/* Name */}
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-800">
                      {m.name}
                    </p>
                    {m.github_username && (
                      <p className="text-[11px] text-slate-400">
                        @{m.github_username}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts row: Radar + Grouped Bar */}
      {selectedMembers.length >= MIN_SELECTED && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Radar chart */}
          <ChartContainer
            title="Perfil de Habilidades"
            subtitle="Puntuacion normalizada (0-100)"
            height={320}
            loading={isLoading}
          >
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fontSize: 9 }}
              />
              {selectedMembers.map((m) => (
                <Radar
                  key={m.id}
                  name={m.name}
                  dataKey={m.id}
                  stroke={colorMap.get(m.id) ?? "#94a3b8"}
                  fill={colorMap.get(m.id) ?? "#94a3b8"}
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip
                content={
                  <RadarTooltipContent memberNames={memberNames} />
                }
              />
            </RadarChart>
          </ChartContainer>

          {/* Grouped bar chart */}
          <ChartContainer
            title="Comparacion de Metricas"
            subtitle="Valores absolutos del periodo"
            height={320}
            loading={isLoading}
          >
            <BarChart
              data={groupedBarData}
              margin={{ left: 4, right: 16, top: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                content={
                  <GroupedBarTooltip memberNames={memberNames} />
                }
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value: string) =>
                  memberNames.get(value) ?? value
                }
              />
              {selectedMembers.map((m) => (
                <Bar
                  key={m.id}
                  dataKey={m.id}
                  name={m.id}
                  fill={colorMap.get(m.id) ?? "#94a3b8"}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ChartContainer>
        </div>
      )}

      {/* Comparison table */}
      {selectedMembers.length >= MIN_SELECTED && (
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-700">
              Tabla Comparativa Detallada
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Valores absolutos del periodo — mejor en verde, menor en rojo
            </p>
          </div>

          {/* Member legend */}
          <div className="mb-4 flex flex-wrap gap-3">
            {selectedMembers.map((m) => {
              const color = colorMap.get(m.id) ?? "#94a3b8";
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 text-xs"
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-medium text-slate-600">
                    {m.initials} = {m.name}
                  </span>
                </div>
              );
            })}
          </div>

          <RankingTable
            columns={comparisonColumns}
            data={comparisonRows}
            loading={isLoading}
          />
        </div>
      )}

      {/* Not enough members selected */}
      {!isLoading && selectedMembers.length < MIN_SELECTED && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">
            Selecciona al menos {MIN_SELECTED} miembros para ver la
            comparacion.
          </p>
        </div>
      )}
    </div>
  );
}
