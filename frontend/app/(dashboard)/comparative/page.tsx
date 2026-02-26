"use client";

import { ChartContainer } from "@/components/ChartContainer";
import { RankingTable, Column, Row } from "@/components/RankingTable";
import { StatusBadge } from "@/components/StatusBadge";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip,
} from "recharts";

// ── Mock data ──────────────────────────────────────────────────────────────────

const radarData = [
  { metric: "Story Points", AR: 85, LM: 70, CP: 55 },
  { metric: "Tareas", AR: 80, LM: 67, CP: 60 },
  { metric: "PRs", AR: 100, LM: 75, CP: 50 },
  { metric: "Commits", AR: 94, LM: 62, CP: 58 },
  { metric: "Calidad", AR: 78, LM: 82, CP: 70 },
];

const comparisonColumns: Column[] = [
  {
    key: "metric",
    label: "Métrica",
    render: (_v, row) => (
      <span className="font-medium text-slate-700">{String(row.metric)}</span>
    ),
  },
  {
    key: "AR",
    label: "Ana R.",
    sortable: true,
    render: (_v, row) => (
      <span className="tabular-nums font-semibold text-blue-700">
        {String(row.AR)}
      </span>
    ),
  },
  {
    key: "LM",
    label: "Luis M.",
    sortable: true,
    render: (_v, row) => (
      <span className="tabular-nums font-semibold text-green-700">
        {String(row.LM)}
      </span>
    ),
  },
  {
    key: "CP",
    label: "Carlos P.",
    sortable: true,
    render: (_v, row) => (
      <span className="tabular-nums font-semibold text-orange-600">
        {String(row.CP)}
      </span>
    ),
  },
];

const comparisonRows: Row[] = [
  { metric: "Story Points", AR: 34, LM: 28, CP: 22 },
  { metric: "Tareas completadas", AR: 12, LM: 10, CP: 9 },
  { metric: "PRs mergeados", AR: 8, LM: 6, CP: 4 },
  { metric: "Commits", AR: 47, LM: 31, CP: 29 },
  { metric: "Velocidad (pts/sem)", AR: 8.5, LM: 7.0, CP: 5.5 },
];

const memberBadges = [
  { initials: "AR", name: "Ana Rodríguez", color: "#1e40af", status: "green" as const },
  { initials: "LM", name: "Luis Martínez", color: "#16a34a", status: "green" as const },
  { initials: "CP", name: "Carlos Pérez", color: "#ea580c", status: "yellow" as const },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ComparativePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Comparativa</h1>
        <p className="mt-1 text-sm text-slate-500">
          Comparación de rendimiento entre miembros del equipo
        </p>
      </div>

      {/* Member legend */}
      <div className="flex flex-wrap gap-3">
        {memberBadges.map((m) => (
          <div
            key={m.initials}
            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-2.5 shadow-sm"
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: m.color }}
            >
              {m.initials}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{m.name}</p>
            </div>
            <StatusBadge status={m.status} size="sm" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Radar chart */}
        <ChartContainer
          title="Perfil de Habilidades"
          subtitle="Puntuación normalizada (0–100)"
          height={300}
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
            <Radar
              name="Ana R."
              dataKey="AR"
              stroke="#1e40af"
              fill="#1e40af"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Radar
              name="Luis M."
              dataKey="LM"
              stroke="#16a34a"
              fill="#16a34a"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Radar
              name="Carlos P."
              dataKey="CP"
              stroke="#ea580c"
              fill="#ea580c"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            />
          </RadarChart>
        </ChartContainer>

        {/* Comparison table */}
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-700">
              Tabla Comparativa
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Valores absolutos del período</p>
          </div>
          <RankingTable
            columns={comparisonColumns}
            data={comparisonRows}
          />
        </div>
      </div>
    </div>
  );
}
