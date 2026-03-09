'use client';

import { useSyncStatus, SyncStepStatus } from '@/hooks/useSyncStatus';
import { useSyncProgress, SyncStep, StepStatus } from '@/hooks/useSyncProgress';

function StepStatusIcon({ status }: { status: SyncStepStatus['status'] | StepStatus }) {
  if (status === 'running') {
    return (
      <span className="flex items-center justify-center w-7 h-7 flex-shrink-0">
        <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="flex items-center justify-center w-7 h-7 flex-shrink-0 rounded-full bg-emerald-100">
        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center justify-center w-7 h-7 flex-shrink-0 rounded-full bg-red-100">
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex items-center justify-center w-7 h-7 flex-shrink-0 rounded-full border-2 border-slate-300 bg-white" />
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toFixed(0)}s`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function SyncStepRow({ step }: { step: SyncStep }) {
  const labelColor =
    step.status === 'completed'
      ? 'text-slate-700'
      : step.status === 'error'
      ? 'text-red-700'
      : step.status === 'running'
      ? 'text-blue-700 font-medium'
      : 'text-slate-400';

  return (
    <li className="flex items-center gap-3 py-3">
      <StepStatusIcon status={step.status} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${labelColor} transition-colors duration-200`}>{step.label}</p>
        {step.status === 'completed' && step.records_synced !== undefined && (
          <p className="text-xs text-slate-400 mt-0.5">{step.records_synced} registros sincronizados</p>
        )}
        {step.status === 'error' && step.error && (
          <p className="text-xs text-red-500 mt-0.5">{step.error}</p>
        )}
      </div>
    </li>
  );
}

export default function SyncPage() {
  const { data, isLoading, error } = useSyncStatus();
  const sync = useSyncProgress();

  const isSyncing = sync.isRunning;
  const isDone = sync.status === 'completed' || sync.status === 'error';
  const hasPartialErrors = sync.errors.length > 0 && sync.status === 'completed';

  if (isLoading && sync.status === 'idle') {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-slate-200 rounded" />
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  // useSyncStatus may fail (e.g. endpoint not available) — page is still usable

  const lastSync = data?.last_sync ?? null;

  const progressBarColor =
    sync.status === 'error'
      ? 'bg-red-500'
      : hasPartialErrors
      ? 'bg-amber-500'
      : isSyncing
      ? 'bg-blue-600'
      : 'bg-emerald-500';

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Sincronización</h1>
        {!isSyncing && (
          <button
            onClick={() => sync.startSync()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Iniciar sincronización
          </button>
        )}
      </div>

      {/* Sync progress (inline) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Estado actual</h2>
        </div>

        {isSyncing || isDone ? (
          <div className="p-6 space-y-4">
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-500">Progreso general</span>
                <span className="text-xs font-medium text-slate-700">{sync.progress}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${progressBarColor}`}
                  style={{ width: `${sync.progress}%` }}
                  role="progressbar"
                  aria-valuenow={sync.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>

            {/* Steps */}
            {sync.steps.length === 0 && isSyncing && (
              <p className="text-sm text-slate-400 py-4 text-center">Iniciando sincronización...</p>
            )}
            {sync.steps.length > 0 && (
              <ul className="divide-y divide-slate-50" aria-label="Pasos de sincronización">
                {sync.steps.map((step) => (
                  <SyncStepRow key={step.id} step={step} />
                ))}
              </ul>
            )}

            {/* Summary */}
            {isDone && sync.results && (
              <div
                className={`rounded-xl p-4 ${
                  hasPartialErrors
                    ? 'bg-amber-50 border border-amber-200'
                    : sync.status === 'error'
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-emerald-50 border border-emerald-200'
                }`}
              >
                <p className={`text-sm font-medium mb-2 ${
                  hasPartialErrors ? 'text-amber-800' : sync.status === 'error' ? 'text-red-800' : 'text-emerald-800'
                }`}>
                  {sync.status === 'error'
                    ? 'Sincronización fallida'
                    : hasPartialErrors
                    ? 'Sincronización completada con errores'
                    : 'Sincronización completada'}
                </p>
                <div className="flex gap-4 text-xs">
                  <span className="text-emerald-700 font-medium">
                    {sync.results.completed_steps} completados
                  </span>
                  {sync.results.failed_steps > 0 && (
                    <span className="text-red-600 font-medium">
                      {sync.results.failed_steps} fallidos
                    </span>
                  )}
                  {sync.results.duration_seconds !== undefined && (
                    <span className="text-slate-500">
                      {sync.results.duration_seconds.toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Errors (when no results summary) */}
            {isDone && sync.errors.length > 0 && !sync.results && (
              <div className="rounded-xl p-4 bg-red-50 border border-red-200">
                <p className="text-sm font-medium text-red-800 mb-1">Errores encontrados</p>
                <ul className="space-y-0.5">
                  {sync.errors.map((err, idx) => (
                    <li key={idx} className="text-xs text-red-600">{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">Sin sincronización en curso</p>
            <p className="text-xs text-slate-400 mt-1">
              Presiona &quot;Iniciar sincronización&quot; para comenzar
            </p>
          </div>
        )}
      </div>

      {/* Last sync info */}
      {lastSync && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Última sincronización</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Estado</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  lastSync.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {lastSync.status === 'completed' ? 'Completada' : 'Fallida'}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Fecha</p>
                <p className="text-sm text-slate-700">{formatDateTime(lastSync.started_at)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Duración</p>
                <p className="text-sm text-slate-700">
                  {lastSync.duration_seconds != null
                    ? formatDuration(lastSync.duration_seconds)
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Errores</p>
                <p className={`text-sm font-medium ${lastSync.error_count > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {lastSync.error_count}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
