'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, TableColumn } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { TableSkeleton } from '@/components/Skeleton';
import { useSyncSchedule, useUpdateSyncSchedule, useSyncHistory, SyncLog } from '@/hooks/useSettings';

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

export default function SettingsPage() {
  const scheduleQuery = useSyncSchedule();
  const updateMutation = useUpdateSyncSchedule();
  const historyQuery = useSyncHistory();

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
