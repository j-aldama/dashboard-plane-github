'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/Skeleton';
import { usePersonList, PersonItem } from '@/hooks/usePersonList';

// ─── Inline skeleton for person cards ───────────────────────────────────────

function PersonCardSkeleton() {
  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Crown icon for top performer ───────────────────────────────────────────

function CrownIcon() {
  return (
    <svg
      className="w-4 h-4 text-amber-400"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-label="Top performer"
    >
      <path d="M2 19l2-10 5 5 3-8 3 8 5-5 2 10H2zm2 2h16v1H4v-1z" />
    </svg>
  );
}

// ─── Avatar with initials fallback ───────────────────────────────────────────

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
      />
    );
  }

  return (
    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center flex-shrink-0 select-none">
      {initials || '?'}
    </div>
  );
}

// ─── Person card ─────────────────────────────────────────────────────────────

interface PersonCardProps {
  person: PersonItem;
  isTopPerformer: boolean;
}

function PersonCard({ person, isTopPerformer }: PersonCardProps) {
  return (
    <Link
      href={`/person/${person.id}`}
      className="card p-5 flex flex-col gap-4 hover:shadow-md hover:border-blue-200 transition-all duration-150 cursor-pointer group"
    >
      {/* Header: avatar + name + crown */}
      <div className="flex items-center gap-3">
        <Avatar name={person.name} avatarUrl={person.avatar_url} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
              {person.name}
            </h3>
            {isTopPerformer && <CrownIcon />}
          </div>
          {person.github_username ? (
            <p className="text-xs text-slate-400 truncate mt-0.5">
              @{person.github_username}
            </p>
          ) : (
            <p className="text-xs text-slate-300 italic mt-0.5">Sin GitHub</p>
          )}
        </div>
        {/* Top performer badge */}
        {isTopPerformer && (
          <span className="flex-shrink-0 text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5">
            Top
          </span>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Tareas completadas</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">
            {person.tasks_completed}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Puntos completados</p>
          <p className="text-lg font-bold text-slate-700 tabular-nums">
            {person.points_completed}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Commits</p>
          <p className="text-lg font-bold text-blue-600 tabular-nums">
            {person.commits}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">PRs merged</p>
          <p className="text-lg font-bold text-violet-600 tabular-nums">
            {person.prs_merged}
          </p>
        </div>
      </div>

      {/* Footer: workload pill */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 -mb-1">
        <span className="text-xs text-slate-400">
          Carga activa:{' '}
          <span className="font-medium text-slate-600">{person.active_workload}</span>
        </span>
        {person.overdue_tasks > 0 && (
          <span className="text-xs font-semibold text-red-500">
            {person.overdue_tasks} vencida{person.overdue_tasks !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </Link>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PersonPage() {
  const { data, isLoading, isError } = usePersonList();
  const [search, setSearch] = useState('');

  const members = data?.members ?? [];

  // Determine top performer by tasks_completed (rank 1)
  const topPerformerId = useMemo(() => {
    const sorted = [...members].sort(
      (a, b) => b.tasks_completed - a.tasks_completed,
    );
    return sorted[0]?.id ?? null;
  }, [members]);

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.trim().toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.github_username?.toLowerCase().includes(q) ?? false),
    );
  }, [members, search]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Personas"
        subtitle="Métricas individuales por miembro del equipo"
      />

      {/* Search input */}
      <div className="relative max-w-sm">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Results count */}
      {!isLoading && !isError && (
        <p className="text-sm text-slate-500">
          {filtered.length === members.length
            ? `${members.length} persona${members.length !== 1 ? 's' : ''}`
            : `${filtered.length} de ${members.length} personas`}
        </p>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <PersonCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="card p-8 text-center">
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
          <p className="text-slate-600 font-medium">No se pudieron cargar los miembros</p>
          <p className="text-sm text-slate-400 mt-1">Intenta recargar la página</p>
        </div>
      )}

      {/* Empty state — no members synced at all */}
      {!isLoading && !isError && members.length === 0 && (
        <div className="card p-12 text-center">
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
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <p className="text-slate-600 font-semibold text-lg">
            No hay miembros sincronizados
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Ejecuta una sincronización para ver los miembros del equipo.
          </p>
        </div>
      )}

      {/* No results after search */}
      {!isLoading && !isError && members.length > 0 && filtered.length === 0 && (
        <div className="card p-10 text-center">
          <svg
            className="w-12 h-12 text-slate-200 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-slate-600 font-medium">Sin resultados</p>
          <p className="text-sm text-slate-400 mt-1">
            Ningún miembro coincide con la búsqueda.
          </p>
        </div>
      )}

      {/* Person grid */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              isTopPerformer={person.id === topPerformerId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
