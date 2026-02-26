import { useState, useRef, useCallback } from "react";
import { SyncStep, StepStatus } from "@/components/SyncProgressModal";
import { queryClient } from "@/lib/queryClient";

// ── Constants ────────────────────────────────────────────────────────────────

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const SYNC_STEPS = [
  { id: "clear_cache", label: "Limpiando datos en caché" },
  { id: "fetch_plane_metrics", label: "Obteniendo métricas del equipo desde Plane" },
  { id: "fetch_plane_projects", label: "Obteniendo proyectos desde Plane" },
  { id: "fetch_plane_cycles", label: "Obteniendo ciclos de sprint desde Plane" },
  { id: "fetch_github_metrics", label: "Obteniendo métricas de código desde GitHub" },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface SSEEvent {
  step: string;
  status: StepStatus;
  message?: string;
  progress?: number;
  summary?: {
    successful: string[];
    failed: string[];
    total_steps: number;
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

function buildInitialSteps(): SyncStep[] {
  return SYNC_STEPS.map((s) => ({
    id: s.id,
    label: s.label,
    status: "pending" as StepStatus,
  }));
}

export function useSyncProgress() {
  const [steps, setSteps] = useState<SyncStep[]>(buildInitialSteps);
  const [isSyncing, setIsSyncing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Update a single step by id
  function applyStepEvent(prev: SyncStep[], event: SSEEvent): SyncStep[] {
    return prev.map((s) => {
      if (s.id !== event.step) return s;
      return {
        ...s,
        status: event.status,
        ...(event.message !== undefined ? { message: event.message } : {}),
      };
    });
  }

  // Mark all pending / in_progress steps as error (connection lost)
  function markRemainingAsError(prev: SyncStep[]): SyncStep[] {
    return prev.map((s) => {
      if (s.status === "pending" || s.status === "in_progress") {
        return { ...s, status: "error" as StepStatus };
      }
      return s;
    });
  }

  const startSync = useCallback(async () => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Reset state
    setSteps(buildInitialSteps());
    setIsSyncing(true);
    setOverallProgress(0);
    setError(null);

    try {
      const response = await fetch(`${BASE_URL}/api/sync/stream`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Accept: "text/event-stream",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Error al iniciar la sincronización: ${response.status} ${response.statusText}`,
        );
      }

      if (!response.body) {
        throw new Error("La respuesta no contiene un cuerpo legible.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from the buffer
        const lines = buffer.split("\n");
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();

          if (trimmed === "") continue;

          if (trimmed.startsWith("data: ")) {
            const jsonStr = trimmed.slice("data: ".length);

            let parsed: SSEEvent;
            try {
              parsed = JSON.parse(jsonStr) as SSEEvent;
            } catch {
              // Ignore malformed JSON lines
              continue;
            }

            // Update progress bar from the event's progress field
            if (typeof parsed.progress === "number") {
              setOverallProgress(parsed.progress);
            }

            // Check for completion
            if (parsed.step === "complete") {
              setIsSyncing(false);
              void queryClient.invalidateQueries();
              return;
            }

            // Update the matching step
            setSteps((prev) => applyStepEvent(prev, parsed));
          }
        }
      }

      // Stream ended without explicit complete event — treat as done
      setIsSyncing(false);
      void queryClient.invalidateQueries();
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Component unmounted or another sync started — do not update state
        return;
      }

      const message =
        err instanceof Error
          ? err.message
          : "Error desconocido durante la sincronización.";

      setError(message);
      setSteps((prev) => markRemainingAsError(prev));
      setIsSyncing(false);
    }
  }, []);

  // Cleanup on unmount — abort any active fetch
  // (Callers should invoke cleanup via useEffect return value if needed;
  //  the AbortController ref handles the abort automatically on the next startSync call
  //  or when the component unmounts via a useEffect in the consuming component.)
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    steps,
    isSyncing,
    overallProgress,
    error,
    startSync,
    cleanup,
  };
}
