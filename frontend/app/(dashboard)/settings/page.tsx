'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, TableColumn } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { TableSkeleton } from '@/components/Skeleton';
import { useSyncSchedule, useUpdateSyncSchedule, useSyncHistory, SyncLog } from '@/hooks/useSettings';
import { useTeamMembers, useUpdateGithubUsername, useUpdateTeamMember, useGitHubOrgMembers, TeamMember, GitHubOrgMember } from '@/hooks/useTeamMembers';
import { useGitHubRepos, useUpdateGitHubRepo } from '@/hooks/useGitHubRepos';
import { useProjectsList, useUpdateProjectType, ProjectType } from '@/hooks/useProjectSettings';

// Common timezones list
const TIMEZONES = [
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Sao_Paulo',
  'America/Mexico_City',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/Madrid',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'UTC',
];

type SyncLogRow = Record<string, unknown> & {
  id: number;
  sync_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  records_synced: number | null;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function validateTime(value: string): string | null {
  if (!value) return 'La hora es obligatoria';
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return 'Formato de hora inválido (HH:MM)';
  return null;
}

const historyColumns: TableColumn<SyncLogRow>[] = [
  {
    key: 'started_at',
    label: 'Fecha',
    sortable: true,
    render: (value) => formatDateTime(value as string | null),
  },
  {
    key: 'sync_type',
    label: 'Tipo',
    sortable: true,
    render: (value) => (
      <span className="font-medium text-slate-700">{String(value ?? '—')}</span>
    ),
  },
  {
    key: 'status',
    label: 'Estado',
    sortable: true,
    render: (value) => {
      const status = String(value ?? '');
      if (status === 'completed' || status === 'success') {
        return <StatusBadge label="Completado" variant="success" />;
      }
      if (status === 'error' || status === 'failed') {
        return <StatusBadge label="Error" variant="error" />;
      }
      if (status === 'running') {
        return <StatusBadge label="En progreso" variant="in-progress" />;
      }
      return <StatusBadge label={status || '—'} variant="neutral" />;
    },
  },
  {
    key: 'duration_seconds',
    label: 'Duración',
    render: (value) => formatDuration(value as number | null),
  },
  {
    key: 'error_message',
    label: 'Error',
    render: (value) => {
      if (!value) return <span className="text-slate-400 text-xs">—</span>;
      return (
        <span className="text-red-600 text-xs truncate max-w-xs block" title={String(value)}>
          {String(value)}
        </span>
      );
    },
  },
];

function toSyncLogRow(log: SyncLog): SyncLogRow {
  return { ...log } as SyncLogRow;
}

function GitHubLinkRow({
  member,
  ghMembers,
  alreadyLinked,
  onSave,
  onToggleActive,
}: {
  member: TeamMember;
  ghMembers: GitHubOrgMember[];
  alreadyLinked: Set<string>;
  onSave: (id: number, username: string | null) => void;
  onToggleActive: (id: number, isActive: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState('');

  // Available GitHub members for dropdown: not yet linked by another team member
  const available = ghMembers.filter(
    (gh) =>
      !alreadyLinked.has(gh.login.toLowerCase()) ||
      gh.login.toLowerCase() === (member.github_username ?? '').toLowerCase(),
  );

  const filtered = filter
    ? available.filter((gh) =>
        gh.login.toLowerCase().includes(filter.toLowerCase()),
      )
    : available;

  function handleSelect(login: string) {
    onSave(member.id, login);
    setEditing(false);
    setFilter('');
  }

  function handleUnlink() {
    onSave(member.id, null);
  }

  function handleCancel() {
    setEditing(false);
    setFilter('');
  }

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt={member.name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-500">
              {member.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-800">{member.name}</p>
            {member.email && (
              <p className="text-xs text-slate-400">{member.email}</p>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 px-4 relative">
        {editing ? (
          <div className="relative">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Buscar usuario de GitHub..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancel();
                }}
                className="w-56 rounded-lg border border-blue-400 px-3 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCancel}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                title="Cancelar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="absolute z-10 mt-1 w-56 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
              {filtered.length === 0 ? (
                <p className="text-xs text-slate-400 p-3 text-center">
                  No se encontraron usuarios
                </p>
              ) : (
                filtered.map((gh) => (
                  <button
                    key={gh.login}
                    onClick={() => handleSelect(gh.login)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 transition-colors"
                  >
                    {gh.avatar_url ? (
                      <img
                        src={gh.avatar_url}
                        alt={gh.login}
                        className="w-5 h-5 rounded-full"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-200" />
                    )}
                    <span className="text-sm text-slate-700 font-mono">
                      {gh.login}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {member.github_username ? (
              <>
                <span className="text-sm text-slate-700 font-mono">@{member.github_username}</span>
                <button
                  onClick={() => setEditing(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Cambiar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={handleUnlink}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Desvincular"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Vincular
              </button>
            )}
          </div>
        )}
      </td>
      <td className="py-3 px-4">
        <button
          type="button"
          role="switch"
          aria-checked={member.is_active}
          onClick={() => onToggleActive(member.id, !member.is_active)}
          className={`
            relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none
            focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${member.is_active ? 'bg-emerald-500' : 'bg-slate-300'}
          `}
          title={member.is_active ? 'Activo — clic para desactivar' : 'Inactivo — clic para activar'}
        >
          <span
            className={`
              inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform
              ${member.is_active ? 'translate-x-5' : 'translate-x-0.5'}
            `}
          />
        </button>
      </td>
    </tr>
  );
}

export default function SettingsPage() {
  const scheduleQuery = useSyncSchedule();
  const updateMutation = useUpdateSyncSchedule();
  const historyQuery = useSyncHistory();
  const teamMembersQuery = useTeamMembers();
  const ghOrgMembersQuery = useGitHubOrgMembers();
  const updateGithubMutation = useUpdateGithubUsername();
  const updateMemberMutation = useUpdateTeamMember();
  const reposQuery = useGitHubRepos();
  const updateRepoMutation = useUpdateGitHubRepo();
  const projectsSettingsQuery = useProjectsList();
  const updateProjectTypeMutation = useUpdateProjectType();

  const [linkSaveSuccess, setLinkSaveSuccess] = useState<number | null>(null);
  const [linkSaveError, setLinkSaveError] = useState<string | null>(null);

  async function handleGithubSave(memberId: number, username: string | null) {
    setLinkSaveError(null);
    try {
      await updateGithubMutation.mutateAsync({ memberId, github_username: username });
      setLinkSaveSuccess(memberId);
      setTimeout(() => setLinkSaveSuccess(null), 2000);
    } catch {
      setLinkSaveError('No se pudo guardar. Verifica el nombre de usuario e intenta de nuevo.');
    }
  }

  async function handleToggleActive(memberId: number, isActive: boolean) {
    try {
      await updateMemberMutation.mutateAsync({ memberId, is_active: isActive });
    } catch {
      setLinkSaveError('No se pudo cambiar el estado del miembro.');
    }
  }

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('08:00');
  const [timezone, setTimezone] = useState('America/Argentina/Buenos_Aires');
  const [timeError, setTimeError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync form with fetched data
  useEffect(() => {
    if (scheduleQuery.data) {
      setEnabled(scheduleQuery.data.enabled);
      setScheduledTime(scheduleQuery.data.scheduled_time ?? '08:00');
      setTimezone(scheduleQuery.data.timezone ?? 'America/Argentina/Buenos_Aires');
    }
  }, [scheduleQuery.data]);

  function handleTimeChange(value: string) {
    setScheduledTime(value);
    setTimeError(validateTime(value));
    setSaveSuccess(false);
  }

  function handleEnabledChange(value: boolean) {
    setEnabled(value);
    setSaveSuccess(false);
  }

  function handleTimezoneChange(value: string) {
    setTimezone(value);
    setSaveSuccess(false);
  }

  async function handleSave() {
    const error = validateTime(scheduledTime);
    if (error) {
      setTimeError(error);
      return;
    }

    setSaveSuccess(false);

    try {
      await updateMutation.mutateAsync({ enabled, scheduled_time: scheduledTime, timezone });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Error is surfaced via updateMutation.error
    }
  }

  const schedule = scheduleQuery.data;
  const isLoadingSchedule = scheduleQuery.isLoading;
  const scheduleError = scheduleQuery.error;
  const isSaving = updateMutation.isPending;
  const saveError = updateMutation.error;

  const history = historyQuery.data ?? [];
  const isLoadingHistory = historyQuery.isLoading;
  const historyError = historyQuery.error;

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Configuración"
        subtitle="Configuración del dashboard y preferencias del sistema"
      />

      {/* Sync Schedule Section */}
      <section className="card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Sincronización Automática</h3>
            <p className="mt-1 text-sm text-slate-500">
              Configura cuándo se sincronizan automáticamente los datos de Plane y GitHub.
            </p>
          </div>
        </div>

        {isLoadingSchedule ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-10 bg-slate-100 rounded-lg w-48" />
            <div className="h-10 bg-slate-100 rounded-lg w-64" />
            <div className="h-10 bg-slate-100 rounded-lg w-56" />
            <div className="h-10 bg-slate-100 rounded-lg w-32" />
          </div>
        ) : scheduleError ? (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-700">No se pudo cargar la configuración de sincronización.</p>
              <button
                onClick={() => scheduleQuery.refetch()}
                className="mt-2 text-sm text-red-600 underline hover:text-red-800"
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Toggle */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => handleEnabledChange(!enabled)}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                  focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  ${enabled ? 'bg-blue-600' : 'bg-slate-300'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform
                    ${enabled ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
              <span className="text-sm font-medium text-slate-700">
                {enabled ? 'Sincronización automática activada' : 'Sincronización automática desactivada'}
              </span>
            </div>

            {/* Time input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="scheduled_time" className="text-sm font-medium text-slate-700">
                Hora de sincronización
              </label>
              <input
                id="scheduled_time"
                type="time"
                value={scheduledTime}
                onChange={(e) => handleTimeChange(e.target.value)}
                disabled={!enabled}
                className={`
                  w-40 rounded-lg border px-3 py-2 text-sm text-slate-800 bg-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
                  ${timeError ? 'border-red-400' : 'border-slate-300'}
                `}
              />
              {timeError && (
                <p className="text-xs text-red-600">{timeError}</p>
              )}
            </div>

            {/* Timezone select */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="timezone" className="text-sm font-medium text-slate-700">
                Zona horaria
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => handleTimezoneChange(e.target.value)}
                disabled={!enabled}
                className={`
                  w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
                `}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            {/* Save error */}
            {saveError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">No se pudo guardar la configuración. Intenta de nuevo.</p>
              </div>
            )}

            {/* Save success */}
            {saveSuccess && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-emerald-700 font-medium">Configuración guardada correctamente.</p>
              </div>
            )}

            {/* Save button */}
            <div>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !!timeError}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  ${isSaving || timeError
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }
                `}
              >
                {isSaving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Guardando...
                  </>
                ) : (
                  'Guardar configuración'
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* GitHub Linking Section */}
      <section className="card p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Vincular Usuarios de GitHub</h3>
          <p className="mt-1 text-sm text-slate-500">
            Vincula cada miembro del equipo (Plane) con su usuario de GitHub para integrar las métricas de commits y pull requests.
          </p>
        </div>

        {linkSaveError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700">{linkSaveError}</p>
          </div>
        )}

        {linkSaveSuccess && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-emerald-700 font-medium">Usuario de GitHub actualizado.</p>
          </div>
        )}

        {teamMembersQuery.isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : teamMembersQuery.error ? (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-700">No se pudo cargar la lista de miembros.</p>
            <button
              onClick={() => teamMembersQuery.refetch()}
              className="mt-2 text-sm text-red-600 underline hover:text-red-800"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {ghOrgMembersQuery.isLoading && (
              <p className="text-xs text-slate-400 mb-2">Cargando usuarios de GitHub...</p>
            )}
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide py-2 px-4">
                    Miembro (Plane)
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide py-2 px-4">
                    Usuario GitHub
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide py-2 px-4">
                    Activo
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const ghMembers = ghOrgMembersQuery.data ?? [];
                  const alreadyLinked = new Set(
                    (teamMembersQuery.data ?? [])
                      .filter((m) => m.github_username)
                      .map((m) => m.github_username!.toLowerCase()),
                  );
                  return (teamMembersQuery.data ?? []).map((member) => (
                    <GitHubLinkRow
                      key={member.id}
                      member={member}
                      ghMembers={ghMembers}
                      alreadyLinked={alreadyLinked}
                      onSave={handleGithubSave}
                      onToggleActive={handleToggleActive}
                    />
                  ));
                })()}
              </tbody>
            </table>
            {(teamMembersQuery.data ?? []).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">
                No hay miembros del equipo. Ejecuta una sincronización primero.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Project Type Section */}
      <section className="card p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Tipo de Proyecto</h3>
          <p className="mt-1 text-sm text-slate-500">
            Clasifica cada proyecto como Cliente, Soporte o Interno para filtrar las métricas.
          </p>
        </div>

        {projectsSettingsQuery.isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : projectsSettingsQuery.error ? (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-700">No se pudo cargar la lista de proyectos.</p>
            <button
              onClick={() => projectsSettingsQuery.refetch()}
              className="mt-2 text-sm text-red-600 underline hover:text-red-800"
            >
              Reintentar
            </button>
          </div>
        ) : (projectsSettingsQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">
            No hay proyectos registrados. Ejecuta una sincronización primero.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide py-2 px-4">
                    Proyecto
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide py-2 px-4">
                    Tipo
                  </th>
                </tr>
              </thead>
              <tbody>
                {(projectsSettingsQuery.data ?? []).map((proj) => (
                  <tr key={proj.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{proj.name}</span>
                        {proj.identifier && (
                          <span className="text-xs font-mono text-slate-400">{proj.identifier}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={proj.project_type}
                        onChange={(e) =>
                          updateProjectTypeMutation.mutate({
                            projectId: proj.id,
                            project_type: e.target.value as ProjectType,
                          })
                        }
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="client">Cliente</option>
                        <option value="support">Soporte</option>
                        <option value="internal">Interno</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* GitHub Repositories Section */}
      <section className="card p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Repositorios GitHub</h3>
          <p className="mt-1 text-sm text-slate-500">
            Desactiva repositorios legacy o irrelevantes para excluirlos de las métricas.
          </p>
        </div>

        {reposQuery.isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : reposQuery.error ? (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-700">No se pudo cargar la lista de repositorios.</p>
            <button
              onClick={() => reposQuery.refetch()}
              className="mt-2 text-sm text-red-600 underline hover:text-red-800"
            >
              Reintentar
            </button>
          </div>
        ) : (reposQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">
            No hay repositorios registrados. Ejecuta una sincronización de GitHub primero.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide py-2 px-4">
                    Repositorio
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide py-2 px-4">
                    Activo en métricas
                  </th>
                </tr>
              </thead>
              <tbody>
                {(reposQuery.data ?? []).map((repo) => (
                  <tr key={repo.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <span className={`text-sm font-mono ${repo.is_active ? 'text-slate-800' : 'text-slate-400'}`}>
                          {repo.repo_name}
                        </span>
                        {!repo.is_active && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                            Excluido
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={repo.is_active}
                        onClick={() => updateRepoMutation.mutate({ repoId: repo.id, is_active: !repo.is_active })}
                        className={`
                          relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none
                          focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                          ${repo.is_active ? 'bg-emerald-500' : 'bg-slate-300'}
                        `}
                        title={repo.is_active ? 'Activo — clic para excluir de métricas' : 'Excluido — clic para incluir en métricas'}
                      >
                        <span
                          className={`
                            inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform
                            ${repo.is_active ? 'translate-x-5' : 'translate-x-0.5'}
                          `}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Current Status Section */}
      <section className="card p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-800">Estado Actual</h3>

        {isLoadingSchedule ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
            <div className="h-16 bg-slate-100 rounded-lg" />
            <div className="h-16 bg-slate-100 rounded-lg" />
          </div>
        ) : scheduleError ? (
          <p className="text-sm text-slate-500">No se pudo cargar el estado actual.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Próxima ejecución programada
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {schedule?.enabled
                  ? formatDateTime(schedule.next_run_at)
                  : <span className="text-slate-400 font-normal">Sincronización desactivada</span>
                }
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Última ejecución
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {schedule?.last_run_at
                  ? formatDateTime(schedule.last_run_at)
                  : <span className="text-slate-400 font-normal">Sin ejecuciones previas</span>
                }
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Sync History Section */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-slate-800">Historial de Sincronizaciones</h3>

        {isLoadingHistory ? (
          <TableSkeleton rows={5} cols={5} />
        ) : historyError ? (
          <div className="card p-6 text-center">
            <p className="text-slate-500 text-sm">No se pudo cargar el historial de sincronizaciones.</p>
            <button
              onClick={() => historyQuery.refetch()}
              className="mt-3 px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <DataTable<SyncLogRow>
            columns={historyColumns}
            data={history.map(toSyncLogRow)}
            emptyMessage="No hay sincronizaciones registradas todavía."
          />
        )}
      </section>
    </div>
  );
}
