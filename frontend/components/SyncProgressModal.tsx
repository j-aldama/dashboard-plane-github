'use client';
import { useEffect, useRef } from 'react';
import { useSyncProgress, SyncStep, StepStatus } from '@/hooks/useSyncProgress';

interface SyncProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'running') {
    return (
      <span className="flex items-center justify-center w-6 h-6 flex-shrink-0">
        <svg
          className="w-5 h-5 text-blue-500 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </span>
    );
  }

  if (status === 'completed') {
    return (
      <span className="flex items-center justify-center w-6 h-6 flex-shrink-0 rounded-full bg-emerald-100">
        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="flex items-center justify-center w-6 h-6 flex-shrink-0 rounded-full bg-red-100">
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    );
  }

  // pending
  return (
    <span className="flex items-center justify-center w-6 h-6 flex-shrink-0 rounded-full border-2 border-slate-300 bg-white" aria-hidden="true" />
  );
}

function StepRow({ step }: { step: SyncStep }) {
  const labelColor =
    step.status === 'completed'
      ? 'text-slate-700'
      : step.status === 'error'
      ? 'text-red-700'
      : step.status === 'running'
      ? 'text-blue-700 font-medium'
      : 'text-slate-400';

  return (
    <li className="flex items-start gap-3 py-2">
      <StepIcon status={step.status} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${labelColor} transition-colors duration-200`}>{step.label}</p>
        {step.status === 'completed' && step.records_synced !== undefined && (
          <p className="text-xs text-slate-400 mt-0.5">{step.records_synced} registros sincronizados</p>
        )}
        {step.status === 'error' && step.error && (
          <p className="text-xs text-red-500 mt-0.5 truncate">{step.error}</p>
        )}
      </div>
    </li>
  );
}

export function SyncProgressModal({ isOpen, onClose }: SyncProgressModalProps) {
  const { startSync, steps, progress, status, results, errors, isRunning } = useSyncProgress();
  const startedRef = useRef(false);

  useEffect(() => {
    if (isOpen && !startedRef.current) {
      startedRef.current = true;
      startSync();
    }
    if (!isOpen) {
      startedRef.current = false;
    }
  }, [isOpen, startSync]);

  if (!isOpen) return null;

  const isDone = status === 'completed' || status === 'error';
  const hasPartialErrors = errors.length > 0 && status === 'completed';

  const progressBarColor =
    status === 'error'
      ? 'bg-red-500'
      : hasPartialErrors
      ? 'bg-amber-500'
      : 'bg-blue-600';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-modal-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={isDone ? onClose : undefined}
      />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="sync-modal-title" className="text-base font-semibold text-slate-900">
            Sincronización en progreso
          </h2>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Cerrar modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500">Progreso general</span>
            <span className="text-xs font-medium text-slate-700">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${progressBarColor}`}
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Step list */}
        <div className="px-6 py-3 max-h-72 overflow-y-auto">
          {steps.length === 0 && status === 'running' && (
            <p className="text-sm text-slate-400 py-4 text-center">Iniciando sincronización...</p>
          )}
          {steps.length > 0 && (
            <ul className="divide-y divide-slate-50" aria-label="Pasos de sincronización">
              {steps.map((step) => (
                <StepRow key={step.id} step={step} />
              ))}
            </ul>
          )}
        </div>

        {/* Summary — shown when done */}
        {isDone && results && (
          <div className="px-6 pb-2">
            <div
              className={`rounded-xl p-4 ${
                hasPartialErrors
                  ? 'bg-amber-50 border border-amber-200'
                  : status === 'error'
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-emerald-50 border border-emerald-200'
              }`}
            >
              <p className={`text-sm font-medium mb-2 ${hasPartialErrors ? 'text-amber-800' : status === 'error' ? 'text-red-800' : 'text-emerald-800'}`}>
                {status === 'error'
                  ? 'Sincronización fallida'
                  : hasPartialErrors
                  ? 'Sincronización completada con errores'
                  : 'Sincronización completada'}
              </p>
              <div className="flex gap-4 text-xs">
                <span className="text-emerald-700 font-medium">
                  {results.completed_steps} completados
                </span>
                {results.failed_steps > 0 && (
                  <span className="text-red-600 font-medium">
                    {results.failed_steps} fallidos
                  </span>
                )}
                {results.duration_seconds !== undefined && (
                  <span className="text-slate-500">
                    {results.duration_seconds.toFixed(1)}s
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Errors list — only partial errors when sync_complete fired */}
        {isDone && errors.length > 0 && !results && (
          <div className="px-6 pb-2">
            <div className="rounded-xl p-4 bg-red-50 border border-red-200">
              <p className="text-sm font-medium text-red-800 mb-1">Errores encontrados</p>
              <ul className="space-y-0.5">
                {errors.map((err, idx) => (
                  <li key={idx} className="text-xs text-red-600">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            disabled={isRunning}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
              bg-slate-900 text-white hover:bg-slate-700
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isRunning ? 'Sincronizando...' : 'Cerrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
