"use client";

import { useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ChartContainer } from "@/components/ChartContainer";
import { CheckCircleIcon, GitPullRequestIcon, ClockIcon } from "@/components/icons";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// ── Mock data ──────────────────────────────────────────────────────────────────

const members = [
  {
    id: 1,
    name: "Ana Rodríguez",
    initials: "AR",
    role: "Senior Dev",
    status: "green" as const,
    points: 34,
    tasks: 12,
    prs: 8,
    commits: 47,
    trend: [
      { week: "S1", points: 6 },
      { week: "S2", points: 9 },
      { week: "S3", points: 11 },
      { week: "S4", points: 8 },
    ],
  },
  {
    id: 2,
    name: "Luis Martínez",
    initials: "LM",
    role: "Full Stack Dev",
    status: "yellow" as const,
    points: 28,
    tasks: 10,
    prs: 6,
    commits: 31,
    trend: [
      { week: "S1", points: 8 },
      { week: "S2", points: 7 },
      { week: "S3", points: 6 },
      { week: "S4", points: 7 },
    ],
  },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PersonPage() {
  const [selectedId, setSelectedId] = useState(members[0].id);
  const member = members.find((m) => m.id === selectedId) ?? members[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Por Persona</h1>
        <p className="mt-1 text-sm text-slate-500">
          Métricas individuales del período seleccionado
        </p>
      </div>

      {/* Member selector */}
      <div className="flex flex-wrap gap-3">
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedId(m.id)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
              selectedId === m.id
                ? "border-brand-600 bg-brand-50 shadow-sm"
                : "border-gray-100 bg-white shadow-sm hover:border-brand-200 hover:bg-blue-50"
            }`}
          >
            <div
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                selectedId === m.id
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {m.initials}
            </div>
            <div>
              <p
                className={`text-sm font-semibold ${
                  selectedId === m.id ? "text-brand-700" : "text-slate-800"
                }`}
              >
                {m.name}
              </p>
              <p className="text-xs text-slate-400">{m.role}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Selected member header */}
      <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
          {member.initials}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900">{member.name}</h2>
          <p className="text-sm text-slate-500">{member.role}</p>
        </div>
        <StatusBadge status={member.status} />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          title="Story Points"
          value={member.points}
          trend="up"
          trendValue="+12%"
          icon={<ClockIcon size={18} />}
        />
        <MetricCard
          title="Tareas"
          value={member.tasks}
          icon={<CheckCircleIcon size={18} />}
        />
        <MetricCard
          title="PRs mergeados"
          value={member.prs}
          icon={<GitPullRequestIcon size={18} />}
        />
        <MetricCard
          title="Commits"
          value={member.commits}
          trend="up"
          trendValue="+8"
        />
      </div>

      {/* Trend chart */}
      <ChartContainer
        title="Story Points por semana"
        subtitle={`Tendencia de ${member.name}`}
        height={220}
      >
        <AreaChart
          data={member.trend}
          margin={{ left: 0, right: 16, top: 8, bottom: 4 }}
        >
          <defs>
            <linearGradient id="gradPoints" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          />
          <Area
            type="monotone"
            dataKey="points"
            stroke="#2563eb"
            strokeWidth={2}
            fill="url(#gradPoints)"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
