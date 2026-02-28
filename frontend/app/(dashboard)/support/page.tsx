'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import { MetricCardSkeleton, Skeleton } from '@/components/Skeleton';
import { useSupport, useActivateSupport, SupportProject } from '@/hooks/useSupport';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getSupportColor(daysRemaining: number): {
  bar: string;
  text: string;
  badge: 'success' | 'warning' | 'error';
  label: string;
} {
  if (daysRemaining > 10) {
    return { bar: 'bg-emerald-500', text: 'text-emerald-600', badge: 'success', label: 'En tiempo' };
  }
  if (daysRemaining >= 5) {
    return { bar: 'bg-amber-400', text: 'text-amber-600', badge: 'warning', label: 'Por vencer' };
  }
  return { bar: 'bg-red-500', text: 'text-red-600', badge: 'error', label: 'Crítico' };
}

function calcProgressPercent(project: SupportProject): number {
  if (project.total_support_days <= 0) return 100;
  const elapsed = project.total_support_days - Math.max(project.days_remaining, 0);
  return Math.min(100, Math.round((elapsed / project.total_support_days) * 100));
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function SupportCardSkeleton() {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <Skeleton className="h-9 w-36 rounded-lg" />
    </div>
  );
}

// ─── Active Support Card ─────────────────────────────────────────────────────

interface ActiveSupportCardProps {
  project: SupportProject;
  onActivate: (projectId: number) => void;
  isActivating: boolean;
}

function ActiveSupportCard({ project, onActivate, isActivating }: ActiveSupportCardProps) {
  const colors = getSupportColor(project.days_remaining);
  const progressPct = calcProgressPercent(project);

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 truncate">{project.name}</h3>
          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 text-slate-500">
            {project.identifier}
          </span>
        </div>
        <StatusBadge label={colors.label} variant={colors.badge} />
      </div>

      {/* Dates grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Inicio soporte</p>
          <p className="font-medium text-slate-700">{formatDate(project.support_start_date)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Fin soporte</p>
          <p className="font-medium text-slate-700">{formatDate(project.support_end_date)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Días totales</p>
          <p className="font-medium text-slate-700 tabular-nums">{project.total_support_days}d</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Días restantes</p>
          <p className={`font-bold tabular-nums text-base ${colors.text}`}>
            {project.days_remaining}d
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">Período consumido</span>
          <span className="text-xs font-medium text-slate-600 tabular-nums">{progressPct}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Activate button (for inactive eligible projects) */}
      {!project.is_active && (
        <button
          onClick={() => onActivate(project.id)}
          disabled={isActivating}
          className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isActivating ? 'Activando...' : 'Activar soporte'}
        </button>
      )}
    </div>
  );
}

// ─── Expired Row ─────────────────────────────────────────────────────────────

interface ExpiredRowProps {
  project: SupportProject;
  onActivate: (projectId: number) => void;
  isActivating: boolean;
}

function ExpiredRow({ project, onActivate, isActivating }: ExpiredRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-slate-700 truncate">{project.name}</span>
          <span className="text-xs font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
            {project.identifier}
          </span>
          <StatusBadge label="Vencido" variant="neutral" />
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
          <span>Inicio: {formatDate(project.support_start_date)}</span>
          <span>Fin: {formatDate(project.support_end_date)}</span>
          <span>{project.total_support_days}d totales</span>
        </div>
      </div>
      <button
        onClick={() => onActivate(project.id)}
        disabled={isActivating}
        className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isActivating ? 'Activando...' : 'Renovar soporte'}
      </button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const { data, isLoading, isError, refetch } = useSupport();
  const { mutate: activateSupport, isPending: isActivating, variables: activatingVars } = useActivateSupport();

  const [activatingId, setActivatingId] = useState<number | null>(null);

  const activeProjects = data?.active_support_projects ?? [];
  const expiredProjects = data?.expired_support_projects ?? [];
  const hasAnyData = activeProjects.length > 0 || expiredProjects.length > 0;

  function handleActivate(projectId: number) {
    setActivatingId(projectId);
    activateSupport(
      { projectId, payload: { is_support: true } },
      { onSettled: () => setActivatingId(null) },
    );
  }

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Soporte"
        subtitle="Proyectos en período de soporte y su estado"
      />

      {/* Summary metrics */}
      <section>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <MetricCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="card p-6 text-center">
            <p className="text-slate-500 text-sm">No se pudieron cargar las métricas de soporte.</p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Proyectos activos"
              value={data?.total_active ?? 0}
              subtitle="en soporte ahora"
            />
            <MetricCard
              title="En tiempo"
              value={activeProjects.filter((p) => p.days_remaining > 10).length}
              subtitle="más de 10 días restantes"
            />
            <MetricCard
              title="Por vencer"
              value={activeProjects.filter((p) => p.days_remaining >= 5 && p.days_remaining <= 10).length}
              subtitle="entre 5 y 10 días"
            />
            <MetricCard
              title="Críticos"
              value={activeProjects.filter((p) => p.days_remaining < 5).length}
              subtitle="menos de 5 días"
            />
          </div>
        )}
      </section>

      {/* Active support section */}
      <section>
        <h3 className="text-base font-semibold text-slate-800 mb-4">
          Soporte activo
          {!isLoading && (
            <span className="ml-2 text-sm font-normal text-slate-400">
              ({activeProjects.length})
            </span>
          )}
        </h3>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <SupportCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? null : activeProjects.length === 0 ? (
          <div className="card p-10 text-center">
            <svg
              className="w-14 h-14 text-slate-200 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <p className="text-slate-600 font-semibold">Sin proyectos en soporte activo</p>
            <p className="text-sm text-slate-400 mt-1">
              No hay proyectos con soporte vigente en este momento.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeProjects.map((project) => (
              <ActiveSupportCard
                key={project.id}
                project={project}
                onActivate={handleActivate}
                isActivating={isActivating && activatingId === project.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Expired support section */}
      {!isLoading && !isError && expiredProjects.length > 0 && (
        <section>
          <h3 className="text-base font-semibold text-slate-800 mb-4">
            Historial de soportes vencidos
            <span className="ml-2 text-sm font-normal text-slate-400">
              ({expiredProjects.length})
            </span>
          </h3>
          <div className="card px-5 py-2 divide-y divide-slate-100">
            {expiredProjects.map((project) => (
              <ExpiredRow
                key={project.id}
                project={project}
                onActivate={handleActivate}
                isActivating={isActivating && activatingId === project.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Global empty state */}
      {!isLoading && !isError && !hasAnyData && (
        <div className="card p-16 text-center">
          <svg
            className="w-16 h-16 text-slate-200 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <p className="text-slate-600 font-semibold text-lg">Sin registros de soporte</p>
          <p className="text-sm text-slate-400 mt-1">
            Aún no hay proyectos con períodos de soporte registrados.
          </p>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="card p-10 text-center">
          <svg
            className="w-12 h-12 text-red-300 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-slate-600 font-medium">No se pudo cargar la página de soporte</p>
          <p className="text-sm text-slate-400 mt-1">Intenta recargar la página</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
