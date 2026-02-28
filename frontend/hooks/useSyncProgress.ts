'use client';
import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export type StepStatus = 'pending' | 'running' | 'completed' | 'error';

export interface SyncStep {
  id: string;
  label: string;
  status: StepStatus;
  message?: string;
  records_synced?: number;
  error?: string;
}

export type SyncStatus = 'idle' | 'running' | 'completed' | 'error';

export interface SyncResults {
  total_steps: number;
  completed_steps: number;
  failed_steps: number;
  duration_seconds?: number;
}

const STEP_LABELS: Record<string, string> = {
  plane_projects: 'Sincronizando proyectos de Plane',
  plane_issues: 'Sincronizando issues de Plane',
  plane_cycles: 'Sincronizando ciclos de Plane',
  github_repos: 'Sincronizando repositorios de GitHub',
  github_prs: 'Sincronizando pull requests de GitHub',
  github_commits: 'Sincronizando commits de GitHub',
  compute_metrics: 'Calculando métricas',
};

function getStepLabel(stepId: string): string {
  return STEP_LABELS[stepId] ?? stepId;
}

function parseSseChunk(chunk: string): Array<{ event: string; data: unknown }> {
  const events: Array<{ event: string; data: unknown }> = [];
  const blocks = chunk.split('\n\n');

  for (const block of blocks) {
    if (!block.trim()) continue;

    const lines = block.split('\n');
    let eventType = 'message';
    let dataStr = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataStr = line.slice(5).trim();
      }
    }

    if (!dataStr) continue;

    try {
      const data = JSON.parse(dataStr);
      events.push({ event: eventType, data });
    } catch {
      // Skip malformed SSE data lines silently
    }
  }

  return events;
}

export function useSyncProgress() {
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [steps, setSteps] = useState<SyncStep[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [results, setResults] = useState<SyncResults | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const reset = useCallback(() => {
    setSteps([]);
    setProgress(0);
    setStatus('idle');
    setResults(null);
    setErrors([]);
  }, []);

  const startSync = useCallback(async () => {
    if (status === 'running') return;

    reset();
    setStatus('running');

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/sync/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        setStatus('error');
        setErrors(['Error al iniciar la sincronización. Intenta de nuevo.']);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setStatus('error');
        setErrors(['No se pudo leer la respuesta del servidor.']);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lastDoubleNewline = buffer.lastIndexOf('\n\n');
        if (lastDoubleNewline === -1) continue;

        const toProcess = buffer.slice(0, lastDoubleNewline + 2);
        buffer = buffer.slice(lastDoubleNewline + 2);

        const events = parseSseChunk(toProcess);

        for (const { event, data } of events) {
          const payload = data as Record<string, unknown>;

          if (event === 'sync_start') {
            const stepIds = (payload.steps as string[] | undefined) ?? [];
            setSteps(
              stepIds.map((id) => ({
                id,
                label: getStepLabel(id),
                status: 'pending',
              }))
            );
            setProgress(0);
          } else if (event === 'step_start') {
            const stepId = payload.step as string;
            setSteps((prev) =>
              prev.map((s) =>
                s.id === stepId ? { ...s, status: 'running', message: payload.message as string | undefined } : s
              )
            );
          } else if (event === 'step_complete') {
            const stepId = payload.step as string;
            setSteps((prev) => {
              const updated = prev.map((s) =>
                s.id === stepId
                  ? {
                      ...s,
                      status: 'completed' as StepStatus,
                      records_synced: payload.records_synced as number | undefined,
                      message: payload.message as string | undefined,
                    }
                  : s
              );
              const total = updated.length;
              const done = updated.filter((s) => s.status === 'completed' || s.status === 'error').length;
              setProgress(total > 0 ? Math.round((done / total) * 100) : 0);
              return updated;
            });
          } else if (event === 'step_error') {
            const stepId = payload.step as string;
            const errMsg = (payload.error as string) ?? 'Error desconocido';
            setSteps((prev) => {
              const updated = prev.map((s) =>
                s.id === stepId
                  ? { ...s, status: 'error' as StepStatus, error: errMsg }
                  : s
              );
              const total = updated.length;
              const done = updated.filter((s) => s.status === 'completed' || s.status === 'error').length;
              setProgress(total > 0 ? Math.round((done / total) * 100) : 0);
              return updated;
            });
            setErrors((prev) => [...prev, `${getStepLabel(stepId)}: ${errMsg}`]);
          } else if (event === 'sync_complete') {
            const syncResults: SyncResults = {
              total_steps: (payload.total_steps as number) ?? 0,
              completed_steps: (payload.completed_steps as number) ?? 0,
              failed_steps: (payload.failed_steps as number) ?? 0,
              duration_seconds: payload.duration_seconds as number | undefined,
            };
            setResults(syncResults);
            setProgress(100);
            setStatus('completed');

            await queryClient.invalidateQueries();
          }
        }
      }

      // Stream ended without sync_complete — treat as completed if running
      setStatus((prev) => (prev === 'running' ? 'completed' : prev));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      setStatus('error');
      setErrors(['Error de conexión al servidor. Intenta de nuevo.']);
    }
  }, [status, reset, queryClient]);

  const cancelSync = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const isRunning = status === 'running';

  return {
    startSync,
    cancelSync,
    reset,
    steps,
    progress,
    status,
    results,
    errors,
    isRunning,
  };
}
