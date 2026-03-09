"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { useHealth } from "@/hooks/useHealth";
import { RefreshIcon, CloudSyncIcon } from "@/components/icons";
import { useSyncProgress } from "@/hooks/useSyncProgress";

// ── Helpers ────────────────────────────────────────────────────────────────────

function getElapsedMinutes(updatedAt: number): number {
  return Math.floor((Date.now() - updatedAt) / 60000);
}

type FreshnessLevel = "fresh" | "stale" | "old";

function getFreshnessLevel(elapsedMin: number): FreshnessLevel {
  if (elapsedMin < 5) return "fresh";
  if (elapsedMin < 15) return "stale";
  return "old";
}

const freshnessStyles: Record<FreshnessLevel, { dot: string; text: string }> =
  {
    fresh: { dot: "bg-green-400 shadow-green-400/50", text: "text-green-600" },
    stale: {
      dot: "bg-yellow-400 shadow-yellow-400/50",
      text: "text-yellow-600",
    },
    old: { dot: "bg-red-400 shadow-red-400/50", text: "text-red-600" },
  };

function formatElapsed(elapsedMin: number): string {
  if (elapsedMin < 1) return "hace menos de 1 min";
  if (elapsedMin === 1) return "hace 1 min";
  return `hace ${elapsedMin} min`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FreshnessIndicator() {
  const { data, dataUpdatedAt } = useHealth();
  const queryClient = useQueryClient();
  const globalFetching = useIsFetching();

  const { startSync, isRunning, reset } = useSyncProgress();

  // Tick every 30 s to keep the elapsed label live
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const elapsedMin = dataUpdatedAt ? getElapsedMinutes(dataUpdatedAt) : null;
  const level: FreshnessLevel =
    elapsedMin !== null ? getFreshnessLevel(elapsedMin) : "old";
  const styles = freshnessStyles[level];

  const label = useCallback((): string => {
    if (elapsedMin === null) return "—";
    return formatElapsed(elapsedMin);
  }, [elapsedMin]);

  const apiOk = data?.status === "ok";
  const isLoading = globalFetching > 0 || isRunning;

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const handleSync = useCallback(() => {
    startSync();
  }, [startSync]);

  return (
    <div className="flex items-center gap-3">
      {/* Status dot + label */}
      <div className="hidden items-center gap-2 sm:flex">
        <span
          className={`h-2 w-2 rounded-full shadow-sm ${
            apiOk ? styles.dot : "bg-slate-300"
          }`}
          title={apiOk ? `API OK · ${level}` : "API no disponible"}
        />
        <span className={`text-xs font-medium ${apiOk ? styles.text : "text-slate-400"}`}>
          {apiOk ? `Actualizado: ${label()}` : "Sin conexión"}
        </span>
      </div>

      {/* Refresh button */}
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        title="Actualizar datos (puede usar caché)"
      >
        <RefreshIcon
          size={13}
          className={globalFetching > 0 ? "animate-spin" : ""}
        />
        <span className="hidden sm:inline">Actualizar</span>
      </button>

      {/* Sync button */}
      <button
        onClick={handleSync}
        disabled={isLoading}
        className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 shadow-sm transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
        title="Sincronizar — limpia caché y obtiene datos frescos de Plane/GitHub"
      >
        <CloudSyncIcon
          size={13}
          className={isRunning ? "animate-spin" : ""}
        />
        <span className="hidden sm:inline">Sincronizar</span>
      </button>
    </div>
  );
}
