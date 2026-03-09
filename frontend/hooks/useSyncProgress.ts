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
  members: 'Sincronizando miembros',
  projects: 'Sincronizando proyectos y ciclos',
  work_items: 'Sincronizando tareas',
  github: 'Sincronizando GitHub',
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
      const apiKey = process.env.NEXT_PUBLIC_API_KEY ?? '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }

      // Call backend directly — Next.js rewrites buffer SSE responses,
      // preventing real-time streaming updates.
      const directApi = process.env.NEXT_PUBLIC_API_URL ?? '';
      const response = await fetch(`${directApi}/api/sync/all`, {
        method: 'POST',
        headers,
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

        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

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
            const errs = (payload.errors as Array<{ step: string; error: string }>) ?? [];
            const resultsObj = payload.results as Record<string, unknown> | undefined;
            const totalSteps = (resultsObj ? Object.keys(resultsObj).length : 0) + errs.length;
            const syncResults: SyncResults = {
              total_steps: totalSteps,
              completed_steps: totalSteps - errs.length,
              failed_steps: errs.length,
              duration_seconds: undefined,
            };
            setResults(syncResults);
            setProgress(100);
            setStatus(errs.length === totalSteps && totalSteps > 0 ? 'error' : 'completed');

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
