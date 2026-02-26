import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

import { useSyncProgress, SYNC_STEPS } from "@/hooks/useSyncProgress";

const EXPECTED_STEP_IDS = [
  "clear_cache",
  "fetch_plane_metrics",
  "fetch_plane_projects",
  "fetch_plane_cycles",
  "fetch_github_metrics",
];

describe("SYNC_STEPS constant", () => {
  it("has exactly 5 entries", () => {
    expect(SYNC_STEPS).toHaveLength(5);
  });

  it("contains the correct step IDs in order", () => {
    const ids = SYNC_STEPS.map((s) => s.id);
    expect(ids).toEqual(EXPECTED_STEP_IDS);
  });

  it("every entry has a non-empty label", () => {
    for (const step of SYNC_STEPS) {
      expect(step.label).toBeTruthy();
      expect(typeof step.label).toBe("string");
    }
  });
});

describe("useSyncProgress hook", () => {
  it("initializes with 5 steps in pending status", () => {
    const { result } = renderHook(() => useSyncProgress());

    expect(result.current.steps).toHaveLength(5);

    for (const step of result.current.steps) {
      expect(step.status).toBe("pending");
    }
  });

  it("starts not syncing with 0 progress and no error", () => {
    const { result } = renderHook(() => useSyncProgress());

    expect(result.current.isSyncing).toBe(false);
    expect(result.current.overallProgress).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("exposes startSync and cleanup as functions", () => {
    const { result } = renderHook(() => useSyncProgress());

    expect(typeof result.current.startSync).toBe("function");
    expect(typeof result.current.cleanup).toBe("function");
  });

  it("initial step IDs match the SYNC_STEPS constant", () => {
    const { result } = renderHook(() => useSyncProgress());

    const hookStepIds = result.current.steps.map((s) => s.id);
    const constantIds = SYNC_STEPS.map((s) => s.id);

    expect(hookStepIds).toEqual(constantIds);
  });
});
